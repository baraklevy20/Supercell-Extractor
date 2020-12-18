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

const getScBuffer = async (scFileName) => {
  const buffer = SmartBuffer.fromBuffer(fs.readFileSync(`${scFileName}.sc`));
  const decompressedScFile = await buffer.scDecompress();
  fs.writeFileSync(`sc_out/${scFileName}.sc`, decompressedScFile.internalBuffer);

  if (!buffer.scCheckValidity(decompressedScFile)) {
    logger.error(`${scFileName} is corrupted. Skipping.`);
  }

  return decompressedScFile;
};

const getTextureBuffer = async (
  buffer,
  filename,
  hasExternalTexFile,
  hasHighResTexFile,
  hasLowResTexFile,
) => {
  if (hasExternalTexFile) {
    if (hasHighResTexFile) {
      return getScBuffer(`${filename}_tex`);
    }
    if (hasLowResTexFile) {
      return getScBuffer(`${filename}_lowres_tex`);
    }
    throw Error('External file but no high nor low res texture files');
  }

  return buffer;
};

const readNormalScFile = async (filename, buffer) => {
  logger.info(`Starting ${filename}`);
  const resources = {};
  const transformMatrices = [];
  const colorTransforms = [];
  const textures = [];
  let shapesCount = 0;
  let movieClipsCount = 0;
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

  let hasExternalTexFile = false;

  // These don't have any meaning if hasExternalTexFile is false
  let hasLowResTexFile = true;
  let hasHighResTexFile = true;
  let textureBuffer;

  while (blockType !== 0) {
    blockType = buffer.readUInt8();
    const blockSize = buffer.readUInt32LE();

    if (blockType === 0) {
      break;
    }

    switch (blockType) {
      case 0x01:
      case 0x10:
      case 0x1c:
      case 0x1d:
      case 0x22:
        if (!textureBuffer) {
          // eslint-disable-next-line no-await-in-loop
          textureBuffer = await getTextureBuffer(
            buffer,
            filename,
            hasExternalTexFile,
            hasHighResTexFile,
            hasLowResTexFile,
          );
        }
        if (textures.length >= totalTextures) {
          logger.error(`${filename} - Reading too many textures`);
        }

        textures.push(textureSection.readTexture(
          buffer,
          textureBuffer,
          blockType,
          filename,
          textures.length,
        ));
        break;
      case 0x17:
        hasLowResTexFile = false;
        break;
      case 0x1a:
        hasExternalTexFile = true;
        break;
      case 0x1e:
        hasHighResTexFile = false;
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

        addResource(resources, shapeSection.readShape(buffer, textures));
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
  return {
    textures,
    resources,
    colorTransforms,
    transformMatrices,
  };
};

const readScFile = async (fileName) => {
  const scFileContent = await readNormalScFile(fileName, await getScBuffer(fileName));
  // const shapes = await shapeSection.extractShapes(fileName, textures, [scFileContent.resources[0]]);

  const startTime = new Date().getTime();
  const repeat = 1;
  for (let i = 0; i < repeat; i += 1) {
    const shapes = await shapeSection.extractShapes(fileName, scFileContent.textures, scFileContent.resources);
  }
  logger.debug(`extractShapes time - ${(new Date().getTime() - startTime) / repeat}ms`);
  // await movieClipSection.createMovieClips(
  //   fileName,
  //   scFileContent.transformMatrices,
  //   scFileContent.colorTransforms,
  //   scFileContent.resources,
  //   shapes,
  // );
};

module.exports = {
  readScFile,
};
