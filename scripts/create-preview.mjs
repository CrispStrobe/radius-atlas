// SPDX-License-Identifier: MIT
// Illustrative software-test fixtures, NOT a GeoNames extract or a verified geographic dataset.
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const items = [
 ['DE','Kehl','77694',48.5725,7.8131],
 ['DE','Willstätt','77731',48.5407,7.8931],
 ['DE','Appenweier','77767',48.5410,7.9790],
 ['DE','Offenburg','77652',48.4790,7.9400],
 ['DE','Offenburg','77654',48.4730,7.9570],
 ['DE','Offenburg','77656',48.4490,7.9320],
 ['DE','Rheinau','77866',48.6660,7.9360],
 ['DE','Renchen','77871',48.5850,8.0120],
 ['DE','Durbach','77770',48.4940,8.0200],
 ['DE','Oberkirch','77704',48.5310,8.0790],
 ['DE','Schutterwald','77746',48.4550,7.8860],
 ['DE','Neuried','77743',48.4650,7.8030],
 ['DE','Hohberg','77749',48.4180,7.9090],
 ['DE','Schwanau','77963',48.3510,7.7620],
 ['DE','Lahr','77933',48.3400,7.8740],
 ['DE','Gengenbach','77723',48.4050,8.0170],
 ['DE','Friesenheim','77948',48.3740,7.8860],
 ['DE','Achern','77855',48.6310,8.0730],
 ['DE','Sasbach','77880',48.6380,8.0930],
 ['DE','Kappelrodeck','77876',48.5920,8.1180],
 ['DE','Ottenhöfen','77883',48.5670,8.1540],
 ['DE','Bühl','77815',48.6970,8.1360],
 ['DE','Baden-Baden','76530',48.7600,8.2400],
 ['DE','Freiburg im Breisgau','79098',47.9960,7.8500],
 ['DE','Dresden','01067',51.0510,13.7370],
 ['DE','Berlin','10115',52.5320,13.3850],
 ['FR','Strasbourg','67000',48.5840,7.7480],
 ['FR','Strasbourg','67100',48.5510,7.7540],
 ['FR','Strasbourg','67200',48.5910,7.7120],
 ['FR','Schiltigheim','67300',48.6080,7.7500],
 ['FR','Bischheim','67800',48.6160,7.7540],
 ['FR','Hœnheim','67800',48.6230,7.7550],
 ['FR','Illkirch-Graffenstaden','67400',48.5290,7.7110],
 ['FR','Lingolsheim','67380',48.5570,7.6820],
 ['FR','La Wantzenau','67610',48.6580,7.8270],
 ['FR','Brumath','67170',48.7310,7.7100],
 ['FR','Erstein','67150',48.4230,7.6620],
 ['FR','Obernai','67210',48.4630,7.4810],
 ['FR','Haguenau','67500',48.8150,7.7910]
];
const records = items.map(([country,place,postalCode,latitude,longitude], i) => ({ id:`preview-${i+1}`,country,place,postalCode,latitude,longitude,accuracy:null,
  adminCodes:country === 'DE' ? [place === 'Dresden' ? 'SN' : place === 'Berlin' ? 'BE' : 'BW','preview','preview'] : ['44','preview','preview'],
  adminArea1:country === 'DE' ? (place === 'Dresden' ? 'Sachsen' : place === 'Berlin' ? 'Berlin' : 'Baden-Württemberg') : 'Grand Est',
  adminArea2:'Illustrative fixture',adminArea3:'Not an official administrative assignment' }));
const dataset = { schemaVersion:1,meta:{title:'Illustrative Kehl-area software preview',coverage:'illustrative-fixture',countries:['DE','FR'],recordCount:records.length,
  source:'Radius Atlas illustrative test fixtures',sourceUrl:'./docs/preview-data.md',license:'CC-BY-4.0',licenseUrl:'https://creativecommons.org/licenses/by/4.0/',
  attribution:'Illustrative test data: Christian Ströbele and Radius Atlas contributors, CC BY 4.0. These are not GeoNames records and are not a verified or complete geographic dataset.',
  retrievedAt:null,createdAt:'2026-09-22',changes:'Manually constructed software-test fixtures using approximate locations and example postal codes; no source-dataset completeness or accuracy claim.',
  warning:'Never use this preview as the answer to a real geographic query. Replace it with npm run data:refresh. Administrative codes intentionally contain the string preview.'},records};
await writeFile(resolve(import.meta.dirname,'../public/data/dataset.json'),JSON.stringify(dataset,null,2)+'\n');
console.log(`Created ${records.length} clearly labelled illustrative fixtures.`);
