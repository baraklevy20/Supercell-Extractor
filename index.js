const { readScFile } = require('./src/sc/scFormat');
const { extractShapesByExportName } = require('./src/sc/sections/shape');

module.exports = {
  readScFile,
  extractShapesByExportName,
};
