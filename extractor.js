/* eslint-disable no-nested-ternary */
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const pLimit = require('p-limit');
const { readScFile } = require('./src/sc/scFormat');
const logger = require('./logger');
const lzham = require('./src/lzham');

const { argv } = yargs(hideBin(process.argv));

const getAllFilesRecursively = (folder) => {
  const files = fs.readdirSync(folder, { withFileTypes: true });
  const allFiles = [];
  files.forEach((file) => {
    if (file.isDirectory()) {
      allFiles.push(...getAllFilesRecursively(`${folder}/${file.name}`));
    } else if (file.name.endsWith('.sc') && !file.name.endsWith('_tex.sc')) {
      allFiles.push(`${folder}/${file.name}`);
    }
  });

  return allFiles;
};

const main = async () => {
  await lzham.init();
  const startTime = new Date().getTime();
  const promises = [];
  const filesToExtract = !argv.file ? [] : (Array.isArray(argv.file) ? argv.file : [argv.file]);
  const folders = !argv.folder ? [] : (Array.isArray(argv.folder) ? argv.folder : [argv.folder]);
  const { extractMovieClips } = argv;

  folders.forEach((folder) => {
    // fs.rmSync(folder, { recursive: true });
    // fs.mkdirSync(folder, { recursive: true });
    filesToExtract.push(...getAllFilesRecursively(folder));
  });

  if (fs.existsSync('out')) {
    fs.rmSync('out', { recursive: true });
  }

  const limit = pLimit(1);

  // filesToExtract.forEach((scFile) => {
  //   fs.mkdirSync(`out/${scFile.substring(0, scFile.lastIndexOf('/'))}`, { recursive: true });
  //   promises.push(limit(() => readScFile(`${scFile.substring(0, scFile.indexOf('.sc'))}`)));
  // });

  for (let i = 0; i < filesToExtract.length; i += 1) {
    const scFile = filesToExtract[i];
    fs.mkdirSync(`out/${scFile.substring(0, scFile.lastIndexOf('/'))}`, { recursive: true });
    await readScFile(`${scFile.substring(0, scFile.indexOf('.sc'))}`, extractMovieClips);
  }

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
