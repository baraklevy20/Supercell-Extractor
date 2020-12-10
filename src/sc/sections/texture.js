const imageUtils = require('../../imageUtils');

const readPixel = (buffer, pixelFormat) => {
  switch (pixelFormat) {
    // RGB8888
    case 0x00: {
      return buffer.readUInt32BE();
    }
    // LA88
    case 0x06: {
      const color = buffer.readUInt8();
      const alpha = buffer.readUInt8();
      return ((color << 24) + (color << 16) + (color << 8) + alpha) >>> 0;
    }
    // RGB565
    case 0x04: {
      const value = buffer.readUInt16BE();
      return (
        (((value >> 11) << (27 + ((value >> 5) & 0x1f))) << (19 + value)) << (11 + 0xff)
      );
    }
    default: {
      throw Error('Unsupported pixel format');
    }
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

      for (let r = 0; r < numberOfBlocksInColumn; r += 1) {
        for (let c = 0; c < numberOfBlocksInRow; c += 1) {
          const currentBlockStartRow = r * blockSize;
          const currentBlockStartColumn = c * blockSize;

          for (let i = 0; i < blockSize && currentBlockStartRow + i < height; i += 1) {
            for (let j = 0; j < blockSize && currentBlockStartColumn + j < width; j += 1) {
              const pixelRow = currentBlockStartRow + i;
              const pixelColumn = currentBlockStartColumn + j;
              const pixel = readPixel(buffer, pixelFormat);

              pixels[pixelRow * width + pixelColumn] = pixel;
            }
          }
        }
      }
    } else if (layoutType === 0x01) {
      for (let i = 0; i < width * height; i += 1) {
        pixels[i] = (readPixel(buffer, pixelFormat));
      }
    }

    textures.push({
      width,
      height,
      pixelFormat,
      layoutType,
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

module.exports = {
  readTextures,
};
