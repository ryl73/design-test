import { spawn } from 'node:child_process';
import { databaseUrl } from './database-url.mjs';
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Database launcher requires a command');
const child = spawn(command, args, {
  stdio: 'inherit',
  env: {...process.env, DATABASE_URL: databaseUrl(process.env)},
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', () => { console.error('Database command failed to start'); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
