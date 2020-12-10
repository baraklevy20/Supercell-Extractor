const Jimp = require('jimp');
const sharp = require('sharp');

const saveImage = (path, width, height, pixels) => {
  let k = 0;
  const image = new Jimp(width, height);
  for (let i = 0; i < height; i += 1) {
    for (let j = 0; j < width; j += 1) {
      image.setPixelColor(pixels[k], j, i);
      k += 1;
    }
  }
  image.write(path, (err) => {
    if (err) throw err;
  });
};

const extractPolygon = async (exportId, polygonIndex, polygon, texture) => {
  const polygonString = polygon.textureCoordinates.reduce((acc, vertex) => `${acc} ${vertex[0]},${vertex[1]}`, '');
  const newPixels = [];
  for (let k = 0; k < texture.pixels.length; k += 1) {
    const c = texture.pixels[k];
    newPixels.push(...[(c >> 24) & 255, (c >> 16) & 255, (c >> 8) & 255, c & 255]);
  }

  const maskedImage = await sharp(Buffer.from(newPixels), {
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

const changePixelColor = (pixels, index, newColor) => {
  // eslint-disable-next-line no-param-reassign
  pixels[index] = newColor;
};

const applyColorTransformationMutable = (pixels, colorTransformation) => {
  for (let k = 0; k < pixels.length; k += 4) {
    changePixelColor(
      pixels,
      4 * k,
      Math.floor(pixels[4 * k] * colorTransformation.redMultiplier / 255),
    );
    changePixelColor(
      pixels,
      4 * k + 1,
      Math.floor(pixels[4 * k + 1] * colorTransformation.greenMultiplier / 255),
    );
    changePixelColor(
      pixels,
      4 * k + 2,
      Math.floor(pixels[4 * k + 2] * colorTransformation.blueMultiplier / 255),
    );
    changePixelColor(
      pixels,
      4 * k + 3,
      Math.floor(pixels[4 * k + 3] * colorTransformation.alphaMultiplier / 255),
    );
    changePixelColor(
      pixels,
      4 * k,
      Math.min(255, pixels[4 * k] + colorTransformation.redAddition),
    );
    changePixelColor(
      pixels,
      4 * k + 1,
      Math.min(255, pixels[4 * k + 1] + colorTransformation.greenAddition),
    );
    changePixelColor(
      pixels,
      4 * k + 2,
      Math.min(255, pixels[4 * k + 2] + colorTransformation.blueAddition),
    );
  }
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

const saveSharp = async (path, sharpImage) => {
  // sharpImage.webp({ pageHeight: 20, loop: 0 }).toFile(`${path}.webp`);
};

const saveMovieClip = async (path, sharpImage) => {
  sharpImage.webp({  loop: 0 }).toFile(`${path}.webp`);
};

module.exports = {
  saveImage,
  extractPolygon,
  createShapeWithColor,
  applyColorTransformationMutable,
  saveSharp,
  saveMovieClip,
};
