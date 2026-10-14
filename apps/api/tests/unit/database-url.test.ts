import { expect, it } from 'vitest';
import { databaseUrl } from '../../../../scripts/database-url.mjs';
it('preserves the raw database credentials and names containing URL delimiters', () => {
  const secret = ' spaces #/?@:%+ end ';
  const result = new URL(databaseUrl({POSTGRES_USER:'qa@operator', POSTGRES_PASSWORD:secret, POSTGRES_HOST:'postgres', POSTGRES_PORT:'5432',POSTGRES_DB:'design_qa_test'}));
  expect(decodeURIComponent(result.username)).toBe('qa@operator');
  expect(decodeURIComponent(result.password)).toBe(secret);
  expect(result.hostname).toBe('postgres');
  expect(result.pathname).toBe('/design_qa_test');
  expect(result.search).toBe('');
  expect(result.hash).toBe('');
});
