const Jimp = require('jimp');
const sharp = require('sharp');

const saveImage = (path, width, height, pixels) => {
  let k = 0;
  const image = new Jimp(width, height);
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      image.setPixelColor(pixels[k++], j, i);
    }
  }
  image.write(path, (err) => {
    if (err) throw err;
  });
};

const saveImageWithPolygon = (path, width, height, pixels, polygon) => {
  const newPixels = pixels;
  const radius = 32;
  for (let j = 0; j < polygon.length; j++) {
    for (let k = 0; k < radius; k++) {
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

const extractShape = async (exportId, polygonIndex, polygon, rotationAngle, texture) => {
  const polygonString = polygon.reduce((acc, vertex) => `${acc} ${vertex[0]},${vertex[1]}`, '');
  const newPixels = [];
  for (let k = 0; k < texture.pixels.length; k++) {
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
    left: Math.min(...polygon.map((p) => p[0])),
    top: Math.min(...polygon.map((p) => p[1])),
  };
  region.width = Math.max(...polygon.map((p) => p[0])) - region.left;
  region.height = Math.max(...polygon.map((p) => p[1])) - region.top;

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
    .rotate(rotationAngle)
    .toBuffer();

  await sharp(extractedShape, {
    raw:
    {
      channels: 4,
      width: region.width,
      height: region.height,
    },
  })
    .toFile(`out/exportID ${exportId} polygon number ${polygonIndex}.png`);

  return {
    exportId,
    polygonIndex,
    pixels: rotatedShape,
    width: Math.abs(rotationAngle) === 90 ? region.height : region.width,
    height: Math.abs(rotationAngle) === 90 ? region.width : region.height,
  };
};

const createShapeWithColor = async (coordinates, color, tx, ty) => {
  const x = 1;
  coordinates = coordinates.map((c) => [c[0] * x, c[1] * x]);
  const coordinatesRegion = {
    left: Math.min(...coordinates.map((p) => p[0])),
    top: Math.min(...coordinates.map((p) => p[1])),
  };
  coordinatesRegion.width = Math.round(Math.max(...coordinates.map((p) => p[0])) - coordinatesRegion.left);
  coordinatesRegion.height = Math.round(Math.max(...coordinates.map((p) => p[1])) - coordinatesRegion.top);

  // Move coordinates to origin and generate svg polygon string
  const polygonString = coordinates.reduce((acc, vertex) => `${acc} ${vertex[0] - tx},${vertex[1] - ty}`, '');

  const shape = sharp(Buffer.from(`<svg width="${coordinatesRegion.width}" height="${coordinatesRegion.height}">
        <polygon fill="#${color.toString(16).padStart(8, '0')}" points="${polygonString}"/>
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
  extractShape,
  createShapeWithColor,
  saveSharp,
};
