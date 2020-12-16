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
  const scaleWidth = polygon.outputRegion.right - polygon.outputRegion.left;
  const scaleHeight = polygon.outputRegion.bottom - polygon.outputRegion.top;

  const extractedShape = await sharp(Buffer.from(texture.pixels), {
    raw:
    {
      channels: texture.channels,
      width: texture.width,
      height: texture.height,
    },
  })
    .extract(polygon.textureRegion)
    .composite([{
      input: Buffer.from(
        `<svg width="${polygon.textureRegion.width}" height="${polygon.textureRegion.height}">
        <polygon fill="white" points="${polygonString}"/>
        </svg>`,
      ),
      blend: 'dest-in',
    }])
    .toBuffer();

  const finalShape = await sharp(extractedShape, {
    raw: {
      channels: 4,
      width: polygon.textureRegion.width,
      height: polygon.textureRegion.height,
    },
  })
    .rotate(polygon.rotationAngle)
    .resize(scaleWidth, scaleHeight)
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

const createShapeWithColor = async (outputCoordinates, color1, color2, tx, ty) => {
  const coordinatesRegion = {
    left: Math.min(...outputCoordinates.map((p) => p[0])),
    top: Math.min(...outputCoordinates.map((p) => p[1])),
  };
  coordinatesRegion.width = Math.max(...outputCoordinates.map((p) => p[0])) - coordinatesRegion.left;
  coordinatesRegion.height = Math.max(...outputCoordinates.map((p) => p[1])) - coordinatesRegion.top;

  // Move coordinates to origin and generate svg polygon string
  const polygonString = outputCoordinates.reduce((acc, vertex) => `${acc} ${vertex[0] - tx},${vertex[1] - ty}`, '');

  const polygonShape = sharp(Buffer.from(`<svg width="${coordinatesRegion.width}" height="${coordinatesRegion.height}">
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"  stop-color="#${color1.toString(16).padStart(8, '0')}" />
          <stop offset="100%" stop-color="#${color2.toString(16).padStart(8, '0')}" />
        </linearGradient>
        <polygon fill="url(#grad1)" points="${polygonString}"/>
        </svg>`));
  return {
    pixels: await polygonShape.raw().toBuffer(),
    width: coordinatesRegion.width,
    height: coordinatesRegion.height,
  };
};

module.exports = {
  saveImage,
  extractPolygon,
  createShapeWithColor,
  applyColorTransformation,
};
