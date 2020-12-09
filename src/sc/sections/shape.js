const readShape = (buffer, textures) => {
  // This is auto incremented
  const exportId = buffer.readInt16LE();
  // console.log(`Shape exportID: ${exportId}`);

  if (exportId === 0) {
    // console.log('wtf');
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
    // console.log(`Header: ${blockHeader} Polygons: ${numberOfPolygons} TextureID: ${textureId} Layout type: ${textures[textureId].layoutType} Pixel Format: ${textures[textureId].pixelFormat}`);

    if (oldTextureId !== undefined && oldTextureId !== textureId) {
      // console.log('DIFFERENT TEXTURE, SAME SHAPE');
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

      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      console.log([x, y]);
      coordinates.push([x, y]);
    }

    // console.log(`${polygons.length}coordinates:`, coordinates);

    const polygon = [];
    for (let j = 0; j < numberOfVertices; j++) {
      const x = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].width);
      const y = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].height);
      // let x = buffer.readUInt16LE();
      // let y = buffer.readUInt16LE();
      // // console.log(`polygon fake: ${[x * 5 / textures[textureId].width, y * 5 / textures[textureId].height]}`);
      // console.log(`polygon real: ${[x / 0xffff * textures[textureId].width, y / 0xffff * textures[textureId].height]}`);
      // x = Math.round(x / 0xffff * textures[textureId].width);
      // y = Math.round(y / 0xffff * textures[textureId].height);
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
    const minYIndex = coordinates.findIndex(((c) => c[1] === coordinatesRegion.minY));
    const maxYIndex = coordinates.findIndex(((c) => c[1] === coordinatesRegion.maxY));
    const coordinate0 = normalizedCoordinates[minXIndex];
    const coordinate1 = normalizedCoordinates[maxXIndex];
    const coordinate2 = normalizedCoordinates[minYIndex];
    const coordinate3 = normalizedCoordinates[maxYIndex];
    const polygon0 = normalizedPolygon[minXIndex];
    const polygon1 = normalizedPolygon[maxXIndex];
    const polygon2 = normalizedPolygon[minYIndex];
    const polygon3 = normalizedPolygon[maxYIndex];
    let rotationAngle = 0;

    if (Math.fround(coordinate0[1] - polygon0[0]) === Math.fround(coordinate1[1] - polygon1[0])
      && Math.fround(coordinate0[0] + polygon0[1]) === Math.fround(coordinate1[0] + polygon1[1])
      && Math.fround(coordinate2[1] - polygon2[0]) === Math.fround(coordinate3[1] - polygon3[0])
      && Math.fround(coordinate2[0] + polygon2[1]) === Math.fround(coordinate3[0] + polygon3[1])
    ) {
      rotationAngle = 90;
      console.log('rotate 90');
    } else if (Math.fround(coordinate0[1] + polygon0[0]) === Math.fround(coordinate1[1] + polygon1[0])
      && Math.fround(coordinate0[0] - polygon0[1]) === Math.fround(coordinate1[0] - polygon1[1])
      && Math.fround(coordinate2[1] + polygon2[0]) === Math.fround(coordinate3[1] + polygon3[0])
      && Math.fround(coordinate2[0] - polygon2[1]) === Math.fround(coordinate3[0] - polygon3[1])
    ) {
      rotationAngle = -90;
      console.log('rotate -90');
    } else if (Math.fround(coordinate0[0] - polygon0[0]) === Math.fround(coordinate1[0] - polygon1[0])
      && Math.fround(coordinate0[1] + polygon0[1]) === Math.fround(coordinate1[1] + polygon1[1])
      && Math.fround(coordinate2[0] - polygon2[0]) === Math.fround(coordinate3[0] - polygon3[0])
      && Math.fround(coordinate2[1] + polygon2[1]) === Math.fround(coordinate3[1] + polygon3[1])
    ) {
      rotationAngle = 180;
      console.log('rotate 180');
    }

    const rotatePoint = (p, angle) => {
      switch (angle) {
        case 0: return p;
        case 90: return [-p[1], p[0]];
        case -90: return [p[1], -p[0]];
        case 180: return [-p[0], -p[1]];
        default:
          return null;
      }
    };
    const rotatedCoordinates = coordinates.map((c) => rotatePoint(c, rotationAngle));
    const rotatedCoordinatesRegion = getRegion(rotatedCoordinates);
    const sx = 1 / (rotatedCoordinatesRegion.maxX - rotatedCoordinatesRegion.minX) * (polygonRegion.maxX - polygonRegion.minX);
    const sy = 1 / (rotatedCoordinatesRegion.maxY - rotatedCoordinatesRegion.minY) * (polygonRegion.maxY - polygonRegion.minY);
    // todo scale polygon, not coordinates
    const normalizedRotatedCoordinates = rotatedCoordinates.map((c) => [Math.ceil(c[0] * sx), Math.ceil(c[1] * sy)]);

    // console.log('polygon: ', polygon);

    // maybe gradient. see supercell_id
    const isPolygon = polygonRegion.minX !== polygonRegion.maxX && polygonRegion.minY !== polygonRegion.maxY;
    if (!isPolygon) {
      console.log('ONE POINT POLYGON', exportId, polygon);
    }

    polygons.push(polygon);
    const size = 0.1;
    shapes.push({
      textureId,
      polygon,
      isPolygon,
      rotationAngle,
      coordinates: coordinates.map((c) => [Math.round(c[0] * size), Math.round(c[1] * size)]),
      scaleWidth: Math.round(((coordinatesRegion.maxX - coordinatesRegion.minX) * size)),
      scaleHeight: Math.round(((coordinatesRegion.maxY - coordinatesRegion.minY) * size)),
      minX: coordinatesRegion.minX * size,
      minY: coordinatesRegion.minY * size,
    });
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
