const md5 = require('js-md5');
const lzma = require('lzma-native');

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

const readString = (buffer) => {
  const stringLength = buffer.readUInt8();

  if (stringLength === 0xff) {
    return null;
  }

  return buffer.readString(stringLength, 'utf8');
};

module.exports = {
  decompress,
  checkValidity,
  readString,
};
