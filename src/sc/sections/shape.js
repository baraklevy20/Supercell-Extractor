const sharp = require('sharp');
const pLimit = require('p-limit');
const imageUtils = require('../../imageUtils');
const logger = require('../../../logger');

const isClockwise = (coords) => {
  let sum = 0;
  for (let i = 0; i < coords.length; i += 1) {
    const current = coords[i];
    const next = coords[(i + 1) % coords.length];
    sum += (next[0] - current[0]) * (next[1] + current[1]);
  }

  return sum < 0;
};

const getTextureMapping = (xy, uv) => {
  const rad2Deg = (rad) => rad * (180 / Math.PI);

  // cw = clockwise. ccw = counterclockwise
  const isXYClockwise = isClockwise(xy);
  const isUVClockwise = isClockwise(uv);

  // If xy is cw and uv is ccw (or vice versa), the image is mirrored
  const isMirrored = isXYClockwise !== isUVClockwise;

  // If the texture is mirrored, we'll flip xy or uv (the ccw one) so that both will be cw
  const mirroredXY = isMirrored && !isXYClockwise ? xy.map((e) => [-e[0], e[1]]) : xy;
  const mirroredUV = isMirrored && !isUVClockwise ? uv.map((e) => [-e[0], e[1]]) : uv;

  // Get the angle from xy0 to xy1 and uv0 to uv1
  const dx = mirroredXY[1][0] - mirroredXY[0][0];
  const dy = mirroredXY[1][1] - mirroredXY[0][1];
  const du = mirroredUV[1][0] - mirroredUV[0][0];
  const dv = mirroredUV[1][1] - mirroredUV[0][1];
  // A trick to always have a positive angle (-90 + 360 => 270) and less than 360
  const xyAngle = (rad2Deg(Math.atan2(dy, dx)) + 360) % 360;
  const uvAngle = (rad2Deg(Math.atan2(dv, du)) + 360) % 360;

  // The rotation angle is the difference
  const angle = (xyAngle - uvAngle + 360) % 360;

  // Round the angle to the nearest 90 degrees angle
  let nearest90Multiple = Math.round(angle / 90) * 90;

  // We now flip it back again
  if (isMirrored && !isUVClockwise && (angle === 90 || angle === 270)) {
    nearest90Multiple += 180;
  }

  return [
    nearest90Multiple,
    isMirrored,
  ];
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

    for (let j = 0; j < numberOfCoordinates; j += 1) {
      const x = buffer.scReadTwip();
      const y = buffer.scReadTwip();

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

    const [rotationAngle, isMirrored] = getTextureMapping(xy, uv);

    slices.push({
      isSlice,
      textureId,
      xy,
      xyRegion,
      uv,
      uvRegion,
      rotationAngle,
      isMirrored,
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
    slice.xy,
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
    sharp: await shape.raw().toBuffer({ resolveWithObject: true }),
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
