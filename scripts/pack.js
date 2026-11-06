#!/usr/bin/env node

/**
 * Cross-platform extension packager
 * Generates .zip and .xpi files with zero third-party dependencies.
 * Works on macOS (zsh), Linux (bash), and Windows (PowerShell/CMD).
 */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Files and folders to include
const INCLUDED_ENTRIES = [
  'manifest.json',
  'content',
  'popup',
  'options',
  'icons'
];

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[i] = c >>> 0;
}

function calculateCrc32(buffer) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

// Convert Date to MS-DOS date and time format
function getDosDateTime(date = new Date()) {
  const d = date || new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
  const dateVal = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date: dateVal };
}

// Collect all files recursively
function collectFiles(baseDir) {
  const collected = [];

  for (const entry of INCLUDED_ENTRIES) {
    const fullPath = path.join(baseDir, entry);
    if (!fs.existsSync(fullPath)) continue;

    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      collected.push({
        relativePath: entry,
        fullPath,
        mtime: stat.mtime
      });
    } else if (stat.isDirectory()) {
      function walk(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file === '.DS_Store' || file === 'Thumbs.db') continue;
          const subPath = path.join(dir, file);
          const subStat = fs.statSync(subPath);
          if (subStat.isDirectory()) {
            walk(subPath);
          } else {
            const rel = path.relative(baseDir, subPath).replace(/\\/g, '/');
            collected.push({
              relativePath: rel,
              fullPath: subPath,
              mtime: subStat.mtime
            });
          }
        }
      }
      walk(fullPath);
    }
  }

  return collected;
}

// Build standard Zip buffer
function buildZipBuffer(fileList) {
  const buffers = [];
  const centralDir = [];
  let offset = 0;

  for (const file of fileList) {
    const fileData = fs.readFileSync(file.fullPath);
    const nameBuf = Buffer.from(file.relativePath, 'utf8');
    const compressed = zlib.deflateRawSync(fileData, { level: 9 });
    const crc = calculateCrc32(fileData);
    const uncompressedSize = fileData.length;
    const compressedSize = compressed.length;
    const { time, date } = getDosDateTime(file.mtime);

    // Local file header (30 bytes)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);          // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0, 6);           // General purpose bit flag
    localHeader.writeUInt16LE(8, 8);           // Compression method (8 = Deflate)
    localHeader.writeUInt16LE(time, 10);       // Last mod file time
    localHeader.writeUInt16LE(date, 12);       // Last mod file date
    localHeader.writeUInt32LE(crc, 14);        // CRC-32
    localHeader.writeUInt32LE(compressedSize, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);          // Extra field length

    buffers.push(localHeader, nameBuf, compressed);

    // Central directory file header (46 bytes)
    const cdHeader = Buffer.alloc(46);
    cdHeader.writeUInt32LE(0x02014b50, 0);    // Central directory header signature
    cdHeader.writeUInt16LE(20, 4);             // Version made by
    cdHeader.writeUInt16LE(20, 6);             // Version needed to extract
    cdHeader.writeUInt16LE(0, 8);              // General purpose bit flag
    cdHeader.writeUInt16LE(8, 10);             // Compression method (Deflate)
    cdHeader.writeUInt16LE(time, 12);          // File time
    cdHeader.writeUInt16LE(date, 14);          // File date
    cdHeader.writeUInt32LE(crc, 16);           // CRC-32
    cdHeader.writeUInt32LE(compressedSize, 20);
    cdHeader.writeUInt32LE(uncompressedSize, 24);
    cdHeader.writeUInt16LE(nameBuf.length, 28);
    cdHeader.writeUInt16LE(0, 30);             // Extra field length
    cdHeader.writeUInt16LE(0, 32);             // File comment length
    cdHeader.writeUInt16LE(0, 34);             // Disk number start
    cdHeader.writeUInt16LE(0, 36);             // Internal file attributes
    cdHeader.writeUInt32LE(0, 38);             // External file attributes
    cdHeader.writeUInt32LE(offset, 42);        // Relative offset of local header

    centralDir.push(cdHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const b of centralDir) {
    cdSize += b.length;
  }

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);           // EOCD signature
  eocd.writeUInt16LE(0, 4);                    // Number of this disk
  eocd.writeUInt16LE(0, 6);                    // Disk where CD starts
  eocd.writeUInt16LE(fileList.length, 8);      // Number of CD entries on this disk
  eocd.writeUInt16LE(fileList.length, 10);     // Total number of CD entries
  eocd.writeUInt32LE(cdSize, 12);              // Size of central directory
  eocd.writeUInt32LE(cdOffset, 16);            // Offset of CD with respect to starting disk
  eocd.writeUInt16LE(0, 20);                   // Comment length

  return Buffer.concat([...buffers, ...centralDir, eocd]);
}

function run() {
  console.log('Packaging extension...');

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  const files = collectFiles(ROOT_DIR);
  console.log(`Found ${files.length} files to package:`);
  for (const f of files) {
    console.log(`  + ${f.relativePath}`);
  }

  const zipBuffer = buildZipBuffer(files);

  const zipPath = path.join(DIST_DIR, 'youtube-ban-words.zip');
  const xpiPath = path.join(DIST_DIR, 'youtube-ban-words.xpi');

  fs.writeFileSync(zipPath, zipBuffer);
  fs.writeFileSync(xpiPath, zipBuffer);

  const sizeKb = (zipBuffer.length / 1024).toFixed(1);
  console.log(`\nSuccessfully created packages (${sizeKb} KB):`);
  console.log(`  -> dist/youtube-ban-words.zip (for Chrome / Edge / Web Store)`);
  console.log(`  -> dist/youtube-ban-words.xpi (for Firefox / Zen Browser)`);
}

run();
