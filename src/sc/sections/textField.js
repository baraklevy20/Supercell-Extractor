const logger = require('../../../logger');

const readTextField = (buffer, blockType) => {
  const exportId = buffer.readInt16LE();
  // logger.info(`TextField exportID: ${exportId}`);
  const text = buffer.scReadString();
  const textColor = buffer.readInt32LE(); // in ARGB
  const flag1 = buffer.readUInt8(); // maybe text modifier - 0 or 1
  const flag2 = buffer.readUInt8(); // maybe text modifier - 0 or 1
  const flag3 = buffer.readUInt8(); // maybe text modifier - 0 or 1
  const c4 = buffer.readUInt8(); // not sure if used
  const c5 = buffer.readUInt8(); // if 2 => multiply by 2. otherwise, reduce by 3
  const c6 = buffer.readUInt8(); // something is multiplied by this
  const transform0 = buffer.readInt16LE();
  const transform1 = buffer.readInt16LE();
  const transform2 = buffer.readInt16LE();
  const transform3 = buffer.readInt16LE();
  const flag4 = buffer.readUInt8(); // maybe text modifier - 0 or 1
  const text2 = buffer.scReadString();

  let flag5;
  let anotherColor;
  let c14;
  let c15;

  if (blockType !== 0x07) {
    flag5 = buffer.readUInt8(); // maybe text modifier - 0 or 1

    if (blockType === 0x15) {
      anotherColor = buffer.readUInt32LE();
    } else if (blockType === 0x21) {
      anotherColor = buffer.readUInt32LE();
      c14 = buffer.readInt16LE();
      c15 = buffer.readInt16LE();
    } else if (blockType === 0x2c) {
      buffer.readBuffer(11); // not sure what these are yet
    }
  }

  const textField = {
    exportId,
    type: 'textField',
    text,
    text2,
    textColor,
    flag1,
    flag2,
    flag3,
    c4,
    c5,
    c6,
    transform0,
    transform1,
    transform2,
    transform3,
    flag4,
    flag5,
    anotherColor,
    c14,
    c15,
  };

  // logger.debug(textField);
  return textField;

  // logger.info('TextField: ', textField);
};

module.exports = {
  readTextField,
};
