const { SmartBuffer } = require('smart-buffer');
const md5 = require('js-md5');
const lzma = require('lzma-native');

SmartBuffer.prototype.scDecompress = async function scDecompress() {
  let data = this.internalBuffer.toString('utf8', 0, 2) === 'SC'
    ? this.internalBuffer.slice(26)
    : this.internalBuffer;
  data = [...data.slice(0, 9), 0, 0, 0, 0, ...data.slice(9)];
  const decompressedData = await lzma.decompress(data);
  return SmartBuffer.fromBuffer(Buffer.from(decompressedData));
};

SmartBuffer.prototype.scCheckValidity = function scCheckValidity(decompressedBuffer) {
  // Old versions don't have a md5 hash
  if (this.internalBuffer.toString('utf8', 0, 2) !== 'SC') {
    return true;
  }

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
