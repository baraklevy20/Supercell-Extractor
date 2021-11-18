/* eslint-disable no-nested-ternary */
const { SmartBuffer } = require('smart-buffer');
const md5 = require('js-md5');
const lzma = require('lzma-native');

SmartBuffer.prototype.scDecompress = async function scDecompress() {
  this.scFileVersion = this.internalBuffer.toString('utf8', 0, 2) !== 'SC' ? 0
    : this.internalBuffer.readUInt32BE(2) === 1 ? 1 : 2;

  let data = this.scFileVersion === 0 ? this.internalBuffer
    : this.scFileVersion === 1 ? this.internalBuffer.slice(26)
      : this.internalBuffer.slice(26 + 4);

  data = [...data.slice(0, 9), 0, 0, 0, 0, ...data.slice(9)];
  const decompressedData = await lzma.decompress(data);
  return SmartBuffer.fromBuffer(Buffer.from(decompressedData));
};

SmartBuffer.prototype.scCheckValidity = function scCheckValidity(decompressedBuffer) {
  // Old versions don't have a md5 hash
  if (this.scFileVersion === 0) {
    return true;
  }
  const startingIndex = this.scFileVersion === 1 ? 10 : 14;

  const fileHash = this.internalBuffer.slice(startingIndex, startingIndex + 16).toString('hex');
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
