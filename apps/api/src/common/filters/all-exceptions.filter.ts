import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ApiErrorResponse } from '@news-tracker/contracts';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    const message = this.getMessage(exceptionResponse, exception);
    const error = exception instanceof HttpException ? exception.name : 'InternalServerError';
    const body: ApiErrorResponse = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json(body);
  }

  private getMessage(
    exceptionResponse: string | object | null,
    exception: unknown,
  ): string | string[] {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      (typeof exceptionResponse.message === 'string' || Array.isArray(exceptionResponse.message))
    ) {
      return exceptionResponse.message as string | string[];
    }

    return exception instanceof Error ? exception.message : 'An unexpected error occurred';
  }
}
