import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

// Inspect the actual production graph without overwriting a packaged build.
const result = await build({
  root: fileURLToPath(new URL('../', import.meta.url)),
  logLevel: 'warn',
  build: { write: false }
});
const chunks = result.output.filter((item) => item.type === 'chunk');
const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
const entry = chunks.find((chunk) => chunk.isEntry);
assert.ok(entry, 'The app must have a JavaScript entry');

function staticDependencies(chunk, visited = new Set()) {
  if (visited.has(chunk)) return visited;
  visited.add(chunk);
  for (const name of chunk.imports) {
    const dependency = byFile.get(name);
    assert.ok(dependency, `Missing built dependency: ${name}`);
    staticDependencies(dependency, visited);
  }
  return visited;
}

const startup = [...staticDependencies(entry)];
const startupBytes = startup.reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0);
const gzipBytes = startup.reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0);
assert.ok(startupBytes < 250_000, `Startup JavaScript exceeds 250 kB: ${startupBytes}`);
for (const chunk of chunks) {
  assert.ok(Buffer.byteLength(chunk.code) < 500_000, `Chunk exceeds 500 kB: ${chunk.fileName}`);
}

const moduleIds = (group) => group.flatMap((chunk) => Object.keys(chunk.modules).map((id) => id.replaceAll('\\', '/')));
const startupModules = moduleIds(startup);
assert.ok(!startupModules.some((id) => /\/src\/components\/(?!Shared\/)/.test(id)), 'Feature screens must not be eagerly loaded');
const pdfChunks = chunks.filter((chunk) => moduleIds([chunk]).some((id) => id.includes('/node_modules/pdf-lib/')));
assert.ok(pdfChunks.length > 0, 'The PDF feature must still be included in the build');
assert.ok(pdfChunks.some((chunk) => chunk.isDynamicEntry), 'PDF generation must have a dynamic entry');

// Even after opening a screen, PDF generation should wait for explicit use.
const screens = chunks.filter((chunk) => chunk.isDynamicEntry && chunk.facadeModuleId?.replaceAll('\\', '/').includes('/src/components/'));
assert.ok(screens.length > 0, 'Feature screens must produce dynamic entries');
for (const screen of [entry, ...screens]) {
  const dependencies = staticDependencies(screen);
  assert.ok(pdfChunks.every((chunk) => !dependencies.has(chunk)), `PDF library loaded before use by ${screen.name}`);
}

console.log(`Bundle checks passed: ${screens.length} lazy screens, ${chunks.length} JS chunks.`);
console.log(`Startup JavaScript: ${(startupBytes / 1000).toFixed(2)} kB (${(gzipBytes / 1000).toFixed(2)} kB gzip).`);

// Count the screen and every shared dependency, not just the smaller entry file.
for (const [label, paths, budget] of [
  ['Landing', ['/Landing/Landing.jsx'], 300_000],
  ['Dashboard', ['/Layout/Layout.jsx', '/Dashboard/Dashboard.jsx'], 350_000]
]) {
  const dependencies = new Set(startup);
  for (const path of paths) {
    const screen = screens.find((chunk) => chunk.facadeModuleId.replaceAll('\\', '/').endsWith(path));
    assert.ok(screen, `Missing initial screen: ${path}`);
    staticDependencies(screen, dependencies);
  }
  const bytes = [...dependencies].reduce((sum, chunk) => sum + Buffer.byteLength(chunk.code), 0);
  const gzip = [...dependencies].reduce((sum, chunk) => sum + gzipSync(chunk.code).length, 0);
  assert.ok(bytes < budget, `${label} initial load exceeds ${budget / 1000} kB: ${bytes}`);
  console.log(`${label} initial JavaScript: ${(bytes / 1000).toFixed(2)} kB (${(gzip / 1000).toFixed(2)} kB gzip).`);
}
