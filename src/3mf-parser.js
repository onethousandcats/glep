'use strict';

const AdmZip    = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

function parse3mf(filePath) {
  const zip   = new AdmZip(filePath);
  const entry = zip.getEntry('3D/3dmodel.model');
  if (!entry) return null;

  const xml = entry.getData().toString('utf8');
  const parser = new XMLParser({
    ignoreAttributes:   false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
  });

  const doc = parser.parse(xml);
  const resources = doc?.model?.resources;
  if (!resources) return null;

  let objects = resources.object;
  if (!objects) return null;
  if (!Array.isArray(objects)) objects = [objects];

  const positions = [];
  const indices   = [];
  let   vertexOffset = 0;

  for (const obj of objects) {
    const mesh = obj.mesh;
    if (!mesh) continue;

    let verts = mesh.vertices?.vertex;
    let tris  = mesh.triangles?.triangle;
    if (!verts || !tris) continue;
    if (!Array.isArray(verts)) verts = [verts];
    if (!Array.isArray(tris))  tris  = [tris];

    for (const v of verts)
      positions.push(Number(v.x), Number(v.y), Number(v.z));

    for (const t of tris)
      indices.push(Number(t.v1) + vertexOffset, Number(t.v2) + vertexOffset, Number(t.v3) + vertexOffset);

    vertexOffset += verts.length;
  }

  return positions.length ? { positions, normals: null, indices } : null;
}

module.exports = { parse3mf };
