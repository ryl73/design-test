import { randomUUID } from 'node:crypto';
import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
export class ApiError extends HttpException {
    constructor(status: number, readonly code: string, message: string, readonly details: Record<string, unknown> = {}) { super(message, status); }
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    catch(error: unknown, host: ArgumentsHost) {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        const response = host.switchToHttp().getResponse<{
            status: (n: number) => {
                json: (v: unknown) => void;
            };
        }>();
        let details: Record<string, unknown> = {};
        if (status === 503 && error instanceof HttpException) {
            const data = error.getResponse();
            if (typeof data === 'object' && data !== null && 'checks' in data) {
                const checks = data.checks as Record<string, unknown>;
                if (checks && typeof checks.database === 'boolean' && typeof checks.storage === 'boolean')
                    details = { checks: { database: checks.database, storage: checks.storage } };
            }
        }
        response.status(status).json({ error: {
                code: error instanceof ApiError ? error.code : status === 404 ? 'NOT_FOUND' : status === 400 ? 'INVALID_INPUT' : status === 503 ? 'DEPENDENCY_UNAVAILABLE' : 'INTERNAL_ERROR',
                message: error instanceof ApiError ? error.message : status === 404 ? 'Object not found' : status === 400 ? 'Invalid request' : status === 503 ? 'Required dependencies are unavailable' : 'Request failed',
                details: error instanceof ApiError ? error.details : details,
                requestId: randomUUID(),
            } });
    }
}
export function missing<T>(value: T | null): T { if (value === null)
    throw new ApiError(404, 'NOT_FOUND', 'Object not found'); return value; }
export function checkVersion(actual: number, expected: number) { if (actual !== expected)
    throw new ApiError(409, 'VERSION_CONFLICT', 'Object changed. Refresh the data.', { currentVersion: actual }); }
export function active(archivedAt: Date | null) { if (archivedAt)
    throw new ApiError(409, 'ARCHIVED', 'Archived objects do not accept writes'); }
