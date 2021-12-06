const readTransformMatrix = (buffer) => ({
  matrix: [
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
  ],
  odx: buffer.scReadTwip(),
  ody: buffer.scReadTwip(),
});

module.exports = {
  readTransformMatrix,
};
