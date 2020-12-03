const fs = require("fs");
const md5 = require("js-md5");
const lzma = require("lzma-native");
const Jimp = require("jimp");
const SmartBuffer = require("smart-buffer").SmartBuffer;

const decompress = async (buffer) => {
  let data = buffer.slice(26);
  data = [...data.slice(0, 9), 0, 0, 0, 0, ...data.slice(9)];
  return lzma.decompress(data);
};

const checkValidity = (buffer, decompressedBuffer) => {
  const fileHash = buffer.slice(10, 26).toString("hex");
  const computedHash = md5(decompressedBuffer.toBuffer());
  return fileHash == computedHash;
};

const readNormalScFile = (buffer) => {
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
    console.log(value);
  }

  for (let i = 0; i < numberOfStrings; i++) {
    const stringLength = buffer.readUInt8();
    const string = buffer.readString(stringLength, "utf8");
    console.log(string);
  }

  // some block?
  buffer.readBuffer(0x14);

  let blockSize;
  let i = 0;
  while (blockSize !== 0) {
    const blockType = buffer.readUInt8();
    blockSize = buffer.readUInt32LE();

    if (blockSize === 0) {
      break;
    }

    // switch (blockType) {
    //   case 0x12:
    //     const spriteId = buffer.readUInt16LE();
    //     const numberOfRegions = buffer.readUInt16LE();
    //     const totalNumberOfPoints = buffer.readUInt16LE();

    //     for (let i = 0; i < numberOfRegions; i++) {

    //     }
    // }

    const block = buffer.readBuffer(blockSize);
    // console.log(
    //   `${i} Block type: ${blockType.toString(16)}. Size: ${blockSize}. Data: ${[...block].slice(0, 20)}`
    // );
    console.log(
      `${i} Block type: ${blockType.toString(
        16
      )}. Size: ${blockSize}. Data: ${block.toString("hex")}`
    );
    i++;
  }
  console.log("done with blocks. total: " + i);
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
      return (value >> 11) << 27 + ((value >> 5) & 0x1f) << 19 + value << 11 + 0xff;
    default:
      throw 'Unsupported pixel format';
  }
};

const readTexScFile = (buffer) => {
  let blockLength;
  let currentImage = 0;
  while (blockLength !== 0) {
    const blockId = buffer.readUInt8();
    blockLength = buffer.readUInt32LE();

    if (blockLength === 0) {
      break;
    }

    const pixelFormat = buffer.readUInt8();
    const imageWidth = buffer.readUInt16LE();
    const imageHeight = buffer.readUInt16LE();

    const pixels = [];
    for (let i = 0; i < imageHeight; i++) {
      for (let j = 0; j < imageWidth; j++) {
        pixels.push(readPixel(buffer, pixelFormat));
      }
    }
    let image = new Jimp(imageWidth, imageHeight);
    let k = 0;
    for (let i = 0; i < imageHeight; i++) {
      for (let j = 0; j < imageWidth; j++) {
        image.setPixelColor(pixels[k++], j, i);
      }
    }

    image.write("test" + currentImage + ".png", (err) => {
      if (err) throw err;
    });
    
    currentImage++;
  }
};

const readScFile = async (scFileName) => {
  const buffer = fs.readFileSync("sc/" + scFileName);
  const decompressedScFile = SmartBuffer.fromBuffer(await decompress(buffer));

  if (!checkValidity(buffer, decompressedScFile)) {
    console.log('File is corrupted');
  }
  
  if (scFileName.indexOf("_tex") < 0) {
    readNormalScFile(decompressedScFile);
  } else {
    readTexScFile(decompressedScFile);
  }
}

const main = async () => {
  const scFiles = fs.readdirSync("sc");
  // const scFile = 'events.sc';
  // const scFile = 'events_tex.sc';
  // const scFile = 'background_basic.sc';
  // const scFile = "background_basic_tex.sc";
  // const scFile = 'background_snowtel.sc';
  // const scFile = 'background_snowtel_tex.sc';
  // const scFile = 'background_world_finals.sc';
  // const scFile = "characters.sc";
  // const scFile = "characters_tex.sc"; // bad
  // supercell_id sorta works
  // ui_tex no
  const scFile = "supercell_id_tex.sc";
  // for (const scFile of scFiles) {
  readScFile(scFile);
  //}
};

main();
