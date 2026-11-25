import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'knex';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string || this.generateRequestId();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SERVER_OR_DEPENDENCY_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> = {};
    let retryable = false;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        code = (resp.code as string) || exception.name;
        message = (resp.message as string) || exception.message;
        details = (resp.details as Record<string, unknown>) || {};
        retryable = (resp.retryable as boolean) || false;
      } else {
        code = exception.name;
        message = exception.message;
      }

      // Map HTTP status to standard codes
      if (!code || code === 'HttpException') {
        switch (status) {
          case HttpStatus.BAD_REQUEST:
            code = 'INVALID_REQUEST';
            break;
          case HttpStatus.UNAUTHORIZED:
            code = 'AUTHENTICATION_REQUIRED';
            break;
          case HttpStatus.FORBIDDEN:
            code = 'SCOPE_DENIED';
            break;
          case HttpStatus.NOT_FOUND:
            code = 'RESOURCE_NOT_FOUND';
            break;
          case HttpStatus.CONFLICT:
            code = 'VERSION_CONFLICT';
            break;
          case HttpStatus.PAYLOAD_TOO_LARGE:
            code = 'PAYLOAD_TOO_LARGE';
            break;
          case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
            code = 'UNSUPPORTED_MEDIA_TYPE';
            break;
          case HttpStatus.UNPROCESSABLE_ENTITY:
            code = 'VALIDATION_FAILED';
            break;
          case HttpStatus.TOO_MANY_REQUESTS:
            code = 'RATE_LIMITED';
            retryable = true;
            break;
          default:
            code = 'SERVER_OR_DEPENDENCY_ERROR';
        }
      }
    } else if (exception instanceof QueryFailedError) {
      // Database errors
      status = HttpStatus.CONFLICT;
      code = 'DATABASE_ERROR';
      message = 'Database operation failed';

      // Check for unique constraint violations
      if (exception.message.includes('duplicate key') || exception.message.includes('unique constraint')) {
        if (exception.message.includes('report_id')) {
          code = 'IDEMPOTENCY_CONFLICT';
        } else if (exception.message.includes('incident_id') || exception.message.includes('incident_reports')) {
          code = 'VERSION_CONFLICT';
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
    }

    // Determine retryable based on status code
    if ([HttpStatus.TOO_MANY_REQUESTS, HttpStatus.SERVICE_UNAVAILABLE, HttpStatus.BAD_GATEWAY, HttpStatus.GATEWAY_TIMEOUT].includes(status)) {
      retryable = true;
    }

    const errorResponse = {
      error: {
        code,
        message,
        request_id: requestId,
        retryable,
        ...(Object.keys(details).length > 0 && { details }),
      },
    };

    this.logger.warn(
      `${request.method} ${request.url} - ${status} - ${code} - ${requestId}`,
    );

    response.status(status).json(errorResponse);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}