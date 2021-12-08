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

const extractSlice = async (exportId, sliceIndex, slice, texture) => {
  const sliceString = slice.uv.reduce((acc, vertex) => (
    `${acc} ${vertex[0] - slice.uvRegion.left},${vertex[1] - slice.uvRegion.top}`
  ), '');
  const scaleWidth = slice.xyRegion.right - slice.xyRegion.left + 1;
  const scaleHeight = slice.xyRegion.bottom - slice.xyRegion.top + 1;

  const extractedShape = await texture
    .extract(slice.uvRegion)
    .boolean(Buffer.from(
      `<svg width="${slice.uvRegion.width}" height="${slice.uvRegion.height}">
        <polygon fill="white" points="${sliceString}"/>
        </svg>`,
    ), 'and')
    .toBuffer();

  const finalShape = await sharp(extractedShape, {
    raw: {
      channels: 4,
      width: slice.uvRegion.width,
      height: slice.uvRegion.height,
    },
  })
    .resize(scaleWidth, scaleHeight, { fit: 'fill' })
    .rotate(slice.rotationAngle)
    .flop(slice.isMirrored)
    .toBuffer();

  return {
    exportId,
    sliceIndex,
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
  xy,
  xyRegion,
  color1,
  color2,
  isHorizontalGradient,
) => {
  // Move coordinates to origin and generate svg slice string
  const width = xyRegion.right - xyRegion.left + 1;
  const height = xyRegion.bottom - xyRegion.top + 1;

  const sliceString = xy.reduce((acc, vertex) => `${acc} ${vertex[0] - xyRegion.left},${vertex[1] - xyRegion.top}`, '');

  const sliceShape = sharp(Buffer.from(`<svg width="${width}" height="${height}">
        <linearGradient
          id="grad1"
          x1="0%"
          y1="0%"
          x2="${isHorizontalGradient ? 100 : 0}%"
          y2="${isHorizontalGradient ? 0 : 100}%">
          <stop offset="0%"  stop-color="rgba(${color1[0]},${color1[1]},${color1[2]},${color1[3]})" />
          <stop offset="100%" stop-color="rgba(${color2[0]},${color2[1]},${color2[2]},${color2[3]})" />
        </linearGradient>
        <polygon fill="url(#grad1)" points="${sliceString}"/>
        </svg>`));
  return {
    pixels: await sliceShape.raw().toBuffer(),
    width,
    height,
  };
};

module.exports = {
  saveImage,
  extractSlice,
  createShapeWithColor,
  applyColorTransformation,
};
