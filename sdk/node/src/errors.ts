/**
 * DC1 SDK error classes.
 */

export class DC1Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DC1Error';
  }
}

export class AuthError extends DC1Error {
  constructor(message = 'Unauthorized: check your API key') {
    super(message);
    this.name = 'AuthError';
  }
}

export class APIError extends DC1Error {
  statusCode: number;
  response: Record<string, unknown>;

  constructor(message: string, statusCode = 0, response: Record<string, unknown> = {}) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

export class JobTimeoutError extends DC1Error {
  jobId: string;
  timeoutMs: number;

  constructor(jobId: string, timeoutMs: number) {
    super(`Job ${jobId} did not complete within ${timeoutMs}ms`);
    this.name = 'JobTimeoutError';
    this.jobId = jobId;
    this.timeoutMs = timeoutMs;
  }
}
