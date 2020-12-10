const sharp = require('sharp');
const imageUtils = require('../../imageUtils');
const logger = require('../../../logger');

const getRotationAngle = (outputCoordinates, textureCoordinates, outputRegion, textureRegion) => {
  const normalizedOutputCoordinates = outputCoordinates.map((c) => [
    c[0] / (outputRegion.maxX - outputRegion.minX),
    c[1] / (outputRegion.maxY - outputRegion.minY),
  ]);
  const normalizedTextureCoordinates = textureCoordinates.map((c) => [
    c[0] / (textureRegion.maxX - textureRegion.minX),
    c[1] / (textureRegion.maxY - textureRegion.minY),
  ]);

  const minXIndex = outputCoordinates.findIndex(((c) => c[0] === outputRegion.minX));
  const maxXIndex = outputCoordinates.findIndex(((c) => c[0] === outputRegion.maxX));
  const minYIndex = outputCoordinates.findIndex(((c) => c[1] === outputRegion.minY));
  const maxYIndex = outputCoordinates.findIndex(((c) => c[1] === outputRegion.maxY));

  const minOutputX = normalizedOutputCoordinates[minXIndex];
  const maxOutputX = normalizedOutputCoordinates[maxXIndex];
  const minOutputY = normalizedOutputCoordinates[minYIndex];
  const maxOutputY = normalizedOutputCoordinates[maxYIndex];
  const minTextureX = normalizedTextureCoordinates[minXIndex];
  const maxTextureX = normalizedTextureCoordinates[maxXIndex];
  const minTextureY = normalizedTextureCoordinates[minYIndex];
  const maxTextureY = normalizedTextureCoordinates[maxYIndex];

  if (Math.fround(minOutputX[1] - minTextureX[0]) === Math.fround(maxOutputX[1] - maxTextureX[0])
      && Math.fround(minOutputX[0] + minTextureX[1]) === Math.fround(maxOutputX[0] + maxTextureX[1])
      && Math.fround(minOutputY[1] - minTextureY[0]) === Math.fround(maxOutputY[1] - maxTextureY[0])
      && Math.fround(minOutputY[0] + minTextureY[1]) === Math.fround(maxOutputY[0] + maxTextureY[1])
  ) {
    return 90;
  } if (Math.fround(minOutputX[1] + minTextureX[0]) === Math.fround(maxOutputX[1] + maxTextureX[0])
      && Math.fround(minOutputX[0] - minTextureX[1]) === Math.fround(maxOutputX[0] - maxTextureX[1])
      && Math.fround(minOutputY[1] + minTextureY[0]) === Math.fround(maxOutputY[1] + maxTextureY[0])
      && Math.fround(minOutputY[0] - minTextureY[1]) === Math.fround(maxOutputY[0] - maxTextureY[1])
  ) {
    return -90;
  } if (Math.fround(minOutputX[0] - minTextureX[0]) === Math.fround(maxOutputX[0] - maxTextureX[0])
      && Math.fround(minOutputX[1] + minTextureX[1]) === Math.fround(maxOutputX[1] + maxTextureX[1])
      && Math.fround(minOutputY[0] - minTextureY[0]) === Math.fround(maxOutputY[0] - maxTextureY[0])
      && Math.fround(minOutputY[1] + minTextureY[1]) === Math.fround(maxOutputY[1] + maxTextureY[1])
  ) {
    return 180;
  }

  return 0;
};

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

