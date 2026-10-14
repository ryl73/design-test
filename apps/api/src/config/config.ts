export const CONFIG = Symbol('CONFIG');
export function validateConfig(env: Record<string, string | undefined>) {
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  };
  const mode = required('NODE_ENV');
  if (!['development', 'test', 'production'].includes(mode)) throw new Error('Invalid NODE_ENV');
  const url = (name: string, protocols: string[]) => {
    let value: URL;
    try {
      value = new URL(required(name));
    } catch {
      throw new Error(`Invalid ${name}`);
    }
    if (!protocols.includes(value.protocol)) throw new Error(`Invalid ${name}`);
    return value;
  };
  const origin = url('APP_ORIGIN', ['http:', 'https:']);
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash || (mode === 'production' && origin.protocol !== 'https:')) throw new Error('Invalid APP_ORIGIN: production requires HTTPS gateway');
  if (mode !== 'production' && origin.protocol === 'http:' && !['localhost','127.0.0.1','[::1]'].includes(origin.hostname)) throw new Error('APP_ORIGIN HTTP requires loopback');
  const database = url('DATABASE_URL', ['postgresql:', 'postgres:']);
  const endpoint = url('MINIO_ENDPOINT', ['http:', 'https:']);
  if (endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash) throw new Error('Invalid MINIO_ENDPOINT');
  const bucket = required('MINIO_BUCKET');
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid MINIO_BUCKET');
  if (mode === 'test' && (database.pathname !== '/design_qa_test' || bucket !== 'design-qa-test')) throw new Error('test requires isolated design_qa_test database and design-qa-test bucket');
  const signingKey = required('SESSION_SIGNING_KEY');
  if (signingKey.length < 32 || (mode === 'production' && signingKey.startsWith('local-'))) throw new Error('Invalid SESSION_SIGNING_KEY');
  if (env.CAPTURE_ENABLED && env.CAPTURE_ENABLED !== 'false') throw new Error('CAPTURE_ENABLED must remain false');
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return {
    mode,
    origin: origin.origin,
    databaseUrl: database.href,
    endpoint,
    bucket,
    accessKey: required('MINIO_ACCESS_KEY'),
    secretKey: required('MINIO_SECRET_KEY'),
    signingKey,
    port,
    host: env.HOST ?? '127.0.0.1',
  };
}
export type AppConfig = ReturnType<typeof validateConfig>;
