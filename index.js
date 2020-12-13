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
  // readScFile('loading');
  // readScFile('level');
  // readScFile('ui');
  // readScFile('debug');
  readScFile('background_basic');
  // readScFile('background_snowtel');
  // readOldScFile('overlay');

  // const sharp = require('sharp');
  // const ex = await sharp('./out/background_basic-shape0.png').extend({
  //   top: 0,
  //   bottom: 0,
  //   left: 50,
  //   right: 0,
  //   background: '#00000000',
  // }).raw().toBuffer({ resolveWithObject: true });
  // sharp(ex.data, { raw: { channels: ex.info.channels, width: ex.info.width, height: ex.info.height } })
  //   .affine([1, 0, 0, 1], { odx: -50, ody: 0, background: '#00000000' })
  //   .toFile('bananaaaaa.png');
};

main();