const readShape = (buffer, textures) => {
  const exportId = buffer.readInt16LE();
  // logger.debug(`Shape exportID: ${exportId}`);

  const numberOfPolygons = buffer.readUInt16LE();
  const totalNumberOfVertices = buffer.readUInt16LE();

  let innerBlockSize;
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
    const outputCoordinates = [];

    for (let j = 0; j < numberOfVertices; j++) {
      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      outputCoordinates.push([x, y]);
    }

    // logger.debug('output coordinates:', outputCoordinates);

    const textureCoordinates = [];
    for (let j = 0; j < numberOfVertices; j++) {
      const x = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].width);
      const y = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].height);
      textureCoordinates.push([x, y]);
    }

    const outputRegion = getRegion(outputCoordinates);
    const textureRegion = getRegion(textureCoordinates);

    // logger.debug('textureCoordinates: ', textureCoordinates);

    const isPolygon = textureRegion.minX !== textureRegion.maxX
      && textureRegion.minY !== textureRegion.maxY;

    const size = 0.05;
    const rotationAngle = getRotationAngle(
      outputCoordinates,
      textureCoordinates,
      outputRegion,
      textureRegion,
    );

    polygons.push({
      isPolygon,
      textureId,
      textureCoordinates,
      rotationAngle,
      outputCoordinates: outputCoordinates.map((c) => [Math.round(c[0] * size), Math.round(c[1] * size)]),
      scaleWidth: Math.round(((outputRegion.maxX - outputRegion.minX) * size)),
      scaleHeight: Math.round(((outputRegion.maxY - outputRegion.minY) * size)),
      minX: Math.round(outputRegion.minX * size),
      minY: Math.round(outputRegion.minY * size),
    });
  }

  const shape = {
    type: 'shape',
    exportId,
    polygons,
  };
  return shape;
};

const extractColor = async (exportId, polygonIndex, polygon, textures, tx, ty) => {
  if (polygonIndex === 3) {
    // logger.debug('what');
  }
  // todo sometimes textureCoordinates[0] = textureCoordinates[2] and
  // textureCoordinates[1]=textureCoordinates[3] wtf
  const color1Position = polygon.textureCoordinates[0];
  const color2Position = polygon.textureCoordinates[0][0] !== polygon.textureCoordinates[1][0]
    || polygon.textureCoordinates[0][1] !== polygon.textureCoordinates[1][1]
    ? polygon.textureCoordinates[1]
    : polygon.textureCoordinates[2];

  const extractedShape = await imageUtils.createShapeWithColor(
    polygon.outputCoordinates,
    textures[polygon.textureId].pixels[color1Position[1] * textures[polygon.textureId].width + color1Position[0]],
    textures[polygon.textureId].pixels[color2Position[1] * textures[polygon.textureId].width + color2Position[0]],
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
    polygon.outputCoordinates.forEach((coordinate) => {
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

const extractShape = async (filename, resource, textures) => {
  const extractPolygonPromises = [];
  const shapeRegion = getShapeRegion(resource.polygons);
  resource.polygons.forEach(async (polygon, index) => {
    if (polygon.isPolygon) {
      extractPolygonPromises.push(imageUtils.extractPolygon(
        resource.exportId,
        index,
        polygon,
        textures[polygon.textureId],
      ));
    } else {
      extractPolygonPromises.push(extractColor(
        resource.exportId,
        index,
        polygon,
        textures,
        shapeRegion.minX,
        shapeRegion.minY,
      ));
    }
  });

  const result = await Promise.all(extractPolygonPromises);
  const shapeWidth = shapeRegion.maxX - shapeRegion.minX + 1;
  const shapeHeight = shapeRegion.maxY - shapeRegion.minY + 1;

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
      left: resource.polygons[r.polygonIndex].minX - shapeRegion.minX,
      top: resource.polygons[r.polygonIndex].minY - shapeRegion.minY,
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
    .toFile(`out/${filename}-shape${resource.exportId}.png`);
  return {
    type: 'shape',
    exportId: resource.exportId,
    pixels: shape,
    width: shapeWidth,
    height: shapeHeight,
  };
};

const extractShapes = async (filename, textures, resources) => {
  logger.info('Extracting shapes');
  const extractShapePromises = [];
  Object.keys(resources).forEach((exportId) => {
    const resource = resources[exportId];

    if (resource.type === 'shape') {
      extractShapePromises.push(extractShape(filename, resource, textures));
    }
  });

  const shapes = await Promise.all(extractShapePromises);
  logger.info('Finished extracting shapes');
  return shapes;
};

module.exports = {
  readShape,
  extractShapes,
};
