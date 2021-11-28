/* eslint-disable no-nested-ternary */
const { SmartBuffer } = require('smart-buffer');
const md5 = require('js-md5');
const lzma = require('lzma-native');
const fzstd = require('fzstd');
const lzham = require('../lzham');

SmartBuffer.prototype.scDecompress = async function scDecompress() {
  const magic = this.readString(2);
  let version = this.readUInt32BE();
  const isNormalScFile = magic === 'SC' && version <= 100;

  if (isNormalScFile) {
    if (version === 4) {
      version = this.readUInt32BE();
    }

    const hashLength = this.readUInt32BE();
    this.fileHash = this.readBuffer(hashLength).toString('hex');
  } else {
    this.readOffset = 0;
    version = 0;
  }

  if (version >= 2) {
    return SmartBuffer.fromBuffer(Buffer.from(
      fzstd.decompress(this.internalBuffer.slice(this.readOffset)),
    ));
  }

  const first9Bytes = this.internalBuffer.slice(this.readOffset, this.readOffset + 9);

  // 5d,0,0 or 5e,0,0 and last byte < 0x20
  if ((first9Bytes[0] === 0x5d || first9Bytes[0] === 0x5e)
    && first9Bytes[1] === 0
    && first9Bytes[2] === 0
    && first9Bytes[8] < 0x20) {
    let compressedData = this.internalBuffer.slice(this.readOffset);
    compressedData = [...compressedData.slice(0, 9), 0, 0, 0, 0, ...compressedData.slice(9)];
    const decompressedData = await lzma.decompress(compressedData);
    return SmartBuffer.fromBuffer(Buffer.from(decompressedData));
  }
  if (first9Bytes.slice(0, 4).toString() === 'SCLZ') {
    this.readString(4); // Skip SCLZ
    const dictSizeLog2 = this.readUInt8();
    const outputSize = this.readInt32LE();
    return SmartBuffer.fromBuffer(Buffer.from(
      lzham.decompress(this.readBuffer(), { dictSizeLog2, outputSize }),
    ));
  }

  throw Error(`Invalid compression algorithm. First 9 bytes: ${first9Bytes}`);
};

SmartBuffer.prototype.scCheckValidity = function scCheckValidity(decompressedBuffer) {
  // Old versions don't have a md5 hash
  if (!this.fileHash) {
    return true;
  }
  const computedHash = md5(decompressedBuffer.internalBuffer);
  return this.fileHash === computedHash;
};

SmartBuffer.prototype.scReadString = function scReadFunction() {
  const stringLength = this.readUInt8();

  if (stringLength === 0xff) {
    return null;
  }

  return this.readString(stringLength, 'utf8');
};
