const fs = require('fs');
const { SmartBuffer } = require('smart-buffer');
const logger = require('../../logger');

const shapeSection = require('./sections/shape');
const textFieldSection = require('./sections/textField');
const colorVariationSection = require('./sections/colorVariation');
const transformMatrixSection = require('./sections/transformMatrix');
const textureSection = require('./sections/texture');
const movieClipSection = require('./sections/movieClip');

const addResource = (resources, resource) => {
  resources[resource.exportId] = resource;
};

const readNormalScFile = (filename, buffer, textures, isOld = false) => {
  logger.info(`Starting ${filename}`);
  const resources = {};
  const transformMatrices = [];
  const colorTransforms = [];
  let shapesCount = 0;
  let movieClipsCount = 0;
  const texturesCount = 0;
  let textFieldsCount = 0;

  const totalShapes = buffer.readUInt16LE();
  const totalMovieClips = buffer.readUInt16LE();
  const totalTextures = buffer.readUInt16LE();
  const totalTextFields = buffer.readUInt16LE();
  const totalTransformMatrices = buffer.readUInt16LE();
  const totalColorTransforms = buffer.readUInt16LE();

  // Not used, probably for padding
  buffer.readBuffer(5);

  const numberOfExports = buffer.readUInt16LE();
  const exportsIds = [];
  const exports = {};

  for (let i = 0; i < numberOfExports; i++) {
    exportsIds.push(buffer.readUInt16LE());
  }

  for (let i = 0; i < numberOfExports; i++) {
    const exportName = buffer.scReadString();
    logger.debug(`${exportsIds[i].toString()} - ${exportName}`);
    exports[exportsIds[i]] = exportName;
  }

  // some block?
  if (!isOld) {
    const uselessBlock = buffer.readUInt8();
    if (uselessBlock === 0x17) {
      buffer.readBuffer(0x13);
    } else if (uselessBlock === 0x1a) {
      buffer.readBuffer(0xe);
    }
  }

  let blockSize;
  let i = 0;
  while (blockSize !== 0) {
    const blockType = buffer.readUInt8();
    blockSize = buffer.readUInt32LE();

    if (blockSize === 0) {
      break;
    }

    // if (i === 1) {
    //   break;
    // }

    switch (blockType) {
      case 0x07:
      case 0x0f:
      case 0x14:
      case 0x15:
      case 0x19:
      case 0x21:
      case 0x2c:
        textFieldsCount += 1;
        if (textFieldsCount > totalTextFields) {
          logger.error('Reading too many text fields');
        }
        addResource(resources, textFieldSection.readTextField(buffer, blockType));
        break;
      case 0x08:
        if (transformMatrices.length >= totalTransformMatrices) {
          logger.error('Reading too many transform matrices');
        }
        transformMatrices.push(transformMatrixSection.readTransformMatrix(buffer));
        break;
      case 0x09:
        if (colorTransforms.length >= totalColorTransforms) {
          logger.error('Reading too many color transforms');
        }
        colorTransforms.push(colorVariationSection.readColorTransform(buffer));
        break;
      case 0x03:
      case 0x0a:
      case 0x0c:
      case 0x0e:
      case 0x23:
        movieClipsCount += 1;
        if (movieClipsCount > totalMovieClips) {
          logger.error('Reading too many movie clips');
        }
        addResource(resources, movieClipSection.readMovieClip(buffer));
        break;
      case 0x02:
      case 0x12:
        shapesCount += 1;
        if (shapesCount > totalShapes) {
          logger.error('Reading too many shapes');
        }
        if (isOld) {
          buffer.readBuffer(blockSize);
        } else {
          addResource(resources, shapeSection.readShape(buffer, textures));
        }
        break;
      default: {
        const block = buffer.readBuffer(blockSize);
        logger.debug(
          `${i} Block type: ${blockType.toString(
            16,
          )}. Size: ${blockSize}. Data: ${block.slice(0, 20).toString('hex')}`,
        );
      }
    }
    i++;
  }

  logger.info(`Finished reading file sections. Number of sections: ${i}, filename: ${filename}`);
  return { resources, colorMatrices: colorTransforms, transformMatrices };
};

const getScBuffer = async (scFileName) => {
  const buffer = SmartBuffer.fromBuffer(fs.readFileSync(`sc/${scFileName}.sc`));
  const decompressedScFile = await buffer.scDecompress();

  if (!buffer.scCheckValidity(decompressedScFile)) {
    logger.error(`${scFileName} is corrupted. Skipping.`);
  }

  return decompressedScFile;
};

const getOldScBuffer = async (scFileName) => {
  const buffer = SmartBuffer.fromBuffer(fs.readFileSync(`sccoc/${scFileName}.sc`));
  return buffer.scOldDecompress();
};

const readScFile = async (scFileName) => {
  const textures = textureSection.readTextures(scFileName, await getScBuffer(`${scFileName}_tex`));
  const scFileContent = readNormalScFile(scFileName, await getScBuffer(scFileName), textures);
  await movieClipSection.createMovieClips(
    scFileContent.transformMatrices,
    scFileContent.colorMatrices,
    textures,
    scFileContent.resources,
  );
};

const readOldScFile = async (scFileName) => {
  const scFileContent = readNormalScFile(scFileName, await getOldScBuffer(scFileName), null, true);
  // await movieClipSection.createMovieClips(
  //   scFileContent.transformMatrices,
  //   scFileContent.colorMatrices,
  //   textures,
  //   scFileContent.resources,
  // );
};

module.exports = {
  readScFile,
  readOldScFile,
};
