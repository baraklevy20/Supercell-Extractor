const readColorTransform = (buffer) => {
  const colorTransform = {
    redMultiplier: buffer.readUInt8(),
    greenMultiplier: buffer.readUInt8(),
    blueMultiplier: buffer.readUInt8(),
    alphaMultiplier: buffer.readUInt8(),
    redAddition: buffer.readUInt8(),
    greenAddition: buffer.readUInt8(),
    blueAddition: buffer.readUInt8(),
  };
  console.log('color transform:', colorTransform);
  return colorTransform;
};

module.exports = {
  readColorTransform,
};
