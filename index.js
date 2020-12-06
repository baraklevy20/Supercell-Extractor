const fs = require('fs');
const readScFile = require('./src/sc/scFormat');

const main = async () => {
  fs.rmdirSync('out', { recursive: true });
  // const scFiles = fs.readdirSync('sc');
  // scFiles.forEach((scFile) => {
  //   if (!scFile.endsWith('_tex.sc')) {
  //     readScFile(scFile.substring(0, scFile.indexOf('.sc')));
  //   }
  // });
  readScFile('debug');
};

main();
