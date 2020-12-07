const fs = require('fs');
const { SmartBuffer } = require('smart-buffer');
const sharp = require('sharp');
const utils = require('./utils');
const imageUtils = require('../imageUtils');

const readShape = async (buffer, textures) => {
  // This is auto incremented
  const exportId = buffer.readInt16LE();
  console.log(`Shape exportID: ${exportId}`);
  const numberOfSprites = buffer.readUInt16LE();
  const totalNumberOfVertices = buffer.readUInt16LE();

  let innerBlockSize;
  const shapes = [];

  while (innerBlockSize !== 0) {
    const blockHeader = buffer.readUInt8(); // either 0x16=22 or 0x00=0
    innerBlockSize = buffer.readUInt32LE();

    if (innerBlockSize === 0) {
      break;
    }

    // console.log(`Type 12 block header: ${blockHeader}`);

    const textureId = buffer.readUInt8();
    const numberOfVertices = buffer.readUInt8();
    const coordinates = [];

    for (let j = 0; j < numberOfVertices; j++) {
      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      coordinates.push([x * 0.05, y * 0.05]);
    }

    const polygon = [];
    for (let j = 0; j < numberOfVertices; j++) {
      const x = Math.floor(buffer.readUInt16LE() / 0xffff * textures[textureId].width);
      const y = Math.floor(buffer.readUInt16LE() / 0xffff * textures[textureId].height);
      polygon.push([x, y]);
    }

    const shapeImage = await imageUtils.extractShape(polygon, textures[textureId]);

    if (shapeImage) {
      shapes.push(shapeImage);
    }

    // imageUtils.extractShape(`out/shape${exportId}.png`, polygon, textures[textureId]);
  }

  const shape = {
    type: 'shape',
    exportId,
    shapes,
  };
  return shape;
};

const applyOperations = async (path, resource, transformation, colorTransformation) => {
  if (resource.shapes === undefined) {
    console.log('wtf');
  } else {
    for (let s = 0; s < resource.shapes.length; s++) {
      const e = resource.shapes[s];
      const pixels = await e.shape.toBuffer();

      for (let k = 0; k < pixels.length; k += 4) {
        pixels[4 * k] = Math.floor(pixels[4 * k] * colorTransformation.redMultiplier / 255);
        pixels[4 * k + 1] = Math.floor(pixels[4 * k + 1] * colorTransformation.greenMultiplier / 255);
        pixels[4 * k + 2] = Math.floor(pixels[4 * k + 2] * colorTransformation.blueMultiplier / 255);
        pixels[4 * k + 3] = Math.floor(pixels[4 * k + 3] * colorTransformation.alphaMultiplier / 255);
        pixels[4 * k] = Math.min(255, pixels[4 * k] + colorTransformation.redAddition);
        pixels[4 * k + 1] = Math.min(255, pixels[4 * k + 1] + colorTransformation.greenAddition);
        pixels[4 * k + 2] = Math.min(255, pixels[4 * k + 2] + colorTransformation.blueAddition);
      }

      const transformed = sharp(pixels, {
        raw:
        {
          channels: 4,
          width: e.width,
          height: e.height,
        },
      }).affine(transformation.matrix, { background: 'white', odx: transformation.odx, ody: transformation.ody });
      await imageUtils.saveSharp(`${path} ${s}`, transformed);
    }
  }
};

