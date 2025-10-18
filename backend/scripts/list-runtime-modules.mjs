import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);

const profile = process.argv[2] ?? 'dev';
const logDir = path.resolve(process.cwd(), '..', 'analysis');
const outputFile = path.join(logDir, `runtime-backend-modules-${profile}.json`);

const modules = Object.keys(require.cache);
const payload = {
  profile,
  generated_at: new Date().toISOString(),
  modules: modules.filter((m) => m.includes('backend')).sort(),
};

fs.mkdirSync(logDir, { recursive: true });
fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2));
console.log(`Runtime module list stored in ${outputFile}`);
