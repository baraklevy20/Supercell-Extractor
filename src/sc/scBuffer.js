/* eslint-disable no-nested-ternary */
const { SmartBuffer } = require('smart-buffer');
const md5 = require('js-md5');
const lzma = require('lzma-native');
const fzstd = require('fzstd');
const lzham = require('../lzham');

SmartBuffer.prototype.scDecompress = async function scDecompress() {
  const magic = this.readString(2);
  let version = this.readUInt32BE();
  let endOffset;
  const isNormalScFile = magic === 'SC' && version <= 100;

  if (isNormalScFile) {
    if (version === 4) {
      version = this.readUInt32BE();
      endOffset = this.internalBuffer.indexOf('START');
      // The rest of the file seems to contain export names after 'START'
    }

    const hashLength = this.readUInt32BE();
    this.fileHash = this.readBuffer(hashLength).toString('hex');
  } else {
    this.readOffset = 0;
    version = 0;
  }

  if (version >= 2) {
    return SmartBuffer.fromBuffer(Buffer.from(
      fzstd.decompress(this.internalBuffer.slice(this.readOffset, endOffset)),
    ));
  }

  const first9Bytes = this.internalBuffer.slice(this.readOffset, this.readOffset + 9);

  // 5d,0,0 or 5e,0,0 and last byte < 0x20
  if ((first9Bytes[0] === 0x5d || first9Bytes[0] === 0x5e)
    && first9Bytes[1] === 0
    && first9Bytes[2] === 0
    && first9Bytes[8] < 0x20) {
    let compressedData = this.internalBuffer.slice(this.readOffset);
    compressedData = [
      ...compressedData.slice(0, 9), // lzma props (5 bytes) and uncompressed size (4 bytes)
      0, 0, 0, 0, // uncompressed size needs to be 64-bits (8 bytes) so we need to add 4 bytes
      ...compressedData.slice(9, endOffset),
    ];
    const decompressedData = await lzma.decompress(compressedData);
    return SmartBuffer.fromBuffer(Buffer.from(decompressedData));
  }
  if (first9Bytes.slice(0, 4).toString() === 'SCLZ') {
    this.readString(4); // Skip SCLZ
    const dictSizeLog2 = this.readUInt8();
    const outputSize = this.readInt32LE();
    return SmartBuffer.fromBuffer(Buffer.from(
      lzham.decompress(
        this.internalBuffer.slice(this.readOffset, endOffset),
        { dictSizeLog2, outputSize },
      ),
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

SmartBuffer.prototype.scReadTwip = function scReadTwip() {
  return Math.floor(this.readInt32LE() / 20);
};
