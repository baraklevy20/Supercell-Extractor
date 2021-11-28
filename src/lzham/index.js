/* eslint-disable no-underscore-dangle */
const lzham = require('./lzham');

const addArrayToHeap = (arr) => {
  const ptr = lzham._malloc(arr.length);
  lzham.HEAPU8.set(arr, ptr);
  return ptr;
};

const int32ToBytesArray = (num) => {
  const a = new Uint8Array(4);
  a[0] = num & 0xFF;
  a[1] = (num >> 8) & 0xFF;
  a[2] = (num >> 16) & 0xFF;
  a[3] = (num >> 24) & 0xFF;
  return a;
};

const nativeDecompress = lzham.cwrap(
  'lzham_decompress_memory',
  'number',
  ['number', 'number', 'number', 'number', 'number', 'number'],
);

const init = async () => new Promise((resolve) => {
  lzham.onRuntimeInitialized = () => {
    resolve();
  };
});

const decompress = (buffer, { dictSizeLog2, outputSize }) => {
  const pParams = addArrayToHeap([
    32, 0, 0, 0,
    ...int32ToBytesArray(dictSizeLog2),
    8, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
    0, 0, 0, 0,
  ]);

  const pCompressedData = addArrayToHeap(buffer);
  const pDest = lzham._malloc(outputSize);
  const pDestLength = lzham._malloc(4);
  lzham.setValue(pDestLength, outputSize, 'i32');

  const status = nativeDecompress(pParams, pDest, pDestLength, pCompressedData, buffer.length);
  lzham._free(pCompressedData);
  lzham._free(pParams);

  if (status >= 4) {
    lzham._free(pDestLength);
    lzham._free(pDest);
    throw Error(`LZHAM decompress failed with code ${status}`);
  }

  const decompressedSize = lzham.getValue(pDestLength, 'i32');
  const result = lzham.HEAPU8.subarray(pDest, pDest + decompressedSize);
  lzham._free(pDestLength);
  lzham._free(pDest);

  return result;
};

module.exports = {
  init,
  decompress,
};
