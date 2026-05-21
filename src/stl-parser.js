'use strict';

const fs = require('node:fs');

function isBinaryStl(buf) {
  if (buf.length < 84) return false;
  const count = buf.readUInt32LE(80);
  return buf.length === 80 + 4 + count * 50;
}

function parseBinary(buf) {
  const count = buf.readUInt32LE(80);
  const positions = [];
  const normals   = [];
  let offset = 84;

  for (let i = 0; i < count; i++) {
    const nx = buf.readFloatLE(offset);
    const ny = buf.readFloatLE(offset + 4);
    const nz = buf.readFloatLE(offset + 8);
    offset += 12;

    for (let v = 0; v < 3; v++) {
      positions.push(buf.readFloatLE(offset), buf.readFloatLE(offset + 4), buf.readFloatLE(offset + 8));
      normals.push(nx, ny, nz);
      offset += 12;
    }
    offset += 2; // attribute byte count
  }

  return { positions, normals, indices: null };
}

function parseAscii(text) {
  const positions = [];
  const normals   = [];
  let nx = 0, ny = 0, nz = 0;

  for (const line of text.split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'facet' && parts[1] === 'normal') {
      nx = parseFloat(parts[2]);
      ny = parseFloat(parts[3]);
      nz = parseFloat(parts[4]);
    } else if (parts[0] === 'vertex') {
      positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      normals.push(nx, ny, nz);
    }
  }

  return { positions, normals, indices: null };
}

function parseStl(filePath) {
  const buf = fs.readFileSync(filePath);
  return isBinaryStl(buf) ? parseBinary(buf) : parseAscii(buf.toString('utf8'));
}

module.exports = { parseStl };
