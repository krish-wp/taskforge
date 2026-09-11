import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logDir = path.join(__dirname, '../../logs');
fs.mkdirSync(logDir, { recursive: true });

export default function workerLog(workerName, WORKER_ID, message) {
  const timestamp = new Date().toISOString();
  const logFile = path.join(logDir, `${workerName}-worker-${WORKER_ID}.log`);
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}
