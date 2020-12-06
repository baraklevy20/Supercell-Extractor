const fs = require('fs');
const { SmartBuffer } = require('smart-buffer');
const utils = require('./utils');
const imageUtils = require('../imageUtils');

const readShape = (buffer, textures) => {
  // This is auto incremented
  const spriteId = buffer.readUInt16LE();
  // console.log(`spriteID: ${spriteId}`);
  const numberOfSprites = buffer.readUInt16LE();
  const totalNumberOfVertices = buffer.readUInt16LE();

  let innerBlockSize;
  while (innerBlockSize !== 0) {
    const blockHeader = buffer.readUInt8(); // either 0x16=22 or 0x00=0
    innerBlockSize = buffer.readUInt32LE();

    if (innerBlockSize === 0) {
      break;
    }

    console.log(`Type 12 block header: ${blockHeader}`);

    const textureId = buffer.readUInt8();
    const numberOfVertices = buffer.readUInt8();
    const coordinates = [];

    for (let j = 0; j < numberOfVertices; j++) {
      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      coordinates.push([x * 0.05, y * 0.05]); // not sure
      // console.log(`Coordinates: (${x}, ${y})`);
    }

    const polygon = [];
    // Polygon
    for (let j = 0; j < numberOfVertices; j++) {
      const x = Math.floor(
        (buffer.readUInt16LE() / 0xffff)
                * textures[textureId].width,
      );

      const y = Math.floor(
        (buffer.readUInt16LE() / 0xffff)
                * textures[textureId].height,
      );
      polygon.push([x, y]);

      // if (i === 5) {
      // console.log(`Polygon: (${x}, ${y})`);
      // }
    }

    // if (i === 1) {
    // const image = new Jimp(
    //   textures[textureId].width,
    //   textures[textureId].height,
    // );
    // let k = 0;
    // for (let i = 0; i < textures[textureId].height; i++) {
    //   for (let j = 0; j < textures[textureId].width; j++) {
    //     image.setPixelColor(
    //       textures[textureId].pixels[k++],
    //       j,
    //       i,
    //     );
    //   }
    // }
    // const radius = 32;
    // for (let j = 0; j < numberOfVertices; j++) {
    //   for (let k = 0; k < radius; k++) {
    //     image.setPixelColor(0xff0000ff, polygon[j][0] + k, polygon[j][1]);
    //     image.setPixelColor(0xff0000ff, polygon[j][0] - k, polygon[j][1]);
    //     image.setPixelColor(0xff0000ff, polygon[j][0], polygon[j][1] + k);
    //     image.setPixelColor(0xff0000ff, polygon[j][0], polygon[j][1] - k);
    //     // image.setPixelColor(
    //     //   0x00ff00ff,
    //     //   polygon[j][0] + coordinates[j][0] + k,
    //     //   polygon[j][1] + coordinates[j][1]
    //     // );
    //   }
    // }
    // image.write(`out/test${spriteId}.png`, (err) => {
    //   if (err) throw err;
    // });
    // }
  }
};

const readMovieClip = (buffer) => {
  const exportId = buffer.readUInt16LE();
  console.log(exports[exportId]);
  const frameRate = buffer.readUInt8();
  const countFrames = buffer.readUInt16LE();
  const countTriples = buffer.readUInt32LE();

  for (let i = 0; i < countTriples; i++) {
    const triple = [buffer.readInt16LE(), buffer.readInt16LE(), buffer.readInt16LE()];
    console.log(triple);
  }

  const x = buffer.readUInt16LE();
  for (let i = 0; i < x; i++) {
    const num = buffer.readInt16LE();
  }
  for (let i = 0; i < x; i++) {
    const num = buffer.readUInt8();
  }

  for (let i = 0; i < x; i++) {
    const string = utils.readString(buffer);
    console.log(string);
  }

  let v25 = 0xb;
  while (v25 === 0xb) {
    v25 = buffer.readUInt8();
    buffer.readUInt32LE(); // not used

    if (v25 !== 0xb) {
      break;
    }

    const v26 = buffer.readUInt16LE();
    const string = utils.readString(buffer);
    console.log(string);
  }
};

const readTextFields = (buffer) => {
  throw Error('not implemented');
};

const readTransformMatrix = (buffer) => {
  const matrix = [
    [buffer.readInt32LE() * 0.001, buffer.readInt32LE() * 0.001, buffer.readInt32LE() * 0.001],
    [buffer.readInt32LE() * 0.001, buffer.readInt32LE() * 0.05, buffer.readInt32LE() * 0.05],
  ];
  console.log(matrix);
};

const readColorTransform = (buffer) => {
  const colorTransform = {
    redMultiplier: buffer.readUInt8(),
    greenMultiplier: buffer.readUInt8(),
    blueMultiplier: buffer.readUInt8(),
    redAddition: buffer.readUInt8(),
    greenAddition: buffer.readUInt8(),
    blueAddition: buffer.readUInt8(),
    scale: buffer.readUInt8() || 100,
  };
  console.log(colorTransform);
};

const readNormalScFile = (buffer, textures) => {
  // These are used to verify if you're attempting to read too many shapes/animations
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
    console.log(`${exportsIds[i].toString(16)} - ${exportName}`);
    exports[exportsIds[i]] = exportName;
  }

  // some block?
  const uselessBlock = buffer.readUInt8();
  if (uselessBlock === 0x17) {
    buffer.readBuffer(0x13);
  } else if (uselessBlock === 0x1a) {
    buffer.readBuffer(0xe);
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
      case 0x08:
        readTransformMatrix(buffer);
        break;
      case 0x09:
        readColorTransform(buffer);
        break;
      case 0x0c:
        // this is called either a MovieClip or an 'Animation Table'
        readMovieClip(buffer);
        break;
      case 0x12:
        readShape(buffer, textures);
        break;
      default: {
        const block = buffer.readBuffer(blockSize);
        console.log(
          `${i} Block type: ${blockType.toString(
            16,
          )}. Size: ${blockSize}. Data: ${block.toString('hex')}`,
        );
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

const readScFile = async (scFileName) => {
  const textures = readTextures(scFileName, await getScBuffer(`${scFileName}_tex`));
  readNormalScFile(await getScBuffer(scFileName), textures);
};

module.exports = readScFile;
