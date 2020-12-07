const fs = require('fs');
const { readScFile, readOldScFile } = require('./src/sc/scFormat');

const main = async () => {
  fs.rmdirSync('out', { recursive: true });
  // const scFiles = fs.readdirSync('sc');
  // scFiles.forEach((scFile) => {
  //   if (!scFile.endsWith('_tex.sc')) {
  //     readScFile(scFile.substring(0, scFile.indexOf('.sc')));
  //   }
  // });
  readScFile('events');
  // readScFile('loading');
  // readScFile('debug');
  // readOldScFile('overlay');
  // readScFile('background_basic');
};

main();
