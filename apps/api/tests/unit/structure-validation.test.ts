import { expect, it } from 'vitest';
import { savedUrl, fields, pagination } from '../../src/http/validation.js';
import { validateConfig } from '../../src/config/config.js';
const env = { NODE_ENV: 'test', APP_ORIGIN: 'http://localhost:58080', DATABASE_URL: 'postgresql://qa:password@localhost/design_qa_test', MINIO_ENDPOINT: 'http://localhost:59000', MINIO_BUCKET: 'design-qa-test', MINIO_ACCESS_KEY: 'local', MINIO_SECRET_KEY: 'local', SESSION_SIGNING_KEY: 'a'.repeat(32), CAPTURE_ALLOWED_ORIGINS: 'https://example.com' };
const config = validateConfig(env);
it('rejects control characters before URL canonicalization', () => { expect(() => savedUrl('\nhttps://example.com', config)).toThrow(); });
it('accepts and canonicalizes an allowlisted URL without network access', () => { expect(savedUrl('https://EXAMPLE.com/a?q=filter', config)).toBe('https://example.com/a?q=filter'); });
it('rejects sensitive query keys including encoded keys', () => { for (const key of ['%61ccess_token', 'apiKey', 'X-Amz-Signature', 'password'])
    expect(() => savedUrl('https://example.com/?' + key + '=secret', config)).toThrow(); });
it('rejects wrong primitives and all variant limits', () => { for (const body of [{ name: 'A', viewportWidth: '1280', viewportHeight: 720 }, { name: 'A', viewportWidth: 1280, viewportHeight: 1601 }, { name: 'A', viewportWidth: 1280, viewportHeight: 720, settleDelayMs: 3001 }, { name: 'A', viewportWidth: 1280, viewportHeight: 720, readySelector: 'a'.repeat(301) }, { name: 'A', viewportWidth: 1280, viewportHeight: 720, authProfileRef: { profileId: 'missing', version: 1 } }])
    expect(() => fields(body, 'variant', false, config)).toThrow(); });
it('rejects nested unknown profile fields and metadata with secrets', () => { expect(() => fields({ version: 1, authProfileRef: { profileId: 'missing', version: 1, secret: 'no' } }, 'variant', true, config)).toThrow(); expect(() => validateConfig({ ...env, CAPTURE_PROFILES_METADATA: JSON.stringify([{ id: 'a', version: 1, label: 'A', origin: 'https://example.com', password: 'no' }]) })).toThrow(); });
it('rejects array query parameters and invalid cursors', () => { for (const query of [{ limit: ['1'] }, { archived: ['false'] }, { cursor: Buffer.from('{}').toString('base64url') }])
    expect(() => pagination(query)).toThrow(); });

it("rejects empty fragment and userinfo delimiters",()=>{for(const url of ["https://example.com/#","https://@example.com/"])expect(()=>savedUrl(url,config)).toThrow();});
