import { HttpException, type ArgumentsHost } from '@nestjs/common';
import { expect, it } from 'vitest';
import { ApiExceptionFilter } from '../../src/http/errors.js';
function result(error: unknown) { let status = 0; let body: unknown; const host = { switchToHttp: () => ({ getResponse: () => ({ status: (value: number) => { status = value; return { json: (value: unknown) => { body = value; } }; } }) }) } as ArgumentsHost; new ApiExceptionFilter().catch(error, host); return { status, body }; }
it('preserves safe dependency checks inside the standard error envelope', () => { expect(result(new HttpException({ status: 'unavailable', checks: { database: false, storage: true } }, 503))).toMatchObject({ status: 503, body: { error: { code: 'DEPENDENCY_UNAVAILABLE', details: { checks: { database: false, storage: true } } } } }); });
it('never exposes unhandled error text', () => { expect(JSON.stringify(result(new Error('secret-password')))).not.toContain('secret-password'); });
