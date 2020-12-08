const readTransformMatrix = (buffer) => ({
  matrix: [
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
    buffer.readInt32LE() / 1024,
  ],
  odx: buffer.readInt32LE() * 0.05,
  ody: buffer.readInt32LE() * 0.05,
});

module.exports = {
  readTransformMatrix,
};
