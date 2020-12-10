const { SmartBuffer } = require('smart-buffer');
const md5 = require('js-md5');
const lzma = require('lzma-native');

SmartBuffer.prototype.scDecompress = async function scDecompress() {
  let data = this.internalBuffer.slice(26);
  data = [...data.slice(0, 9), 0, 0, 0, 0, ...data.slice(9)];
  const decompressedData = await lzma.decompress(data);
  return SmartBuffer.fromBuffer(Buffer.from(decompressedData));
};

SmartBuffer.prototype.scOldDecompress = async function scOldDecompress() {
  let data = this.internalBuffer;
  data = [...data.slice(0, 9), 0, 0, 0, 0, ...data.slice(9)];
  const decompressedData = await lzma.decompress(data);
  return SmartBuffer.fromBuffer(Buffer.from(decompressedData));
};

SmartBuffer.prototype.scCheckValidity = function scCheckValidity(decompressedBuffer) {
  const fileHash = this.internalBuffer.slice(10, 26).toString('hex');
  const computedHash = md5(decompressedBuffer.internalBuffer);
  return fileHash === computedHash;
};

SmartBuffer.prototype.scReadString = function scReadFunction() {
  const stringLength = this.readUInt8();

  if (stringLength === 0xff) {
    return null;
  }

  return this.readString(stringLength, 'utf8');
};
