const sharp = require('sharp');

// todo remove entire file, it's useless
const saveImage = (path, width, height, channels, pixels) => {
  const image = sharp(Buffer.from(pixels), {
    raw: {
      channels,
      width,
      height,
    },
  });
  image.toFile(path);
};

const extractPolygon = async (exportId, polygonIndex, polygon, texture) => {
  const polygonString = polygon.textureCoordinates.reduce((acc, vertex) => (
    `${acc} ${vertex[0] - polygon.textureRegion.left},${vertex[1] - polygon.textureRegion.top}`
  ), '');
  const scaleWidth = polygon.outputRegion.right - polygon.outputRegion.left + 1;
  const scaleHeight = polygon.outputRegion.bottom - polygon.outputRegion.top + 1;

  const extractedShape = await texture
    .extract(polygon.textureRegion)
    .boolean(Buffer.from(
      `<svg width="${polygon.textureRegion.width}" height="${polygon.textureRegion.height}">
        <polygon fill="white" points="${polygonString}"/>
        </svg>`,
    ), 'and')
    .toBuffer();

  const finalShape = await sharp(extractedShape, {
    raw: {
      channels: 4,
      width: polygon.textureRegion.width,
      height: polygon.textureRegion.height,
    },
  })
    .rotate(polygon.rotationAngle)
    .resize(scaleWidth, scaleHeight, { fit: 'fill' })
    .toBuffer();

  return {
    exportId,
    polygonIndex,
    pixels: finalShape,
    width: scaleWidth,
    height: scaleHeight,
    channels: 4,
  };
};

const applyColorTransformation = (pixels, colorTransformation) => {
  const newPixels = new Array(pixels.length);
  for (let k = 0; k < pixels.length / 4; k += 1) {
    newPixels[4 * k] = Math.floor(pixels[4 * k] * colorTransformation.redMultiplier / 255);
    newPixels[4 * k + 1] = Math.floor(pixels[4 * k + 1] * colorTransformation.greenMultiplier / 255);
    newPixels[4 * k + 2] = Math.floor(pixels[4 * k + 2] * colorTransformation.blueMultiplier / 255);
    newPixels[4 * k + 3] = Math.floor(pixels[4 * k + 3] * colorTransformation.alphaMultiplier / 255);
    newPixels[4 * k] = Math.min(255, pixels[4 * k] + colorTransformation.redAddition);
    newPixels[4 * k + 1] = Math.min(255, pixels[4 * k + 1] + colorTransformation.greenAddition);
    newPixels[4 * k + 2] = Math.min(255, pixels[4 * k + 2] + colorTransformation.blueAddition);
  }

  return Buffer.from(newPixels);
};

const createShapeWithColor = async (
  outputCoordinates,
  outputRegion,
  color1,
  color2,
  isHorizontalGradient,
) => {
  // Move coordinates to origin and generate svg polygon string
  const width = outputRegion.right - outputRegion.left + 1;
  const height = outputRegion.bottom - outputRegion.top + 1;

  const polygonString = outputCoordinates.reduce((acc, vertex) => `${acc} ${vertex[0] - outputRegion.left},${vertex[1] - outputRegion.top}`, '');

  const polygonShape = sharp(Buffer.from(`<svg width="${width}" height="${height}">
        <linearGradient
          id="grad1"
          x1="0%"
          y1="0%"
          x2="${isHorizontalGradient ? 100 : 0}%"
          y2="${isHorizontalGradient ? 0 : 100}%">
          <stop offset="0%"  stop-color="rgba(${color1[0]},${color1[1]},${color1[2]},${color1[3]})" />
          <stop offset="100%" stop-color="rgba(${color2[0]},${color2[1]},${color2[2]},${color2[3]})" />
        </linearGradient>
        <polygon fill="url(#grad1)" points="${polygonString}"/>
        </svg>`));
  return {
    pixels: await polygonShape.raw().toBuffer(),
    width,
    height,
  };
};

module.exports = {
  saveImage,
  extractPolygon,
  createShapeWithColor,
  applyColorTransformation,
};