const readMovieClip = async (buffer, resources, transformMatrices, colorMatrices) => {
  const exportId = buffer.readUInt16LE();
  console.log(`MovieClip exportId: ${exportId}`);
  if (exportId === 81) {
    console.log('working');
  }
  // console.log(exports[exportId]);
  const frameRate = buffer.readUInt8();
  const countFrames = buffer.readUInt16LE();
  console.log(`frames: ${countFrames}`);
  const countTriples = buffer.readUInt32LE();
  const triples = [];
  // console.log(`count triples: ${countTriples}`);

  for (let i = 0; i < countTriples; i++) {
    // First number - index of resourcesMapping
    // Second number - index of transform matrix or default matrix if -1
    // Third number - index of color transform or default if -1
    const triple = [buffer.readInt16LE(), buffer.readInt16LE(), buffer.readInt16LE()];
    console.log(triple);
    triples.push(triple);
  }

  const numberOfResources = buffer.readUInt16LE();
  const resourcesMapping = [];
  for (let i = 0; i < numberOfResources; i++) {
    resourcesMapping.push(buffer.readInt16LE());
  }
  for (let i = 0; i < numberOfResources; i++) {
    const num = buffer.readUInt8();
    console.log(`xuint8: ${num}`);
  }

  for (let i = 0; i < numberOfResources; i++) {
    const string = utils.readString(buffer);
    console.log(`id: ${resourcesMapping[i]} type: ${resources[resourcesMapping[i]].type} x string: ${string}`);
    if (string !== null) {
    }
  }

  let frameType;
  let currentTripleIndex = 0;
  while (frameType !== 0) {
    frameType = buffer.readUInt8();
    const frameSize = buffer.readUInt32LE();

    if (frameSize === 0) {
      break;
    }
    switch (frameType) {
      case 0x0b: {
        const numberOfTriplesInCurrentFrame = buffer.readUInt16LE();
        const frameName = utils.readString(buffer);
        if (frameName !== null) {
          console.log(`frameName: ${frameName}`);
        }

        for (let i = 0; i < numberOfTriplesInCurrentFrame; i++) {
          const currentTriple = triples[currentTripleIndex + i];
          const resource = resources[resourcesMapping[currentTriple[0]]];
          const transformation = getTransformMatrix(transformMatrices, currentTriple[1]);
          const colorTransformation = getColorTransformation(colorMatrices, currentTriple[2]);
          if (currentTriple[2] != -1) {
            console.log('fdfs');
          }
          await applyOperations(`out/MovieClip${exportId}-triple${i}`, resource, transformation, colorTransformation);
        }

        currentTripleIndex += numberOfTriplesInCurrentFrame;
        break;
      }
      case 0x1f: {
        const v27 = buffer.readInt32LE() * 0.05;
        const v28 = buffer.readInt32LE() * 0.05;
        const v29 = buffer.readInt32LE() * 0.05 + v27;
        const v30 = buffer.readInt32LE() * 0.05 + v28;
        // console.log(`frame type 0x1f: ${[v27, v28, v29, v30]}`);
        break;
      }
      default:
    }
  }

  const movieClip = {
    exportId,
    type: 'movieClip',
  };

  return movieClip;
};

const readTextField = (buffer, blockType) => {
  const exportId = buffer.readInt16LE();
  console.log(`TextField exportID: ${exportId}`);
  const text = utils.readString(buffer);
  const v60 = buffer.readInt32LE();
  const c1 = buffer.readUInt8(); // maybe text modifier
  const c2 = buffer.readUInt8(); // maybe text modifier
  const c3 = buffer.readUInt8(); // maybe text modifier
  const c4 = buffer.readUInt8(); // not sure if used
  const c5 = buffer.readUInt8();
  const c6 = buffer.readUInt8();
  const c7 = buffer.readInt16LE();
  const c8 = buffer.readInt16LE();
  const c9 = buffer.readInt16LE();
  const c10 = buffer.readInt16LE();
  const c11 = buffer.readUInt8(); // maybe text modifier
  const text2 = utils.readString(buffer);

  let c12;
  let c13;
  if (blockType !== 0x07) {
    c12 = buffer.readUInt8(); // maybe text modifier

    if (blockType === 0x15) {
      c13 = buffer.readUInt32LE();
    }
  }

  const textField = {
    exportId,
    type: 'textField',
    text,
    text2,
    v60,
    c1,
    c2,
    c3,
    c4,
    c5,
    c6,
    c7,
    c8,
    c9,
    c10,
    c11,
    c12,
    c13,
  };

  return textField;

  // console.log('TextField: ', textField);
};

const readTransformMatrix = (buffer) => ({
  matrix: [
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
  ],
  odx: buffer.readInt32LE() * 0.05,
  ody: buffer.readInt32LE() * 0.05,
});

const getTransformMatrix = (transformMatrices, index) => {
  if (index === -1) {
    // Identity matrix
    return {
      matrix: [1, 0, 0, 1],
      odx: 0,
      ody: 0,
    };
  }
  return transformMatrices[index];
};
const getColorTransformation = (colorMatrices, index) => {
  if (index === -1) {
    return {
      redMultiplier: 0xff,
      greenMultiplier: 0xff,
      blueMultiplier: 0xff,
      alphaMultiplier: 0xff,
      redAddition: 0,
      greenAddition: 0,
      blueAddition: 0,
    };
  }
  return colorMatrices[index];
};

const readColorTransform = (buffer) => {
  const colorTransform = {
    redMultiplier: buffer.readUInt8(),
    greenMultiplier: buffer.readUInt8(),
    blueMultiplier: buffer.readUInt8(),
    alphaMultiplier: buffer.readUInt8(),
    redAddition: buffer.readUInt8(),
    greenAddition: buffer.readUInt8(),
    blueAddition: buffer.readUInt8(),
  };
  console.log('color transform:', colorTransform);
  return colorTransform;
};

const addResource = (resources, resource) => {
  resources[resource.exportId] = resource;
};

