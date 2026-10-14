import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from '../server/node_modules/dotenv/lib/main.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const loaded = dotenv.config({ path: path.join(root, 'server/.env') });
if (loaded.error || (process.env.LEGAL_RETRIEVAL_TOKEN || '').length < 32) {
  throw new Error('Set LEGAL_RETRIEVAL_TOKEN (32+ characters) in server/.env before starting retrieval.');
}
const childEnv = { ...process.env, LEGAL_RETRIEVAL_DATA_DIR: path.join(root, 'services/legal-retrieval/data') };
delete childEnv.GEMINI_API_KEY;
delete childEnv.LLM_API_KEY;
const child = spawn(process.env.LEGAL_PYTHON || 'python', [path.join(root, 'services/legal-retrieval/server.py')],
  { cwd: root, env: childEnv, windowsHide: true, stdio: 'inherit' });
child.on('error', () => { console.error('Unable to start Python retrieval. Set LEGAL_PYTHON to your Python executable.'); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
