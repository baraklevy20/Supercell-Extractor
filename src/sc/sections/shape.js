const sharp = require('sharp');
const imageUtils = require('../../imageUtils');

const readShape = (buffer, textures) => {
  const exportId = buffer.readInt16LE();
  // logger.debug(`Shape exportID: ${exportId}`);

  const numberOfPolygons = buffer.readUInt16LE();
  const totalNumberOfVertices = buffer.readUInt16LE();

  let innerBlockSize;
  const shapes = [];

  const polygons = [];
  let textureId;
  while (innerBlockSize !== 0) {
    const blockHeader = buffer.readUInt8(); // either 0x16=22 or 0x00=0
    innerBlockSize = buffer.readUInt32LE();

    if (innerBlockSize === 0) {
      break;
    }

    // logger.debug(`Type 12 block header: ${blockHeader}`);

    textureId = buffer.readUInt8();
    const numberOfVertices = buffer.readUInt8();
    const coordinates = [];

    for (let j = 0; j < numberOfVertices; j++) {
      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      coordinates.push([x, y]);
    }

    // logger.debug(`${polygons.length}coordinates:`, coordinates);

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
    } else if (Math.fround(coordinate0[1] + polygon0[0]) === Math.fround(coordinate1[1] + polygon1[0])
      && Math.fround(coordinate0[0] - polygon0[1]) === Math.fround(coordinate1[0] - polygon1[1])
      && Math.fround(coordinate2[1] + polygon2[0]) === Math.fround(coordinate3[1] + polygon3[0])
      && Math.fround(coordinate2[0] - polygon2[1]) === Math.fround(coordinate3[0] - polygon3[1])
    ) {
      rotationAngle = -90;
    } else if (Math.fround(coordinate0[0] - polygon0[0]) === Math.fround(coordinate1[0] - polygon1[0])
      && Math.fround(coordinate0[1] + polygon0[1]) === Math.fround(coordinate1[1] + polygon1[1])
      && Math.fround(coordinate2[0] - polygon2[0]) === Math.fround(coordinate3[0] - polygon3[0])
      && Math.fround(coordinate2[1] + polygon2[1]) === Math.fround(coordinate3[1] + polygon3[1])
    ) {
      rotationAngle = 180;
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

    // logger.debug('polygon: ', polygon);

    // maybe gradient. see supercell_id
    const isPolygon = polygonRegion.minX !== polygonRegion.maxX && polygonRegion.minY !== polygonRegion.maxY;

    polygons.push(polygon);
    const size = 0.05;
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

const extractColor = async (exportId, polygonIndex, shape, textures, tx, ty) => {
  if (polygonIndex === 3) {
    // logger.debug('what');
  }
  // todo sometimes polygon[0] = polygon[2] and polygon[1]=polygon[3] wtf
  const color1Position = shape.polygon[0];
  const color2Position = shape.polygon[0][0] !== shape.polygon[1][0]
    || shape.polygon[0][1] !== shape.polygon[1][1] ? shape.polygon[1] : shape.polygon[2];
  const extractedShape = await imageUtils.createShapeWithColor(
    shape.coordinates,
    textures[shape.textureId].pixels[color1Position[1] * textures[shape.textureId].width + color1Position[0]],
    textures[shape.textureId].pixels[color2Position[1] * textures[shape.textureId].width + color2Position[0]],
    tx,
    ty,
  );

  return {
    exportId,
    polygonIndex,
    pixels: extractedShape.pixels,
    width: extractedShape.width,
    height: extractedShape.height,
  };
};

const getShapeRegion = (polygons) => {
  const allX = [];
  const allY = [];
  polygons.forEach((polygon) => {
    polygon.coordinates.forEach((coordinate) => {
      allX.push(coordinate[0]);
      allY.push(coordinate[1]);
    });
  });

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  return {
    minX, maxX, minY, maxY,
  };
};

const extractShapes = async (textures, resources) => {
  for (const exportId in resources) {
    const resource = resources[exportId];

    if (resource.type === 'shape') {
      const extractShapePromises = [];
      const shapeRegion = getShapeRegion(resource.shapes);
      resource.shapes.forEach(async (shape, index) => {
        if (shape.isPolygon) {
          extractShapePromises.push(imageUtils.extractShapeAndResize(
            exportId,
            index,
            shape,
            textures[shape.textureId],
          ));
        } else {
          extractShapePromises.push(extractColor(exportId, index, shape, textures, shapeRegion.minX, shapeRegion.minY));
        }
      });

      const result = await Promise.all(extractShapePromises);
      const shapeWidth = Math.round(shapeRegion.maxX - shapeRegion.minX) + 1;
      const shapeHeight = Math.round(shapeRegion.maxY - shapeRegion.minY) + 1;

      // todo remove round, make sure coordinates are integers instead
      const shape = await sharp({
        create: {
          width: shapeWidth,
          height: shapeHeight,
          channels: 4,
          background: {
            r: 0, g: 0, b: 0, alpha: 0,
          },
        },
      })
        .composite(result.map((r) => ({
          input: r.pixels,
          raw: {
            channels: 4,
            width: r.width,
            height: r.height,
          },
          left: Math.round(resource.shapes[r.polygonIndex].minX - shapeRegion.minX),
          top: Math.round(resource.shapes[r.polygonIndex].minY - shapeRegion.minY),
        })))
        .toBuffer();
      await sharp(shape, {
        raw: {
          channels: 4,
          width: shapeWidth,
          height: shapeHeight,
        },
      })
        .png()
        .toFile(`out/shape${exportId}.png`);
      resource.finalShape = {
        pixels: shape,
        width: shapeWidth,
        height: shapeHeight,
      };
    }
  }
  // const result = await Promise.all(extractShapePromises);
  // result.forEach((extractedShape) => {
  //   if (extractedShape) {
  //     resources[extractedShape.exportId].extractedShapes.push(extractedShape);
  //   }
  // });
};

module.exports = {
  readShape,
  extractShapes,
};
