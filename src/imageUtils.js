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

const saveImageWithPolygon = (path, width, height, pixels, polygon) => {
  const newPixels = pixels;
  const radius = 32;
  for (let j = 0; j < polygon.length; j += 1) {
    for (let k = 0; k < radius; k += 1) {
      const x = polygon[j][0];
      const y = polygon[j][1];
      newPixels[y * width + x + k] = 0xff0000ff;
      newPixels[y * width + x - k] = 0xff0000ff;
      newPixels[(y + k) * width + x] = 0xff0000ff;
      newPixels[(y - k) * width + x] = 0xff0000ff;
    }
  }
  saveImage(path, width, height, newPixels);
};

const extractShapeAndResize = async (exportId, polygonIndex, shape, texture) => {
  const polygonString = shape.polygon.reduce((acc, vertex) => `${acc} ${vertex[0]},${vertex[1]}`, '');
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
    left: Math.min(...shape.polygon.map((p) => p[0])),
    top: Math.min(...shape.polygon.map((p) => p[1])),
  };
  region.width = Math.max(...shape.polygon.map((p) => p[0])) - region.left;
  region.height = Math.max(...shape.polygon.map((p) => p[1])) - region.top;

  // todo check if this is needed...
  if (region.width === 0 || region.height === 0) {
    return null;
  }

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
    .rotate(shape.rotationAngle)
    .toBuffer();

  const resizedShape = await sharp(rotatedShape, {
    raw:
    {
      channels: 4,
      width: Math.abs(shape.rotationAngle) === 90 ? region.height : region.width,
      height: Math.abs(shape.rotationAngle) === 90 ? region.width : region.height,
    },
  })
    .resize(shape.scaleWidth, shape.scaleHeight)
    .toBuffer();

  await sharp(resizedShape, {
    raw:
    {
      channels: 4,
      width: shape.scaleWidth,
      height: shape.scaleHeight,
    },
  })
    .toFile(`out/exportID ${exportId} polygon number ${polygonIndex}.png`);

  return {
    exportId,
    polygonIndex,
    pixels: resizedShape,
    width: shape.scaleWidth,
    height: shape.scaleHeight,
  };
};

const createShapeWithColor = async (coordinates, color1, color2, tx, ty) => {
  const coordinatesRegion = {
    left: Math.min(...coordinates.map((p) => p[0])),
    top: Math.min(...coordinates.map((p) => p[1])),
  };
  coordinatesRegion.width = Math.round(Math.max(...coordinates.map((p) => p[0])) - coordinatesRegion.left);
  coordinatesRegion.height = Math.round(Math.max(...coordinates.map((p) => p[1])) - coordinatesRegion.top);

  // Move coordinates to origin and generate svg polygon string
  const polygonString = coordinates.reduce((acc, vertex) => `${acc} ${vertex[0] - tx},${vertex[1] - ty}`, '');

  const shape = sharp(Buffer.from(`<svg width="${coordinatesRegion.width}" height="${coordinatesRegion.height}">
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"  stop-color="#${color1.toString(16).padStart(8, '0')}" />
          <stop offset="100%" stop-color="#${color2.toString(16).padStart(8, '0')}" />
        </linearGradient>
        <polygon fill="url(#grad1)" points="${polygonString}"/>
        </svg>`));
  return {
    pixels: await shape.raw().toBuffer(),
    width: coordinatesRegion.width,
    height: coordinatesRegion.height,
  };
};

const saveSharp = async (path, sharpImage) => {
  sharpImage.toFile(`${path}.png`);
};

module.exports = {
  saveImage,
  saveImageWithPolygon,
  extractShapeAndResize,
  createShapeWithColor,
  saveSharp,
};
