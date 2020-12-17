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
  // eslint-disable-next-line no-param-reassign
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

  for (let i = 0; i < numberOfExports; i += 1) {
    exportsIds.push(buffer.readUInt16LE());
  }

  for (let i = 0; i < numberOfExports; i += 1) {
    const exportName = buffer.scReadString();
    // logger.debug(`${exportsIds[i].toString()} - ${exportName}`);
    exports[exportsIds[i]] = exportName;
  }

  let blockType;
  let i = 0;

  // A flag used to indicate if the current sc file has a corresponding _tex file
  let hasTexFile = false;

  // A flag used to indicate if the current file contains debug info. Not used in the extractor
  let isDebugFile = false;
  while (blockType !== 0) {
    blockType = buffer.readUInt8();
    const blockSize = buffer.readUInt32LE();

    if (blockType === 0) {
      break;
    }

    switch (blockType) {
      case 0x17:
        hasTexFile = true;
        break;
      case 0x1a:
        // eslint-disable-next-line no-unused-vars
        isDebugFile = true;
        break;
      case 0x07:
      case 0x0f:
      case 0x14:
      case 0x15:
      case 0x19:
      case 0x21:
      case 0x2c:
        textFieldsCount += 1;
        if (textFieldsCount > totalTextFields) {
          logger.error(`${filename} - Reading too many text fields`);
        }
        addResource(resources, textFieldSection.readTextField(buffer, blockType));
        break;
      case 0x08:
        transformMatrices.push(transformMatrixSection.readTransformMatrix(buffer));
        break;
      case 0x09:
        colorTransforms.push(colorVariationSection.readColorTransform(buffer));
        break;
      case 0x03:
      case 0x0a:
      case 0x0c:
      case 0x0e:
      case 0x23:
        movieClipsCount += 1;
        if (movieClipsCount > totalMovieClips) {
          logger.error(`${filename} - Reading too many movie clips`);
        }
        addResource(resources, movieClipSection.readMovieClip(buffer));
        break;
      case 0x02:
      case 0x12:
        shapesCount += 1;
        if (shapesCount > totalShapes) {
          logger.error(`${filename} - Reading too many shapes`);
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
    i += 1;
  }

  logger.info(`Finished reading file sections. Number of sections: ${i}, filename: ${filename}`);
  return { resources, colorMatrices: colorTransforms, transformMatrices };
};

const getScBuffer = async (scFileName) => {
  const buffer = SmartBuffer.fromBuffer(fs.readFileSync(`${scFileName}.sc`));
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

const readScFile = async (fileName) => {
  const textures = textureSection.readTextures(fileName, await getScBuffer(`${fileName}_tex`));
  const scFileContent = readNormalScFile(fileName, await getScBuffer(fileName), textures);
  // const shapes = await shapeSection.extractShapes(fileName, textures, [scFileContent.resources[0]]);
  // const shapes = await shapeSection.extractShapes(fileName, textures, scFileContent.resources);
  // await movieClipSection.createMovieClips(
  //   fileName,
  //   scFileContent.transformMatrices,
  //   scFileContent.colorMatrices,
  //   scFileContent.resources,
  //   shapes,
  // );
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
