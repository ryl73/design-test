export function databaseUrl(env) {
  const required = (name) => {
    const value = env[name];
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing ${name}`);
    return value;
  };
  const target = new URL(`postgresql://${required('POSTGRES_HOST')}:${required('POSTGRES_PORT')}`);
  target.username = encodeURIComponent(required('POSTGRES_USER'));
  target.password = encodeURIComponent(required('POSTGRES_PASSWORD'));
  target.pathname = `/${encodeURIComponent(required('POSTGRES_DB'))}`;
  return target.href;
}
