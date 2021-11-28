/* eslint-disable no-nested-ternary */
const fs = require('fs');
require('./src/sc/scBuffer');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { readScFile } = require('./src/sc/scFormat');
const logger = require('./logger');
const lzham = require('./src/lzham');

const { argv } = yargs(hideBin(process.argv));

const main = async () => {
  await lzham.init();
  const startTime = new Date().getTime();
  const promises = [];
  const filesToExtract = !argv.file ? [] : (Array.isArray(argv.file) ? argv.file : [argv.file]);
  const folders = !argv.folder ? [] : (Array.isArray(argv.folder) ? argv.folder : [argv.folder]);

  folders.forEach((folder) => {
    // fs.rmSync(folder, { recursive: true });
    // fs.mkdirSync(folder, { recursive: true });
    const scFiles = fs.readdirSync(folder);
    scFiles.forEach((scFile) => {
      if (!scFile.endsWith('_tex.sc')) {
        filesToExtract.push(`${folder}/${scFile}`);
      }
    });
  });

  if (fs.existsSync('out')) {
    fs.rmSync('out', { recursive: true });
  }

  filesToExtract.forEach((scFile) => {
    fs.mkdirSync(`out/${scFile.substring(0, scFile.lastIndexOf('/'))}`, { recursive: true });
    fs.mkdirSync(`sc_out/${scFile.substring(0, scFile.lastIndexOf('/'))}`, { recursive: true });
    promises.push(readScFile(`${scFile.substring(0, scFile.indexOf('.sc'))}`));
  });

  // const sharp = require('sharp');
  // const ex = await sharp('./out/sc/background_basic-shape0.png')
  //   .affine([1, 0, 0, 1], { background: 'black', odx: 20 })
  //   .affine([1, 0, 0, 1], { background: 'black', odx: -20 })
  //   .toFile('result.png');
  const results = await Promise.allSettled(promises);
  // const results = await Promise.all(promises);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      // logger.error(result.reason);
      console.error(result.reason);
    }
  });
  console.log(`extract all time - ${new Date().getTime() - startTime}ms`);
};

main();
