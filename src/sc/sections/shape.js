const sharp = require('sharp');
const pLimit = require('p-limit');
const imageUtils = require('../../imageUtils');
const logger = require('../../../logger');

const getRotationAngle = (outputCoordinates, uv, xyRegion, uvRegion) => {
  const normalizedOutputCoordinates = outputCoordinates.map((c) => [
    c[0] / (xyRegion.width),
    c[1] / (xyRegion.height),
  ]);
  const normalizedUV = uv.map((c) => [
    c[0] / (uvRegion.width),
    c[1] / (uvRegion.height),
  ]);

  const leftIndex = outputCoordinates.findIndex(((c) => c[0] === xyRegion.left));
  const rightIndex = outputCoordinates.findIndex(((c) => c[0] === xyRegion.right));
  const topIndex = outputCoordinates.findIndex(((c) => c[1] === xyRegion.top));
  const bottomIndex = outputCoordinates.findIndex(((c) => c[1] === xyRegion.bottom));

  const minOutputX = normalizedOutputCoordinates[leftIndex];
  const maxOutputX = normalizedOutputCoordinates[rightIndex];
  const minOutputY = normalizedOutputCoordinates[topIndex];
  const maxOutputY = normalizedOutputCoordinates[bottomIndex];
  const minTextureX = normalizedUV[leftIndex];
  const maxTextureX = normalizedUV[rightIndex];
  const minTextureY = normalizedUV[topIndex];
  const maxTextureY = normalizedUV[bottomIndex];

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
  const numberOfSlices = buffer.readUInt16LE();
  const totalNumberOfVertices = buffer.readUInt16LE();

  let tag;
  const slices = [];

  let textureId;

  while (tag !== 0) {
    tag = buffer.readUInt8();
    const tagLength = buffer.readUInt32LE();

    if (tag === 0) {
      break;
    }

    if (tag === 0x6) {
      console.warn('Deprecated tag in shape: 0x6');
      buffer.readBuffer(tagLength);
      // eslint-disable-next-line no-continue
      continue;
    }

    if (tag > 0x16) {
      console.warn('Unsupported tag in shape: ', tag);
      buffer.readBuffer(tagLength);
      // eslint-disable-next-line no-continue
      continue;
    }

    textureId = buffer.readUInt8();
    const numberOfCoordinates = tag === 0x4 ? 4 : buffer.readUInt8();
    const xy = [];

    // todo change to readTwip
    for (let j = 0; j < numberOfCoordinates; j += 1) {
      const x = buffer.readInt32LE();
      const y = buffer.readInt32LE();
      xy.push([x, y]);
    }

    const uv = [];
    for (let j = 0; j < numberOfCoordinates; j += 1) {
      const u = buffer.readUInt16LE();
      const v = buffer.readUInt16LE();

      if (tag === 0x16) {
        uv.push([
          Math.round(u / 0xffff * textures[textureId].width),
          Math.round(v / 0xffff * textures[textureId].height),
        ]);
      } else {
        uv.push([Math.round(u), Math.round(v)]);
      }
    }

    const xyRegion = getRegion(xy);
    const uvRegion = getRegion(uv);

    const isSlice = uvRegion.left !== uvRegion.right
      && uvRegion.top !== uvRegion.bottom;

    const size = 0.05;
    const rotationAngle = getRotationAngle(
      xy,
      uv,
      xyRegion,
      uvRegion,
    );

    const realXyRegion = {
      left: Math.round(xyRegion.left * size),
      right: Math.round(xyRegion.right * size),
      top: Math.round(xyRegion.top * size),
      bottom: Math.round(xyRegion.bottom * size),
    };

    slices.push({
      isSlice,
      textureId,
      uv,
      rotationAngle,
      outputCoordinates: xy.map((c) => [Math.round(c[0] * size), Math.round(c[1] * size)]),
      uvRegion,
      xyRegion: realXyRegion,
    });
  }

  const shape = {
    type: 'shape',
    exportId,
    slices,
  };
  return shape;
};

const extractColor = async (exportId, sliceIndex, slice, textures) => {
  // Check if uv[0] !== uv[1]
  const isHorizontalGradient = slice.uv[0][0] !== slice.uv[1][0]
    || slice.uv[0][1] !== slice.uv[1][1];

  const color1Position = slice.uv[0];
  const color2Position = isHorizontalGradient
    ? slice.uv[1]
    : slice.uv[2];

  const texture = textures[slice.textureId];

  const extractedShape = await imageUtils.createShapeWithColor(
    slice.outputCoordinates,
    slice.xyRegion,
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
    sliceIndex,
    pixels: extractedShape.pixels,
    width: extractedShape.width,
    height: extractedShape.height,
    channels: 4,
  };
};

const getShapeRegion = (slices) => {
  const left = Math.min(...slices.map((slice) => slice.xyRegion.left));
  const right = Math.max(...slices.map((slice) => slice.xyRegion.right));
  const top = Math.min(...slices.map((slice) => slice.xyRegion.top));
  const bottom = Math.max(...slices.map((slice) => slice.xyRegion.bottom));

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
  const extractSlicePromises = [];
  const shapeRegion = getShapeRegion(resource.slices);
  // const index = 7;
  // const slice = resource.slices[index];
  resource.slices.forEach((slice, index) => {
    if (slice.isSlice) {
      extractSlicePromises.push(imageUtils.extractSlice(
        resource.exportId,
        index,
        slice,
        texturesSharp[slice.textureId],
      ));
    } else {
      extractSlicePromises.push(extractColor(
        resource.exportId,
        index,
        slice,
        textures,
      ));
    }
  });

  const result = await Promise.all(extractSlicePromises);
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
    // todo check if the slices can intersect. if so, what kind of blend mode do we need?
    // otherwise, remove composite as it's slow af
    // maybe they can, check shape 13 in events.sc
    .composite(result.map((r) => ({
      input: r.pixels,
      raw: {
        channels: r.channels,
        width: r.width,
        height: r.height,
      },
      left: resource.slices[r.sliceIndex].xyRegion.left - shapeRegion.left,
      top: resource.slices[r.sliceIndex].xyRegion.top - shapeRegion.top,
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
