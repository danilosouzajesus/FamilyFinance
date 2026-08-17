import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rootDist = path.join(rootDir, 'dist');
const clientDist = path.join(rootDir, 'client', 'dist');

if (fs.existsSync(clientDist)) {
  fs.mkdirSync(rootDist, { recursive: true });
  fs.cpSync(clientDist, rootDist, { recursive: true });
  console.log('[ensure-build-dirs] Synced client/dist -> dist');
}

if (fs.existsSync(rootDist)) {
  fs.mkdirSync(clientDist, { recursive: true });
  fs.cpSync(rootDist, clientDist, { recursive: true });
  console.log('[ensure-build-dirs] Synced dist -> client/dist');
}
