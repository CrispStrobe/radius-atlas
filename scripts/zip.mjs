// SPDX-License-Identifier: MIT
import { inflateRawSync } from 'node:zlib';
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) { crc ^= b; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
/** Read one named entry from a normal ZIP (stored or deflated). No extraction to disk. */
export function unzipEntry(buffer, filename, maxBytes = 64 * 1024 * 1024) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) throw new Error('Invalid ZIP archive.');
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50 && i + 22 + buffer.readUInt16LE(i + 20) === buffer.length) { end = i; break; }
  }
  if (end < 0 || buffer.readUInt16LE(end + 4) || buffer.readUInt16LE(end + 6)) throw new Error('Unsupported ZIP archive.');
  const entries = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  if (entries === 65535 || cursor === 0xffffffff) throw new Error('ZIP64 is not supported.');
  for (let n = 0; n < entries; n++) {
    if (cursor + 46 > end || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Corrupt ZIP directory.');
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16), packed = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24);
    const nameLen = buffer.readUInt16LE(cursor + 28), extraLen = buffer.readUInt16LE(cursor + 30), commentLen = buffer.readUInt16LE(cursor + 32);
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
    const local = buffer.readUInt32LE(cursor + 42);
    cursor += 46 + nameLen + extraLen + commentLen;
    if (name !== filename) continue;
    if (flags & 1 || size > maxBytes || ![0, 8].includes(method)) throw new Error('Encrypted, oversized or unsupported ZIP entry.');
    if (local + 30 > end || buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('Corrupt ZIP entry.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    if (start + packed > end) throw new Error('Truncated ZIP entry.');
    const bytes = buffer.subarray(start, start + packed);
    const decoded = method === 8 ? inflateRawSync(bytes, { maxOutputLength: maxBytes }) : bytes;
    if (decoded.length !== size || crc32(decoded) !== checksum) throw new Error('ZIP checksum/length mismatch.');
    return decoded.toString('utf8');
  }
  throw new Error(`ZIP entry not found: ${filename}`);
}
