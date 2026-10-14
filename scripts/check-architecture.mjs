import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.name.endsWith('.js')) files.push(target);
  }
  return files;
}
let checked = 0;
for (const layer of ['domain', 'application']) {
  const base = path.join(root, 'server', layer);
  for (const file of await walk(base)) {
    const source = await fs.readFile(file, 'utf8');
    const imports = [...source.matchAll(/(?:\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\))/g)];
    for (const match of imports) {
      const specifier = match[1] || match[2];
      assert.ok(specifier.startsWith('.'), `${file}: framework/builtin imports forbidden in ${layer}: ${specifier}`);
      const target = path.resolve(path.dirname(file), specifier);
      const allowed = layer === 'domain' ? ['domain'] : ['domain', 'application'];
      assert.ok(allowed.some(name => target.startsWith(path.join(root, 'server', name) + path.sep)), `${file}: dependency must point inward: ${specifier}`);
      await fs.access(target);
    }
    assert.ok(!/\brequire\s*\(|\bprocess\.env\b|\bfetch\s*\(/.test(source), `${file}: infrastructure capability must be injected`);
    checked++;
  }
}
const client = JSON.parse(await fs.readFile(path.join(root, 'client/package.json'), 'utf8'));
assert.ok(!client.main && !client.build, 'Web client must not configure desktop packaging');
assert.ok(!Object.keys({ ...client.dependencies, ...client.devDependencies }).some(name => name.startsWith('electron')), 'Electron is archived, not a web dependency');
assert.ok(!Object.values(client.scripts).some(command => /electron|electron-builder/.test(command)), 'Web scripts must not launch desktop packaging');
const app = await fs.readFile(path.join(root, 'server/app.js'), 'utf8');
assert.ok(!/\.listen\s*\(|initBackupCron\s*\(|initReminderCron\s*\(|initDiscoveryService\s*\(/.test(app), 'HTTP configuration must not start process resources');
console.log(`Architecture checks passed: ${checked} core modules point inward; web-only client; separate process entrypoint.`);
