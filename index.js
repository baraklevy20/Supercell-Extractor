const fs = require('fs');
require('./src/sc/scBuffer');
const { readScFile, readOldScFile } = require('./src/sc/scFormat');
const logger = require('./logger');

const main = async () => {
  fs.rmdirSync('out', { recursive: true });
  fs.mkdirSync('out/Hay Day/1_49_4', { recursive: true });
  const startTime = new Date().getTime();
  const promises = [];
  const scFiles = fs.readdirSync('Hay Day/1_49_4');
  scFiles.forEach((scFile) => {
    if (!scFile.endsWith('_tex.sc')) {
      promises.push(readScFile(`Hay Day/1_49_4/${scFile.substring(0, scFile.indexOf('.sc'))}`));
    }
  });

  // promises.push(readScFile('effects_brawler'));
  // promises.push(readScFile('Hay Day/1_49_4/order_images'));
  // promises.push(readScFile('events'));
  // promises.push(readScFile('characters'));
  // promises.push(readScFile('supercell_id'));
  // promises.push(readScFile('loading'));
  // promises.push(readScFile('level'));
  // promises.push(readScFile('ui'));
  // promises.push(readScFile('debug'));
  // promises.push(readScFile('background_basic'));
  // promises.push(readScFile('background_snowtel'));
  // readOldScFile('overlay');

  // const sharp = require('sharp');
  // const ex = await sharp('./out/background_basic-texture2.png').metadata();
  const results = await Promise.allSettled(promises);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      // logger.error(result.reason);
      console.error(result.reason);
    }
  });
  console.log(`extract all time - ${new Date().getTime() - startTime}ms`);
};

main();
