const logger = require('../../../logger');

const readTextField = (buffer, blockType) => {
  const exportId = buffer.readInt16LE();
  // logger.info(`TextField exportID: ${exportId}`);
  const fontName = buffer.scReadString();
  const fontColorInARGB = buffer.readInt32LE();
  const isBold = !!buffer.readUInt8();
  const isItalic = !!buffer.readUInt8();
  const isMultiLine = !!buffer.readUInt8();
  buffer.readUInt8(); // not used
  // if 2 => multiply by 2. otherwise, reduce by 3.
  // Seems like a binary flag. Maybe margin or something
  const unknownC5 = buffer.readUInt8();
  const fontSize = buffer.readUInt8();
  const left = buffer.readInt16LE();
  const top = buffer.readInt16LE();
  const right = buffer.readInt16LE();
  const bottom = buffer.readInt16LE();
  const isUppercase = !!buffer.readUInt8();
  const unknownText2 = buffer.scReadString();

  let unknownFlag5;
  let outlineColor;
  let c14;
  let c15;

  if (blockType !== 0x07) {
    unknownFlag5 = !!buffer.readUInt8(); // maybe text modifier - 0 or 1

    if (blockType === 0x15) {
      outlineColor = buffer.readUInt32LE();
    } else if (blockType === 0x21) {
      outlineColor = buffer.readUInt32LE();
      c14 = buffer.readInt16LE();
      c15 = buffer.readInt16LE();
    } else if (blockType === 0x2c) {
      buffer.readBuffer(11); // not sure what these are yet
    }
  }

  const textField = {
    exportId,
    type: 'textField',
    fontName,
    text2: unknownText2,
    fontColorInARGB,
    isBold,
    isItalic,
    isMultiLine,
    c5: unknownC5,
    fontSize,
    transform0: left,
    transform1: top,
    transform2: right,
    transform3: bottom,
    isUppercase,
    flag5: unknownFlag5,
    outlineColor,
    c14,
    c15,
  };

  return textField;

  // logger.info('TextField: ', textField);
};

module.exports = {
  readTextField,
};
