import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.bucket = this.configService.get('S3_BUCKET', 'resq-live-evidence');

    this.s3Client = new S3Client({
      region: this.configService.get('S3_REGION', 'us-east-1'),
      endpoint: this.configService.get('S3_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.get('S3_ACCESS_KEY', 'minioadmin'),
        secretAccessKey: this.configService.get('S3_SECRET_KEY', 'minioadmin'),
      },
      forcePathStyle: !!this.configService.get('S3_ENDPOINT'),
    });
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Check bucket accessibility
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await this.s3Client.send(command);

      return this.getStatus(key, true, {
        bucket: this.bucket,
        accessible: true,
      });
    } catch (error) {
      throw new HealthCheckError(
        'Storage check failed',
        this.getStatus(key, false, {
          bucket: this.bucket,
          accessible: false,
          error: error.message,
        }),
      );
    }
  }
}