const readNormalScFile = async (buffer, textures, isOld = false) => {
  // These are used to verify if you're attempting to read too many shapes/animations
  const resources = {};
  const transformMatrices = [];
  const colorMatrices = [];
  const shapesCount = buffer.readUInt16LE();
  const movieClipsCount = buffer.readUInt16LE();
  const texturesCount = buffer.readUInt16LE();
  const textFieldsCount = buffer.readUInt16LE();
  const transformMatricesCount = buffer.readUInt16LE();
  const colorTransformsCount = buffer.readUInt16LE();

  // Not used
  buffer.readBuffer(5);

  const numberOfExports = buffer.readUInt16LE();
  const exportsIds = [];
  const exports = {};

  for (let i = 0; i < numberOfExports; i++) {
    exportsIds.push(buffer.readUInt16LE());
  }

  for (let i = 0; i < numberOfExports; i++) {
    const exportName = utils.readString(buffer);
    // console.log(`${exportsIds[i].toString()} - ${exportName}`);
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

    switch (blockType) {
      case 0x07:
      case 0x0f:
        addResource(resources, readTextField(buffer, blockType));
        break;
      case 0x08:
        transformMatrices.push(readTransformMatrix(buffer));
        break;
      case 0x09:
        colorMatrices.push(readColorTransform(buffer));
        break;
      case 0x0c:
        addResource(resources, await readMovieClip(buffer, resources, transformMatrices, colorMatrices));
        break;
      case 0x12:
        if (isOld) {
          buffer.readBuffer(blockSize);
        } else {
          addResource(resources, await readShape(buffer, textures));
        }
        break;
      default: {
        const block = buffer.readBuffer(blockSize);
        // console.log(
        //   `${i} Block type: ${blockType.toString(
        //     16,
        //   )}. Size: ${blockSize}. Data: ${block.toString('hex')}`,
        // );
      }
    }
    i++;
  }
  console.log(`done with blocks. total: ${i}`);
};

const readPixel = (buffer, pixelFormat) => {
  switch (pixelFormat) {
    // RGB8888
    case 0x00:
      return buffer.readUInt32BE();
    // LA88
    case 0x06:
      const color = buffer.readUInt8();
      const alpha = buffer.readUInt8();
      return ((color << 24) + (color << 16) + (color << 8) + alpha) >>> 0;
    // RGB565
    case 0x04:
      const value = buffer.readUInt16BE();
      return (
        (((value >> 11) << (27 + ((value >> 5) & 0x1f))) << (19 + value))
        << (11 + 0xff)
      );
    default:
      throw 'Unsupported pixel format';
  }
};

const readTextures = (scFileName, buffer) => {
  let blockLength;
  const textures = [];

  while (blockLength !== 0) {
    const layoutType = buffer.readUInt8();
    blockLength = buffer.readUInt32LE();

    if (blockLength === 0) {
      break;
    }

    const pixelFormat = buffer.readUInt8();
    const width = buffer.readUInt16LE();
    const height = buffer.readUInt16LE();
    const pixels = new Array(width * height);

    if (layoutType === 0x1c) {
      const blockSize = 32;
      const numberOfBlocksInRow = Math.ceil(width / blockSize);
      const numberOfBlocksInColumn = Math.ceil(height / blockSize);

      for (let r = 0; r < numberOfBlocksInColumn; r++) {
        for (let c = 0; c < numberOfBlocksInRow; c++) {
          const currentBlockStartRow = r * blockSize;
          const currentBlockStartColumn = c * blockSize;

          for (let i = 0; i < blockSize && currentBlockStartRow + i < height; i++) {
            for (let j = 0; j < blockSize && currentBlockStartColumn + j < width; j++) {
              const pixelRow = currentBlockStartRow + i;
              const pixelColumn = currentBlockStartColumn + j;
              const pixel = readPixel(buffer, pixelFormat);

              pixels[pixelRow * width + pixelColumn] = pixel;
            }
          }
        }
      }
    } else if (layoutType === 0x01) {
      for (let i = 0; i < width * height; i++) {
        pixels[i] = (readPixel(buffer, pixelFormat));
      }
    }

    textures.push({
      width,
      height,
      pixels,
    });

    imageUtils.saveImage(
      `out/${scFileName} - texture${textures.length}.png`,
      textures[textures.length - 1].width,
      textures[textures.length - 1].height,
      textures[textures.length - 1].pixels,
    );
  }

  return textures;
};

const getScBuffer = async (scFileName) => {
  const buffer = fs.readFileSync(`sc/${scFileName}.sc`);
  const decompressedScFile = SmartBuffer.fromBuffer(await utils.decompress(buffer));

  if (!utils.checkValidity(buffer, decompressedScFile)) {
    console.log('File is corrupted');
  }

  return decompressedScFile;
};

const getOldScBuffer = async (scFileName) => {
  const buffer = fs.readFileSync(`sccoc/${scFileName}.sc`);
  const decompressedScFile = SmartBuffer.fromBuffer(await utils.oldDecompress(buffer));
  return decompressedScFile;
};

const readScFile = async (scFileName) => {
  const textures = readTextures(scFileName, await getScBuffer(`${scFileName}_tex`));
  readNormalScFile(await getScBuffer(scFileName), textures);
};

const readOldScFile = async (scFileName) => {
  readNormalScFile(await getOldScBuffer(scFileName), null, true);
};

module.exports = {
  readScFile,
  readOldScFile,
};
