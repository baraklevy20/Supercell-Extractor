const sharp = require('sharp');
const pLimit = require('p-limit');
const imageUtils = require('../../imageUtils');
const logger = require('../../../logger');

const getRotationAngle = (outputCoordinates, textureCoordinates, outputRegion, textureRegion) => {
  const normalizedOutputCoordinates = outputCoordinates.map((c) => [
    c[0] / (outputRegion.width),
    c[1] / (outputRegion.height),
  ]);
  const normalizedTextureCoordinates = textureCoordinates.map((c) => [
    c[0] / (textureRegion.width),
    c[1] / (textureRegion.height),
  ]);

  const leftIndex = outputCoordinates.findIndex(((c) => c[0] === outputRegion.left));
  const rightIndex = outputCoordinates.findIndex(((c) => c[0] === outputRegion.right));
  const topIndex = outputCoordinates.findIndex(((c) => c[1] === outputRegion.top));
  const bottomIndex = outputCoordinates.findIndex(((c) => c[1] === outputRegion.bottom));

  const minOutputX = normalizedOutputCoordinates[leftIndex];
  const maxOutputX = normalizedOutputCoordinates[rightIndex];
  const minOutputY = normalizedOutputCoordinates[topIndex];
  const maxOutputY = normalizedOutputCoordinates[bottomIndex];
  const minTextureX = normalizedTextureCoordinates[leftIndex];
  const maxTextureX = normalizedTextureCoordinates[rightIndex];
  const minTextureY = normalizedTextureCoordinates[topIndex];
  const maxTextureY = normalizedTextureCoordinates[bottomIndex];

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

  const left = Math.min(...xCoordinates);
  const right = Math.max(...xCoordinates);
  const top = Math.min(...yCoordinates);
  const bottom = Math.max(...yCoordinates);

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

const readShape = (buffer, textures) => {
  const exportId = buffer.readInt16LE();
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

    for (let j = 0; j < numberOfVertices; j += 1) {
      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      outputCoordinates.push([x, y]);
    }

    const textureCoordinates = [];
    for (let j = 0; j < numberOfVertices; j += 1) {
      const x = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].width);
      const y = Math.round(buffer.readUInt16LE() / 0xffff * textures[textureId].height);
      textureCoordinates.push([x, y]);
    }

    const outputRegion = getRegion(outputCoordinates);
    const textureRegion = getRegion(textureCoordinates);

    const isPolygon = textureRegion.left !== textureRegion.right
      && textureRegion.top !== textureRegion.bottom;

    const size = 0.05;
    const rotationAngle = getRotationAngle(
      outputCoordinates,
      textureCoordinates,
      outputRegion,
      textureRegion,
    );

    const realOutputRegion = {
      left: Math.round(outputRegion.left * size),
      right: Math.round(outputRegion.right * size),
      top: Math.round(outputRegion.top * size),
      bottom: Math.round(outputRegion.bottom * size),
    };

    polygons.push({
      isPolygon,
      textureId,
      textureCoordinates,
      rotationAngle,
      outputCoordinates: outputCoordinates.map((c) => [Math.round(c[0] * size), Math.round(c[1] * size)]),
      textureRegion,
      outputRegion: realOutputRegion,
    });
  }

  const shape = {
    type: 'shape',
    exportId,
    polygons,
  };
  return shape;
};

