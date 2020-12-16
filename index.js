const fs = require('fs');
require('./src/sc/scBuffer');
const { readScFile, readOldScFile } = require('./src/sc/scFormat');

const main = async () => {
  fs.rmdirSync('out', { recursive: true });
  fs.mkdirSync('out');
  // const scFiles = fs.readdirSync('sc');
  // scFiles.forEach((scFile) => {
  //   if (!scFile.endsWith('_tex.sc')) {
  //     readScFile(scFile.substring(0, scFile.indexOf('.sc')));
  //   }
  // });
  // readScFile('effects_brawler');
  // readScFile('events');
  // readScFile('characters');
  // readScFile('supercell_id'); // lots of gradients
  readScFile('loading');
  // readScFile('level');
  // readScFile('ui');
  // readScFile('debug');
  // readScFile('background_basic');
  // readScFile('background_snowtel');
  // readOldScFile('overlay');

  // const sharp = require('sharp');
  // const ex = await sharp('./out/background_basic-texture2.png').metadata();
};

main();
