'use strict';

const fs = require('node:fs');

function parseObj(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const verts    = []; // raw [x, y, z] from "v" lines
  const indices  = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    switch (parts[0]) {
      case 'v':
        verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        break;

      case 'f': {
        // Each token is v, v/vt, v//vn, or v/vt/vn — we only need the vertex index.
        // OBJ indices are 1-based; negative values index from the end.
        const total = verts.length / 3;
        const fv = parts.slice(1).map(token => {
          const i = parseInt(token.split('/')[0]);
          return i < 0 ? total + i : i - 1; // normalise to 0-based
        });
        // Fan-triangulate quads and n-gons: (0,1,2), (0,2,3), ...
        for (let i = 1; i < fv.length - 1; i++)
          indices.push(fv[0], fv[i], fv[i + 1]);
        break;
      }
    }
  }

  return verts.length ? { positions: verts, normals: null, indices } : null;
}

module.exports = { parseObj };
