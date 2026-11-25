import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

export interface ApiResponse<T> {
  api_version: string;
  request_id: string;
  timestamp: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    return next.handle().pipe(
      map((data) => {
        // If data is already an error response (from exception filter), don't wrap it
        if (data && typeof data === 'object' && 'error' in data) {
          return data;
        }

        return {
          api_version: 'v1',
          request_id: requestId,
          timestamp: new Date().toISOString(),
          data,
        };
      }),
    );
  }
}