const utils = require('../utils');

const readTextField = (buffer, blockType) => {
  const exportId = buffer.readInt16LE();
  console.log(`TextField exportID: ${exportId}`);
  const text = utils.readString(buffer);
  const v60 = buffer.readInt32LE();
  const c1 = buffer.readUInt8(); // maybe text modifier
  const c2 = buffer.readUInt8(); // maybe text modifier
  const c3 = buffer.readUInt8(); // maybe text modifier
  const c4 = buffer.readUInt8(); // not sure if used
  const c5 = buffer.readUInt8();
  const c6 = buffer.readUInt8();
  const c7 = buffer.readInt16LE();
  const c8 = buffer.readInt16LE();
  const c9 = buffer.readInt16LE();
  const c10 = buffer.readInt16LE();
  const c11 = buffer.readUInt8(); // maybe text modifier
  const text2 = utils.readString(buffer);

  let c12;
  let c13;
  if (blockType !== 0x07) {
    c12 = buffer.readUInt8(); // maybe text modifier

    if (blockType === 0x15) {
      c13 = buffer.readUInt32LE();
    }
  }

  const textField = {
    exportId,
    type: 'textField',
    text,
    text2,
    v60,
    c1,
    c2,
    c3,
    c4,
    c5,
    c6,
    c7,
    c8,
    c9,
    c10,
    c11,
    c12,
    c13,
  };

  return textField;

  // console.log('TextField: ', textField);
};

module.exports = {
  readTextField,
};
