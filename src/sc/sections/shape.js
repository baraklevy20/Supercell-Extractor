const imageUtils = require('../../imageUtils');

const readShape = (buffer, textures) => {
  // This is auto incremented
  const exportId = buffer.readInt16LE();
  console.log(`Shape exportID: ${exportId}`);

  if (exportId === 19) {
    console.log('wtf');
  }
  const numberOfPolygons = buffer.readUInt16LE();
  const totalNumberOfVertices = buffer.readUInt16LE();

  let innerBlockSize;
  const shapes = [];

  const polygons = [];
  let textureId;
  let oldTextureId;
  while (innerBlockSize !== 0) {
    const blockHeader = buffer.readUInt8(); // either 0x16=22 or 0x00=0
    // console.log(blockHeader);
    innerBlockSize = buffer.readUInt32LE();

    if (innerBlockSize === 0) {
      break;
    }

    // console.log(`Type 12 block header: ${blockHeader}`);

    textureId = buffer.readUInt8();
    console.log(`Header: ${blockHeader} Polygons: ${numberOfPolygons} TextureID: ${textureId} Layout type: ${textures[textureId].layoutType} Pixel Format: ${textures[textureId].pixelFormat}`);

    if (oldTextureId !== undefined && oldTextureId !== textureId) {
      console.log('DIFFERENT TEXTURE, SAME SHAPE');
    }
    oldTextureId = textureId;
    const numberOfVertices = buffer.readUInt8();
    const coordinates = [];

    for (let j = 0; j < numberOfVertices; j++) {
      // Layout type: 1 Pixel Format: 0 - 0.05
      // Layout type: 1 Pixel Format: 6 - 0.05 * 10 / 7
      // Layout type: 28 Pixel Format: 0 - 0.1
      // Layout type: 1 Pixel Format: 0 - 0.1
      // Layout type: 28 Pixel Format: 0 - 0.05

      const x = buffer.readInt32LE() * 0.1; // * 10 / 7 for
      const y = buffer.readInt32LE() * 0.1;
      coordinates.push([x, y]);
    }

    // console.log('coordinates: ', coordinates);

    const polygon = [];
    for (let j = 0; j < numberOfVertices; j++) {
      const x = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].width);
      const y = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].height);
      polygon.push([x, y]);
    }

    const getRegion = (coordinates) => {
      const xCoordinates = coordinates.map((c) => c[0]);
      const yCoordinates = coordinates.map((c) => c[1]);

      const minX = Math.min(...xCoordinates);
      const maxX = Math.max(...xCoordinates);
      const minY = Math.min(...yCoordinates);
      const maxY = Math.max(...yCoordinates);

      return {
        minX, maxX, minY, maxY,
      };
    };

    const coordinatesRegion = getRegion(coordinates);
    const polygonRegion = getRegion(polygon);
    const normalizedCoordinates = coordinates.map((c) => [
      c[0] / (coordinatesRegion.maxX - coordinatesRegion.minX),
      c[1] / (coordinatesRegion.maxY - coordinatesRegion.minY),
    ]);
    const normalizedPolygon = polygon.map((c) => [
      c[0] / (polygonRegion.maxX - polygonRegion.minX),
      c[1] / (polygonRegion.maxY - polygonRegion.minY),
    ]);

    const minXIndex = coordinates.findIndex(((c) => c[0] === coordinatesRegion.minX));
    const maxXIndex = coordinates.findIndex(((c) => c[0] === coordinatesRegion.maxX));
    const coordinate0 = normalizedCoordinates[minXIndex];
    const coordinate1 = normalizedCoordinates[maxXIndex];
    const polygon0 = normalizedPolygon[minXIndex];
    const polygon1 = normalizedPolygon[maxXIndex];
    let rotationAngle = 0;

    if (Math.fround(coordinate0[1] - polygon0[0]) === Math.fround(coordinate1[1] - polygon1[0])
      && Math.fround(coordinate0[0] + polygon0[1]) === Math.fround(coordinate1[0] + polygon1[1])) {
      rotationAngle = 90;
      console.log('rotate 90');
    } else if (Math.fround(coordinate0[1] + polygon0[0]) === Math.fround(coordinate1[1] + polygon1[0])
      && Math.fround(coordinate0[0] - polygon0[1]) === Math.fround(coordinate1[0] - polygon1[1])) {
      rotationAngle = -90;
      console.log('rotate -90');
    } else if (Math.fround(coordinate0[0] - polygon0[0]) === Math.fround(coordinate1[0] - polygon1[0])
      && Math.fround(coordinate0[1] + polygon0[1]) === Math.fround(coordinate1[1] + polygon1[1])) {
      rotationAngle = 180;
      console.log('rotate 180');
    }

    // console.log('polygon: ', polygon);

    if (polygon[0][0] === polygon[1][0] && polygon[0][1] === polygon[1][1]) {
      console.log('ONE POINT POLYGON');
    }

    polygons.push(polygon);
    // const shapeImage = await imageUtils.extractShape(polygon, rotationAngle, textures[textureId]);
    // if (shapeImage) {
    // imageUtils.saveSharp(`out/exportID ${exportId} polygon number ${polygons.length}`, shapeImage.shape);
    shapes.push({
      textureId,
      polygon,
      rotationAngle,
    });
    // }
  }

  const shape = {
    type: 'shape',
    exportId,
    shapes,
  };
  return shape;
};

module.exports = {
  readShape,
};
