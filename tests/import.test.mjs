// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { unzipEntry, crc32 } from '../scripts/zip.mjs';
import { parseGeoNames, makeDataset } from '../scripts/import-geonames.mjs';
function zipFile(name,text,method=8){
 const filename=Buffer.from(name),raw=Buffer.from(text),body=method===8?deflateRawSync(raw):raw;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(method,8);local.writeUInt32LE(crc32(raw),14);local.writeUInt32LE(body.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(filename.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,6);central.writeUInt16LE(method,10);central.writeUInt32LE(crc32(raw),16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(raw.length,24);central.writeUInt16LE(filename.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(local.length+filename.length+body.length,16);
 return Buffer.concat([local,filename,body,central,filename,end]);
}
const line='DE\t01067\tDresden\tSachsen\tSN\tRegion\t14\tDistrict\t14612\t51.05\t13.74\t4';
test('stored and deflated ZIP entries round-trip',()=>{for(const method of [0,8])assert.equal(unzipEntry(zipFile('DE.txt',line,method),'DE.txt'),line)});
test('missing, corrupt and oversized ZIPs fail',()=>{
 assert.throws(()=>unzipEntry(Buffer.from('bad'),'DE.txt'));assert.throws(()=>unzipEntry(zipFile('DE.txt',line),'FR.txt'));
 assert.throws(()=>unzipEntry(zipFile('DE.txt',line),'DE.txt',4));
 const corrupt=zipFile('DE.txt',line,0);corrupt[36]^=1;assert.throws(()=>unzipEntry(corrupt,'DE.txt'));
});
test('TSV import keeps postcode strings, Unicode, coordinates and source admin codes',()=>{
 const imported=parseGeoNames(line+'\n'+line.replace('Dresden','Dresden-Äußere'),'DE');
 assert.equal(imported.records.length,2);assert.equal(imported.records[0].postalCode,'01067');assert.equal(imported.records[0].latitude,51.05);
 assert.deepEqual(imported.records[0].adminCodes,['SN','14','14612']);assert.equal(imported.records[0].accuracy,4);
});
test('missing coordinates do not become zero; duplicates and malformed rows reported',()=>{
 const input=line+'\n'+line+'\n'+line.replace('\t51.05\t','\t\t')+'\n'+'bad';
 const parsed=parseGeoNames(input,'DE');assert.equal(parsed.records.length,1);assert.equal(parsed.duplicates,1);assert.equal(parsed.rejected,2);
});
test('country-file dataset retains source, modification and retrieval metadata',()=>{
 const dataset=makeDataset([parseGeoNames(line,'DE')],{retrievedAt:'2026-09-22T00:00:00Z',archives:[]});
 assert.equal(dataset.meta.license,'CC-BY-4.0');assert.equal(dataset.meta.coverage,'country-files');assert.ok(dataset.meta.changes);assert.equal(dataset.records.length,1);
});
test('stable record IDs do not depend on input order',()=>{const second=line.replace('01067','01069');
 const a=parseGeoNames(line+'\n'+second,'DE'),b=parseGeoNames(second+'\n'+line,'DE');assert.equal(a.records[0].id,b.records[1].id);
});
