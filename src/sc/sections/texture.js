const imageUtils = require('../../imageUtils');

const formats = [
  'GL_RGBA',
  'GL_RGBA',
  'GL_RGBA',
  'GL_RGBA',
  'GL_RGB',
  'GL_RGBA',
  'GL_LUMINANCE_ALPHA',
  'GL_RGBA',
  'GL_RGBA',
  'GL_RGBA',
  'GL_LUMINANCE',
];

const types = [
  'GL_UNSIGNED_BYTE',
  'GL_UNSIGNED_BYTE',
  'GL_UNSIGNED_SHORT_4_4_4_4',
  'GL_UNSIGNED_SHORT_5_5_5_1',
  'GL_UNSIGNED_SHORT_5_6_5',
  'GL_UNSIGNED_BYTE',
  'GL_UNSIGNED_BYTE',
  'GL_UNSIGNED_BYTE',
  'GL_UNSIGNED_BYTE',
  'GL_UNSIGNED_SHORT_4_4_4_4',
  'GL_UNSIGNED_BYTE',
];
const bytesToReadPerPixelFormat = [
  4,
  4,
  2,
  2,
  2,
  4,
  2,
  4,
  4,
  2,
  1,
];

// Most image operations on libvips return 4 channels images or
// must have 4 channels images, thus everything is 4.
// if in the future it gets better support, it'll be much faster to use
// the original number of channels (marked in parenthesis)
const channelsPerFormat = {
  GL_RGBA: 4, // (4)
  GL_RGB: 4, // (3)
  GL_LUMINANCE_ALPHA: 4, // (2)
  GL_LUMINANCE: 4, // (1)
};

const readPixel = (buffer, pixelFormatIndex) => {
  const format = formats[pixelFormatIndex] || 'GL_RGBA';
  const type = types[pixelFormatIndex] || 'GL_UNSIGNED_BYTE';
  const bytesToRead = bytesToReadPerPixelFormat[pixelFormatIndex] || 4;

  // This is BE, not LE, so everything is swapped
  const bytesRead = buffer.readBuffer(bytesToRead);
  let actualBytes;
  switch (type) {
    case 'GL_UNSIGNED_SHORT_5_6_5':
      // [5 bits from first byte, 3 from first byte and 3 from second byte, 5 bits from second byte]
      actualBytes = [
        Math.floor(((bytesRead[1] & 0b11111000) >> 3) * 255 / 31),
        Math.floor((((bytesRead[1] & 0b111) << 3) | ((bytesRead[0] & 0b11100000) >> 5)) * 255 / 63),
        Math.floor((bytesRead[0] & 0b00011111) * 255 / 31),
      ];
      break;
    case 'GL_UNSIGNED_SHORT_4_4_4_4':
      actualBytes = [
        ((bytesRead[1] & 0b11110000) >> 4) * 17,
        (bytesRead[1] & 0b00001111) * 17,
        ((bytesRead[0] & 0b11110000) >> 4) * 17,
        (bytesRead[0] & 0b00001111) * 17,
      ];
      break;
    case 'GL_UNSIGNED_SHORT_5_5_5_1':
      actualBytes = [
        Math.floor((bytesRead[1] >> 3) * 255 / 31),
        Math.floor((((bytesRead[1] & 0b111) << 2) | ((bytesRead[0]) >> 6)) * 255 / 31),
        Math.floor(((bytesRead[0] & 0b00111110) >> 1) * 255 / 31),
        (bytesRead[0] & 1) * 255,
      ];
      break;
    default:
      actualBytes = bytesRead;
  }

  // Unfortunately I couldn't get libvips to work with 1 or 2 channels
  // so I'm converting it to 3 or 4 channels, respectively
  if (format === 'GL_LUMINANCE_ALPHA') {
    return [actualBytes[0], actualBytes[0], actualBytes[0], actualBytes[1]];
  }
  if (format === 'GL_LUMINANCE') {
    return [actualBytes[0], actualBytes[0], actualBytes[0], 0xff];
  }
  if (format === 'GL_RGB') {
    return [actualBytes[0], actualBytes[1], actualBytes[2], 0xff];
  }

  return actualBytes;
};

const readTexture = (
  buffer,
  textureBuffer,
  tag,
  scFileName,
  textureId,
) => {
  if (buffer !== textureBuffer) {
    // eslint-disable-next-line no-param-reassign
    tag = textureBuffer.readUInt8();
    textureBuffer.readUInt32LE(); // tag length
  }
  const pixelFormatIndex = textureBuffer.readUInt8();
  const pixelFormat = formats[pixelFormatIndex] || 'GL_RGBA';
  const channels = channelsPerFormat[pixelFormat];
  const width = textureBuffer.readUInt16LE();
  const height = textureBuffer.readUInt16LE();
  const pixels = new Array(width * height * channels);

  if (buffer !== textureBuffer) {
    // Skip pixel format (1), width (2) and height (2) in the original buffer
    buffer.readBuffer(5);
  }

  if (tag === 0x1b || tag === 0x1c) {
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
            const pixel = readPixel(textureBuffer, pixelFormatIndex);

            for (let k = 0; k < channels; k += 1) {
              pixels[channels * (pixelRow * width + pixelColumn) + k] = pixel[k];
            }
          }
        }
      }
    }
  } else if (tag === 0x01) {
    for (let i = 0; i < width * height; i += 1) {
      const pixel = readPixel(textureBuffer, pixelFormatIndex);
      for (let k = 0; k < channels; k += 1) {
        pixels[channels * i + k] = pixel[k];
      }
    }
  }

  imageUtils.saveImage(
    `out/${scFileName}-texture${textureId}.png`,
    width,
    height,
    channels,
    pixels,
  );

  return {
    width,
    height,
    channels,
    pixels,
  };
};

module.exports = {
  readTexture,
};
