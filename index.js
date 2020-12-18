const fs = require('fs');
require('./src/sc/scBuffer');
const { readScFile } = require('./src/sc/scFormat');
const logger = require('./logger');

const main = async () => {
  fs.rmdirSync('out', { recursive: true });
  fs.mkdirSync('out/Hay Day/1_49_4', { recursive: true });
  fs.mkdirSync('out/sc', { recursive: true });
  fs.mkdirSync('out/sccoc', { recursive: true });
  const startTime = new Date().getTime();
  const promises = [];
  // const scFiles = fs.readdirSync('Hay Day/1_49_4');
  // scFiles.forEach((scFile) => {
  //   if (!scFile.endsWith('_tex.sc')) {
  //     promises.push(readScFile(`Hay Day/1_49_4/${scFile.substring(0, scFile.indexOf('.sc'))}`));
  //   }
  // });

  // const scFiles = fs.readdirSync('sc');
  // scFiles.forEach((scFile) => {
  //   if (!scFile.endsWith('_tex.sc')) {
  //     promises.push(readScFile(`sc/${scFile.substring(0, scFile.indexOf('.sc'))}`));
  //   }
  // });

  // const scFiles = fs.readdirSync('sccoc');
  // scFiles.forEach((scFile) => {
  //   if (!scFile.endsWith('_tex.sc')) {
  //     promises.push(readScFile(`sccoc/${scFile.substring(0, scFile.indexOf('.sc'))}`));
  //   }
  // });

  // promises.push(readScFile('sc/effects_brawler'));
  // promises.push(readScFile('Hay Day/1_49_4/common'));
  // promises.push(readScFile('Hay Day/1_49_4/supercell_id'));
  promises.push(readScFile('sc/events'));
  // promises.push(readScFile('characters'));
  // promises.push(readScFile('sc/supercell_id'));
  // promises.push(readScFile('sc/loading'));
  // promises.push(readScFile('sc/level'));
  // promises.push(readScFile('sc/ui'));
  // promises.push(readScFile('sc/debug'));
  // promises.push(readScFile('background_basic'));
  // promises.push(readScFile('sccoc/background_npc'));

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
