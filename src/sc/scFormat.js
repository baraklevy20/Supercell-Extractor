require('./scBuffer');
const fs = require('fs');
const { SmartBuffer } = require('smart-buffer');
const logger = require('../../logger');

const shapeSection = require('./sections/shape');
const textFieldSection = require('./sections/textField');
const colorTransformSection = require('./sections/colorTransform');
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
    exports[exportName] = exportsIds[i];
  }

  let tag;
  let i = 0;

  let hasExternalTexFile = false;

  // These don't have any meaning if hasExternalTexFile is false
  let hasLowResTexFile = true;
  let hasHighResTexFile = true;
  let textureBuffer;

  while (tag !== 0) {
    tag = buffer.readUInt8();
    const tagLength = buffer.readUInt32LE();

    // The second set of tags are handled a bit differently, not sure how
    if ([0x1, 0x10, 0x1c, 0x1d, 0x22].includes(tag) || [0x13, 0x18, 0x1b].includes(tag)) {
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
        tag,
        filename,
        textures.length,
      ));
    }

    if ([0x2, 0x12].includes(tag)) {
      shapesCount += 1;
      if (shapesCount > totalShapes) {
        logger.error(`${filename} - Reading too many shapes`);
      }

      addResource(resources, shapeSection.readShape(buffer, textures));
    }

    if ([0x3, 0xa, 0xc, 0xe, 0x23].includes(tag)) {
      movieClipsCount += 1;
      if (movieClipsCount > totalMovieClips) {
        logger.error(`${filename} - Reading too many movie clips`);
      }
      addResource(resources, movieClipSection.readMovieClip(buffer, tag, tagLength));
    }

    if ([0x4, 0x5, 0x6, 0xb, 0x11, 0x16, 0x1f, 0x29].includes(tag)) {
      // Inner tags (tags that are being used in other tags).
      // This should never happen, unless the file is broken.
      // 0x4, 0x6, 0x11, 0x16 are used in shape
      // 0x5, 0xb, 0x1f and 0x29 are used in movie clip
      console.warn('Inner tag used outside a tag: ', tag);
      buffer.readBuffer(tagLength);
    }

    if ([0x7, 0xf, 0x14, 0x15, 0x19, 0x21, 0x2b, 0x2c].includes(tag)) {
      textFieldsCount += 1;
      if (textFieldsCount > totalTextFields) {
        logger.error(`${filename} - Reading too many text fields`);
      }
      addResource(resources, textFieldSection.readTextField(buffer, tag));
    }

    if (tag === 0x8) {
      transformMatrices.push(transformMatrixSection.readTransformMatrix(buffer));
    }

    if (tag === 0x9) {
      colorTransforms.push(colorTransformSection.readColorTransform(buffer));
    }

    if (tag === 0xd) {
      // timeline indices
    }

    if (tag === 0x17) {
      hasLowResTexFile = false;
    }

    if (tag === 0x1a) {
      hasExternalTexFile = true;
    }

    if (tag === 0x1e) {
      hasHighResTexFile = false;
    }

    if (tag === 0x20) {
      console.warn('Unknown tag: ', tag);
      buffer.readBuffer(tagLength);
    }

    if (tag === 0x24) {
      console.warn('Unknown tag: ', tag);
      buffer.readBuffer(tagLength);
    }

    if (tag === 0x25) {
      console.warn('Unknown tag: ', tag);
      buffer.readBuffer(tagLength);
    }

    if ([0x26, 0x27, 0x28].includes(tag)) {
      console.warn('Unknown tag: ', tag);
      buffer.readBuffer(tagLength);
    }

    if (tag === 0x2a) {
      console.warn('Unknown tag: ', tag);
      buffer.readBuffer(tagLength);
    }

    if (tag > 0x2c) {
      const tagContent = buffer.readBuffer(tagLength);
      console.log(
        `Unsupported tag: ${tag.toString(16)}.
        Length: ${tagLength}. Data: ${tagContent.slice(0, 20).toString('hex')}`,
      );
    }

    i += 1;
  }

  logger.info(`Finished reading file sections. Number of sections: ${i}, filename: ${filename}`);
  return {
    exports,
    textures,
    resources,
    colorTransforms,
    transformMatrices,
  };
};

const readScFile = async (fileName, extractMovieClips) => {
  console.log(`Extracting ${fileName}`);
  const scFileContent = await readNormalScFile(fileName, await getScBuffer(fileName));
  const startTime = new Date().getTime();
  const repeat = 1;

  // for (let i = 0; i < repeat; i += 1) {
  // const shapes = await shapeSection.extractShapes(fileName, scFileContent.textures, [scFileContent.resources[0]]);
  const shapes = await shapeSection.extractShapes(fileName, scFileContent.textures, scFileContent.resources);

  Object.values(shapes).forEach((shape) => {
    scFileContent.resources[shape.exportId] = shape;
  });

  // scFileContent.transformMatrices.left = {
  //   matrix: [1, -1, 1, 0],
  //   odx: -100,
  //   ody: 0,
  // };
  // scFileContent.transformMatrices.right = {
  //   matrix: [0, -1, 1, 0],
  //   odx: 100,
  //   ody: 0,
  // };

  // scFileContent.resources[12] = {
  //   exportId: 12,
  //   type: 'movieClip',
  //   frameCount: 1,
  //   frames: [{
  //     frameResources: [
  //       { resourceIndex: 0, transformMatrixIndex: 'right', colorTransformIndex: -1 },
  //     ],
  //   }],
  //   resourcesMapping: [
  //     2,
  //   ],
  // };
  // scFileContent.resources[10] = {
  //   exportId: 10,
  //   type: 'movieClip',
  //   frameCount: 1,
  //   frames: [{
  //     frameResources: [
  //       { resourceIndex: 1, transformMatrixIndex: -1, colorTransformIndex: -1 },
  //       { resourceIndex: 0, transformMatrixIndex: 'left', colorTransformIndex: -1 },
  //     ],
  //   }],
  //   resourcesMapping: [
  //     11,
  //     4,
  //   ],
  // };
  // scFileContent.resources[11] = {
  //   exportId: 11,
  //   type: 'movieClip',
  //   frameCount: 1,
  //   frames: [{
  //     frameResources: [
  //       { resourceIndex: 0, transformMatrixIndex: 'right', colorTransformIndex: -1 },
  //     ],
  //   }],
  //   resourcesMapping: [
  //     2,
  //   ],
  // };

  // scFileContent.resources.two = {
  //   exportId: 'two',
  //   type: 'movieClip',
  //   frameCount: 1,
  //   frames: [{
  //     frameResources: [
  //       { resourceIndex: 0, transformMatrixIndex: 816, colorTransformIndex: -1 },
  //     ],
  //   }],
  //   resourcesMapping: [
  //     'one',
  //   ],
  // };

  // scFileContent.resources.one = {
  //   exportId: 'one',
  //   type: 'movieClip',
  //   frameCount: 1,
  //   frames: [{
  //     frameResources: [
  //       { resourceIndex: 0, transformMatrixIndex: -1, colorTransformIndex: -1 },
  //     ],
  //   }],
  //   resourcesMapping: [
  //     18,
  //   ],
  // };

  logger.debug(`extractShapes time - ${(new Date().getTime() - startTime) / repeat}ms`);

  if (extractMovieClips) {
    await movieClipSection.createMovieClips(
      fileName,
      scFileContent.transformMatrices,
      scFileContent.colorTransforms,
      scFileContent.resources,
      scFileContent.exports,
    );
  }

  return scFileContent;
};

module.exports = {
  readScFile,
};
