const logger = require('../../../logger');

const readTextField = (buffer, tag) => {
  const textField = {};
  textField.exportId = buffer.readInt16LE();
  // logger.info(`TextField exportID: ${exportId}`);
  textField.fontName = buffer.scReadString();
  textField.fontColorInARGB = buffer.readInt32LE();
  textField.isBold = !!buffer.readUInt8();
  textField.isItalic = !!buffer.readUInt8();
  textField.isMultiLine = !!buffer.readUInt8();
  buffer.readUInt8(); // not used
  // if 2 => multiply by 2. otherwise, reduce by 3.
  // Seems like a binary flag. Maybe margin or something
  textField.unknownC5 = buffer.readUInt8();
  textField.fontSize = buffer.readUInt8();
  textField.left = buffer.readInt16LE();
  textField.top = buffer.readInt16LE();
  textField.right = buffer.readInt16LE();
  textField.bottom = buffer.readInt16LE();
  textField.unk = !!buffer.readUInt8();
  textField.placeholderText = buffer.scReadString();

  if (tag > 0x7) {
    textField.unknownFlag5 = !!buffer.readUInt8();
  }

  if (tag > 0xf) {
    textField.unknownFlag6 = tag !== 0x19;
  }

  if (tag > 0x14) {
    textField.outlineColor = buffer.readUInt32LE();
  }

  if (tag > 0x19) {
    textField.c14 = buffer.readInt16LE();
    buffer.readUInt16LE(); // unused
  }

  if (tag > 0x21) {
    // probably changing text color such as in first 3 brawlers in leaderboard
    textField.c15 = buffer.readInt16LE();
  }

  if (tag > 0x2b) {
    textField.unknownFlag7 = !!buffer.readUInt8();
  }

  return textField;
};

module.exports = {
  readTextField,
};
