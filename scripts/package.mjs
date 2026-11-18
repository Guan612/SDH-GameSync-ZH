import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

// Small dependency-free ZIP writer: UTF-8 names, deflate, CRC32 and Unix modes.
// Explicit allowlist keeps credentials, node_modules and local settings out.
const root = fileURLToPath(new URL('../', import.meta.url));
const pluginDir = 'SDH-GameSync';
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const files = ['LICENSE', 'main.py', 'package.json', 'plugin.json', 'README.md', 'README.zh-CN.md'];
const entries = files.map(file => ({ source: file, name: file }));
entries.push(
  { source: 'defaults/default_config.json', name: 'default_config.json' },
  { source: 'defaults/exclude_all.filter', name: 'exclude_all.filter' },
);
async function collect(dir) {
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const file = `${dir}/${item.name}`;
    if (item.isDirectory()) await collect(file);
    else if (item.isFile() && !file.endsWith('.map') && !file.endsWith('.pyc')) {
      entries.push({ source: file, name: file });
    }
  }
}
await collect('dist');
await collect('py_modules');
if (!entries.some(e => e.name === 'dist/index.js')) throw new Error('Build dist/index.js first');

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
const chunks = [], directory = [];
let offset = 0;
for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
  const data = await readFile(path.join(root, entry.source));
  const compressed = deflateRawSync(data, { level: 9 });
  const name = Buffer.from(`${pluginDir}/${entry.name}`);
  const crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x800, 6); // UTF-8
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt16LE(0x21, 12); // 1980-01-01, reproducible build
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  chunks.push(header, name, compressed);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(0x314, 4); // ZIP 2.0, Unix
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(0x21, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  central.writeUInt32LE(offset, 42);
  directory.push(central, name);
  offset += header.length + name.length + compressed.length;
}
const centralSize = directory.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
const outputDir = path.join(root, 'release');
await mkdir(outputDir, { recursive: true });
const output = path.join(outputDir, `SDH-GameSync-${pkg.version}.zip`);
await writeFile(output, Buffer.concat([...chunks, ...directory, end]));
console.log(`Packaged ${entries.length} files: ${output}`);
