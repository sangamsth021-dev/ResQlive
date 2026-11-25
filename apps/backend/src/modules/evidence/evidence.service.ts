import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { InjectConnection } from 'nestjs-knex';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';

import { CreateUploadSessionDto, CompleteUploadDto } from './dto';
import { UserPayload } from '../common/interfaces/user-payload.interface';

@Injectable()
export class EvidenceService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly presignedUrlExpiry: number;

  constructor(
    @InjectConnection() private readonly knex: Knex,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get('S3_BUCKET', 'resq-live-evidence');
    this.presignedUrlExpiry = this.configService.get('S3_PRESIGNED_URL_EXPIRY', 3600); // 1 hour

    this.s3Client = new S3Client({
      region: this.configService.get('S3_REGION', 'us-east-1'),
      endpoint: this.configService.get('S3_ENDPOINT'), // For MinIO
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.configService.get('S3_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: !!this.configService.get('S3_ENDPOINT'), // Required for MinIO
    });
  }

  async createUploadSession(
    dto: CreateUploadSessionDto,
    user: UserPayload,
  ): Promise<{
    evidence_id: string;
    upload_url: string;
    upload_fields: Record<string, string>;
    expires_at: Date;
  }> {
    // Verify evidence record exists and belongs to a report user can access
    const evidence = await this.knex('evidence')
      .where('evidence_id', dto.evidence_id)
      .first();

    if (!evidence) {
      throw new NotFoundException({
        code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidence record not found',
        retryable: false,
      });
    }

    // Check report access
    const report = await this.knex('reports')
      .where('report_id', evidence.report_id)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Associated report not found',
        retryable: false,
      });
    }

    // Verify user can access this report (reporter or scoped access)
    const canAccess = report.reporter_user_id === user.user_id ||
      user.permissions.includes('report:read:scope') ||
      user.roles.includes('org_admin');

    if (!canAccess) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this evidence',
        retryable: false,
      });
    }

    // Check if upload already completed
    if (evidence.storage_state === 'UPLOAD_COMPLETE') {
      throw new ConflictException({
        code: 'UPLOAD_ALREADY_COMPLETE',
        message: 'Evidence already uploaded',
        retryable: false,
      });
    }

    // Generate object key: evidence/{report_id}/{evidence_id}.{ext}
    const extension = this.getExtensionFromMime(evidence.mime_type);
    const objectKey = `evidence/${evidence.report_id}/${evidence.evidence_id}.${extension}`;

    // Generate presigned URL
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: evidence.mime_type,
      ContentLength: evidence.size_bytes,
      Metadata: {
        'evidence-id': evidence.evidence_id,
        'report-id': evidence.report_id,
        'sha256': evidence.sha256_hash,
      },
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.presignedUrlExpiry,
    });

    const expiresAt = new Date(Date.now() + this.presignedUrlExpiry * 1000);

    // Update evidence with upload URL info
    await this.knex('evidence')
      .where('evidence_id', dto.evidence_id)
      .update({
        storage_state: 'UPLOAD_IN_PROGRESS',
        storage_url: uploadUrl,
        updated_at: new Date(),
      });

    return {
      evidence_id: dto.evidence_id,
      upload_url: uploadUrl,
      upload_fields: {}, // For multipart, we'd return additional fields
      expires_at: expiresAt,
    };
  }

  async completeUpload(
    dto: CompleteUploadDto,
    user: UserPayload,
  ): Promise<{ status: string }> {
    const evidence = await this.knex('evidence')
      .where('evidence_id', dto.evidence_id)
      .first();

    if (!evidence) {
      throw new NotFoundException({
        code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidence record not found',
        retryable: false,
      });
    }

    // Check report access
    const report = await this.knex('reports')
      .where('report_id', evidence.report_id)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Associated report not found',
        retryable: false,
      });
    }

    const canAccess = report.reporter_user_id === user.user_id ||
      user.permissions.includes('report:read:scope') ||
      user.roles.includes('org_admin');

    if (!canAccess) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this evidence',
        retryable: false,
      });
    }

    // Update status to pending verification
    await this.knex('evidence')
      .where('evidence_id', dto.evidence_id)
      .update({
        storage_state: 'UPLOAD_COMPLETE',
        integrity_status: 'pending',
        updated_at: new Date(),
      });

    // Queue verification job (handled by EvidenceWorker)
    // The worker will verify checksum and update integrity_status

    return { status: 'queued_for_verification' };
  }

  async getEvidence(evidenceId: string, user: UserPayload): Promise<any> {
    const evidence = await this.knex('evidence')
      .where('evidence_id', evidenceId)
      .first();

    if (!evidence) {
      throw new NotFoundException({
        code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidence not found',
        retryable: false,
      });
    }

    // Check report access
    const report = await this.knex('reports')
      .where('report_id', evidence.report_id)
      .first();

    if (!report) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: 'Associated report not found',
        retryable: false,
      });
    }

    const canAccess = report.reporter_user_id === user.user_id ||
      user.permissions.includes('report:read:scope') ||
      user.roles.includes('org_admin');

    if (!canAccess) {
      throw new ForbiddenException({
        code: 'SCOPE_DENIED',
        message: 'Access denied to this evidence',
        retryable: false,
      });
    }

    return evidence;
  }

  async getDownloadUrl(evidenceId: string, user: UserPayload): Promise<{ download_url: string; expires_at: Date }> {
    const evidence = await this.getEvidence(evidenceId, user);

    if (evidence.storage_state !== 'UPLOAD_COMPLETE') {
      throw new BadRequestException({
        code: 'EVIDENCE_NOT_AVAILABLE',
        message: 'Evidence not available for download',
        retryable: false,
      });
    }

    const objectKey = this.getObjectKey(evidence);

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    const downloadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: this.presignedUrlExpiry,
    });

    return {
      download_url: downloadUrl,
      expires_at: new Date(Date.now() + this.presignedUrlExpiry * 1000),
    };
  }

  async verifyEvidence(evidenceId: string): Promise<{ integrity_status: string; verified_at: Date }> {
    const evidence = await this.knex('evidence')
      .where('evidence_id', evidenceId)
      .first();

    if (!evidence) {
      throw new NotFoundException({
        code: 'EVIDENCE_NOT_FOUND',
        message: 'Evidence not found',
        retryable: false,
      });
    }

    if (evidence.storage_state !== 'UPLOAD_COMPLETE') {
      throw new BadRequestException({
        code: 'EVIDENCE_NOT_UPLOADED',
        message: 'Evidence upload not complete',
        retryable: false,
      });
    }

    const objectKey = this.getObjectKey(evidence);

    try {
      // Get object from S3
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
      });

      const response = await this.s3Client.send(command);
      const stream = response.Body as any;

      // Calculate SHA-256
      const hash = await this.calculateStreamHash(stream);

      // Compare with stored hash
      const integrityStatus = hash.toLowerCase() === evidence.sha256_hash.toLowerCase()
        ? 'checksum_verified'
        : 'checksum_mismatch';

      await this.knex('evidence')
        .where('evidence_id', evidenceId)
        .update({
          integrity_status: integrityStatus,
          verified_at: new Date(),
          updated_at: new Date(),
        });

      // Create audit log
      await this.knex('audit_logs').insert({
        audit_id: uuidv4(),
        actor_user_id: null, // System
        actor_role: 'system',
        action: 'evidence.verify',
        target_type: 'EVIDENCE',
        target_id: evidenceId,
        metadata_json: { expected_hash: evidence.sha256_hash, actual_hash: hash },
        occurred_at: new Date(),
      });

      return { integrity_status: integrityStatus, verified_at: new Date() };
    } catch (error) {
      await this.knex('evidence')
        .where('evidence_id', evidenceId)
        .update({
          integrity_status: 'verification_failed',
          updated_at: new Date(),
        });

      throw error;
    }
  }

  private getObjectKey(evidence: any): string {
    const extension = this.getExtensionFromMime(evidence.mime_type);
    return `evidence/${evidence.report_id}/${evidence.evidence_id}.${extension}`;
  }

  private getExtensionFromMime(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'application/pdf': 'pdf',
      'application/json': 'json',
    };
    return extensions[mimeType] || 'bin';
  }

  private async calculateStreamHash(stream: NodeJS.ReadableStream): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}