const extractColor = async (exportId, polygonIndex, polygon, textures) => {
  // Check if textureCoordinates[0] !== textureCoordinates[1]
  const isHorizontalGradient = polygon.textureCoordinates[0][0] !== polygon.textureCoordinates[1][0]
    || polygon.textureCoordinates[0][1] !== polygon.textureCoordinates[1][1];

  const color1Position = polygon.textureCoordinates[0];
  const color2Position = isHorizontalGradient
    ? polygon.textureCoordinates[1]
    : polygon.textureCoordinates[2];

  const texture = textures[polygon.textureId];

  const extractedShape = await imageUtils.createShapeWithColor(
    polygon.outputCoordinates,
    polygon.outputRegion,
    texture.pixels.slice(
      texture.channels * (color1Position[1] * texture.width + color1Position[0]),
      texture.channels * (color1Position[1] * texture.width + color1Position[0]) + texture.channels,
    ),
    texture.pixels.slice(
      texture.channels * (color2Position[1] * texture.width + color2Position[0]),
      texture.channels * (color2Position[1] * texture.width + color2Position[0]) + texture.channels,
    ),
    isHorizontalGradient,
  );

  return {
    exportId,
    polygonIndex,
    pixels: extractedShape.pixels,
    width: extractedShape.width,
    height: extractedShape.height,
    channels: 4,
  };
};

const getShapeRegion = (polygons) => {
  const left = Math.min(...polygons.map((polygon) => polygon.outputRegion.left));
  const right = Math.max(...polygons.map((polygon) => polygon.outputRegion.right));
  const top = Math.min(...polygons.map((polygon) => polygon.outputRegion.top));
  const bottom = Math.max(...polygons.map((polygon) => polygon.outputRegion.bottom));

  return {
    left,
    right,
    top,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
};

const extractShape = async (filename, resource, textures, texturesSharp) => {
  const extractPolygonPromises = [];
  const shapeRegion = getShapeRegion(resource.polygons);
  // const index = 7;
  // const polygon = resource.polygons[index];
  resource.polygons.forEach((polygon, index) => {
    if (polygon.isPolygon) {
      extractPolygonPromises.push(imageUtils.extractPolygon(
        resource.exportId,
        index,
        polygon,
        texturesSharp[polygon.textureId],
      ));
    } else {
      extractPolygonPromises.push(extractColor(
        resource.exportId,
        index,
        polygon,
        textures,
      ));
    }
  });

  const result = await Promise.all(extractPolygonPromises);
  const maxNumberOfChannels = Math.max(...result.map(
    (r) => r.channels,
  ));

  const shape = await sharp({
    create: {
      width: shapeRegion.width,
      height: shapeRegion.height,
      channels: maxNumberOfChannels,
      background: {
        r: 0, g: 0, b: 0, alpha: 0,
      },
    },
  })
    // todo check if the polygons can intersect. if so, what kind of blend mode do we need?
    // otherwise, remove composite as it's slow af
    // maybe they can, check shape 13 in events.sc
    .composite(result.map((r) => ({
      input: r.pixels,
      raw: {
        channels: r.channels,
        width: r.width,
        height: r.height,
      },
      left: resource.polygons[r.polygonIndex].outputRegion.left - shapeRegion.left,
      top: resource.polygons[r.polygonIndex].outputRegion.top - shapeRegion.top,
    })));

  await shape.clone().png().toFile(`out/${filename}-shape${resource.exportId}.png`);

  return {
    type: 'shape',
    exportId: resource.exportId,
    sharp: shape,
    width: shapeRegion.width,
    height: shapeRegion.height,
  };
};

const extractShapes = async (filename, textures, resources) => {
  logger.info('Extracting shapes');
  const extractShapePromises = [];
  const limit = pLimit(10);
  const texturesSharp = textures.map((texture) => sharp(Buffer.from(texture.pixels), {
    raw:
    {
      channels: texture.channels,
      width: texture.width,
      height: texture.height,
    },
  }));

  Object.keys(resources).forEach((exportId) => {
    const resource = resources[exportId];

    if (resource.type === 'shape') {
      extractShapePromises.push(limit(() => extractShape(filename, resource, textures, texturesSharp)));
    }
  });

  const result = await Promise.all(extractShapePromises);
  const shapes = {};

  result.forEach((r) => {
    shapes[r.exportId] = r;
  });

  logger.info('Finished extracting shapes');
  return shapes;
};

module.exports = {
  readShape,
  extractShapes,
};
