const readColorTransform = (buffer) => {
  const colorTransform = {
    blueAddition: buffer.readUInt8(),
    greenAddition: buffer.readUInt8(),
    redAddition: buffer.readUInt8(),
    alphaMultiplier: buffer.readUInt8(),
    blueMultiplier: buffer.readUInt8(),
    greenMultiplier: buffer.readUInt8(),
    redMultiplier: buffer.readUInt8(),
  };
  return colorTransform;
};

module.exports = {
  readColorTransform,
};
