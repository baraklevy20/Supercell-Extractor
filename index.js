const fs = require('fs');
const md5 = require('js-md5');
const lzma = require('lzma-native');
const Jimp = require('jimp');
const { SmartBuffer } = require('smart-buffer');

const decompress = async (buffer) => {
  let data = buffer.slice(26);
  data = [...data.slice(0, 9), 0, 0, 0, 0, ...data.slice(9)];
  return lzma.decompress(data);
};

const checkValidity = (buffer, decompressedBuffer) => {
  const fileHash = buffer.slice(10, 26).toString('hex');
  const computedHash = md5(decompressedBuffer.toBuffer());
  return fileHash === computedHash;
};

const readNormalScFile = (buffer, spritesheets) => {
  // These are the counts for each unique type in the last loop
  const type0Count = buffer.readUInt16LE();
  const type1Count = buffer.readUInt16LE();
  const type2Count = buffer.readUInt16LE();
  const type3Count = buffer.readUInt16LE();
  const type4Count = buffer.readUInt16LE();

  // ??
  buffer.readBuffer(7);

  const numberOfStrings = buffer.readUInt16LE();

  for (let i = 0; i < numberOfStrings; i++) {
    const value = buffer.readUInt16LE();
  }

  for (let i = 0; i < numberOfStrings; i++) {
    const stringLength = buffer.readUInt8();
    const string = buffer.readString(stringLength, 'utf8');
    console.log(string);
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
        const matrix = [
          [buffer.readInt32LE(), buffer.readInt32LE(), buffer.readInt32LE()],
          [buffer.readInt32LE(), buffer.readInt32LE(), buffer.readInt32LE()],
        ];
        break;
      case 0x12:
        const spriteId = buffer.readUInt16LE();
        const numberOfRegions = buffer.readUInt16LE();
        const totalNumberOfPoints = buffer.readUInt16LE();

        let innerBlockSize;
        while (innerBlockSize !== 0) {
          const blockHeader = buffer.readUInt8(); // always 0x16=22??
          innerBlockSize = buffer.readUInt32LE();

          if (innerBlockSize === 0) {
            break;
          }

          const spritesheetId = buffer.readUInt8();
          const numberOfPoints = buffer.readUInt8();
          const coordinates = [];

          for (let j = 0; j < numberOfPoints; j++) {
            const x = buffer.readInt32LE();
            const y = buffer.readInt32LE();
            coordinates.push([x / 10, y / 10]); // not sure
            // if (i === 5) {
            // console.log(`Coordinates: (${x}, ${y})`);
            // }
          }

          const polygon = [];
          // Polygon
          for (let j = 0; j < numberOfPoints; j++) {
            const x = Math.round(
              (buffer.readUInt16LE() / 0xffff)
                * spritesheets[spritesheetId].width,
            );

            const y = Math.round(
              (buffer.readUInt16LE() / 0xffff)
                * spritesheets[spritesheetId].height,
            );
            polygon.push([x, y]);

            // if (i === 5) {
            // console.log(`Polygon: (${x}, ${y})`);
            // }
          }
          // let image = new Jimp(
          //   spritesheets[spritesheetId].width,
          //   spritesheets[spritesheetId].height
          // );
          // let k = 0;
          // for (let i = 0; i < spritesheets[spritesheetId].height; i++) {
          //   for (let j = 0; j < spritesheets[spritesheetId].width; j++) {
          //     image.setPixelColor(
          //       spritesheets[spritesheetId].pixels[k++],
          //       j,
          //       i
          //     );
          //   }
          // }
          // for (let j = 0; j < numberOfPoints; j++) {
          //   for (let k = 0; k < 200; k++) {
          //     image.setPixelColor(0xff0000ff, polygon[j][0] + k, polygon[j][1]);
          //     image.setPixelColor(
          //       0x00ff00ff,
          //       polygon[j][0] + coordinates[j][0] + k,
          //       polygon[j][1] + coordinates[j][1]
          //     );
          //   }
          // }
          // image.write(`out/test${spriteId}.png`, (err) => {
          //   if (err) throw err;
          // });
          // break;
        }
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

const getSpritesheets = (buffer) => {
  let blockLength;
  const spritesheets = [];
  fs.rmdirSync('out', { recursive: true });

  while (blockLength !== 0) {
    const blockId = buffer.readUInt8();
    console.log(blockId);
    blockLength = buffer.readUInt32LE();

    if (blockLength === 0) {
      break;
    }

    const pixelFormat = buffer.readUInt8();
    const width = buffer.readUInt16LE();
    const height = buffer.readUInt16LE();
    const pixels = new Array(width * height);
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

    spritesheets.push({
      width,
      height,
      pixels,
    });

    let k = 0;
    const image = new Jimp(
      spritesheets[spritesheets.length - 1].width,
      spritesheets[spritesheets.length - 1].height,
    );
    for (let i = 0; i < spritesheets[spritesheets.length - 1].height; i++) {
      for (let j = 0; j < spritesheets[spritesheets.length - 1].width; j++) {
        image.setPixelColor(
          spritesheets[spritesheets.length - 1].pixels[k++],
          j,
          i,
        );
      }
    }
    image.write(`out/test${spritesheets.length}.png`, (err) => {
      if (err) throw err;
    });
    break;
  }

  return spritesheets;
};

const getScBuffer = async (scFileName) => {
  const buffer = fs.readFileSync(`sc/${scFileName}.sc`);
  const decompressedScFile = SmartBuffer.fromBuffer(await decompress(buffer));

  if (!checkValidity(buffer, decompressedScFile)) {
    console.log('File is corrupted');
  }

  return decompressedScFile;
};

const readScFile = async (scFileName) => {
  const spritesheets = getSpritesheets(await getScBuffer(`${scFileName}_tex`));
  // readNormalScFile(await getScBuffer(scFileName), spritesheets);
};

const main = async () => {
  const scFiles = fs.readdirSync('sc');
  // const scFile = 'events.sc';
  // const scFile = 'events_tex.sc';
  // const scFile = 'background_basic.sc';
  // const scFile = "background_basic_tex.sc";
  // const scFile = 'background_snowtel.sc';
  // const scFile = 'background_snowtel_tex.sc';
  // const scFile = 'background_world_finals.sc';
  // const scFile = "characters.sc";
  // const scFile = "characters_tex.sc"; // bad
  // supercell_id sorta works. also debug
  // loading throws exception
  // ui_tex no

  // characters = 1 spritesheet, compressed??
  // debug/supercell_id = 1 spritesheet, but working.
  const scFile = 'events';
  // for (const scFile of scFiles) {
  readScFile(scFile);
  // }
};

main();
