import fs from 'fs';
import path from 'path';

const profile = process.argv[2] ?? 'dev';
const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const dependencies = Object.keys(pkg.dependencies ?? {}).sort();
const devDependencies = Object.keys(pkg.devDependencies ?? {}).sort();

const logDir = path.resolve(root, '..', 'analysis');
fs.mkdirSync(logDir, { recursive: true });

const payload = {
  profile,
  generated_at: new Date().toISOString(),
  dependencies,
  devDependencies,
  notes: 'Lista pochodzi z package.json – zweryfikuj w smoke teście reakcje bundlera.'
};

const outputFile = path.join(logDir, `runtime-frontend-modules-${profile}.json`);
fs.writeFileSync(outputFile, JSON.stringify(payload, null, 2));
console.log(`Runtime module list stored in ${outputFile}`);
