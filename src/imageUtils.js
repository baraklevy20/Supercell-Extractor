const Jimp = require('jimp');
const sharp = require('sharp');

// todo remove entire file, it's useless
const saveImage = (path, width, height, pixels) => {
  sharp(Buffer.from(pixels), {
    raw: {
      channels: 4,
      width,
      height,
    },
  }).toFile(path);
};

const extractPolygon = async (exportId, polygonIndex, polygon, texture) => {
  const polygonString = polygon.textureCoordinates.reduce((acc, vertex) => `${acc} ${vertex[0]},${vertex[1]}`, '');

  const maskedImage = await sharp(Buffer.from(texture.pixels), {
    raw:
        {
          channels: 4,
          width: texture.width,
          height: texture.height,
        },
  })
    .composite([{
      input: Buffer.from(
        `<svg width="${texture.width}" height="${texture.height}">
        <polygon fill="white" points="${polygonString}"/>
        </svg>`,
      ),
      blend: 'dest-in',
    }]).toBuffer();

  const region = {
    left: Math.min(...polygon.textureCoordinates.map((p) => p[0])),
    top: Math.min(...polygon.textureCoordinates.map((p) => p[1])),
  };
  region.width = Math.max(...polygon.textureCoordinates.map((p) => p[0])) - region.left;
  region.height = Math.max(...polygon.textureCoordinates.map((p) => p[1])) - region.top;

  const extractedShape = await sharp(maskedImage, {
    raw:
    {
      channels: 4,
      width: texture.width,
      height: texture.height,
    },
  })
    .extract(region)
    .toBuffer();

  const rotatedShape = await sharp(extractedShape, {
    raw:
    {
      channels: 4,
      width: region.width,
      height: region.height,
    },
  })
    .raw()
    .rotate(polygon.rotationAngle)
    .toBuffer();

  const scaleWidth = polygon.outputRegion.maxX - polygon.outputRegion.minX;
  const scaleHeight = polygon.outputRegion.maxY - polygon.outputRegion.minY;

  const resizedShape = await sharp(rotatedShape, {
    raw:
    {
      channels: 4,
      width: Math.abs(polygon.rotationAngle) === 90 ? region.height : region.width,
      height: Math.abs(polygon.rotationAngle) === 90 ? region.width : region.height,
    },
  })
    .resize(scaleWidth, scaleHeight)
    .toBuffer();

  return {
    exportId,
    polygonIndex,
    pixels: resizedShape,
    width: scaleWidth,
    height: scaleHeight,
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
