/* eslint-disable no-await-in-loop */
const sharp = require('sharp');
const stream = require('stream');
const logger = require('../../../logger');

const readMovieClip = (buffer, tag, tagLength) => {
  if (tag === 0x3) {
    console.warn('Deprecated tag in movie clip: 0x3');
    buffer.readBuffer(tagLength);
    return null;
  }

  if (tag === 0xe) {
    console.warn('Unsupported tag in movie clip: 0xE');
    buffer.readBuffer(tagLength);
    return null;
  }

  const exportId = buffer.readUInt16LE();
  // logger.debug(`MovieClip exportId: ${exportId}`);

  const frameRate = buffer.readUInt8();
  const frameCount = buffer.readUInt16LE();
  const frameResourcesCount = buffer.readUInt32LE();
  const frameResources = [];

  for (let i = 0; i < frameResourcesCount; i += 1) {
    // First number - index of resourcesMapping
    // Second number - index of transform matrix or default matrix if -1
    // Third number - index of color transform or default if -1
    frameResources.push({
      resourceIndex: buffer.readInt16LE(),
      transformMatrixIndex: buffer.readInt16LE(),
      colorTransformIndex: buffer.readInt16LE(),
    });
    if (exportId === 282 || exportId === 280) {
      // logger.debug(frameResources[i]);
    }
  }

  const numberOfResources = buffer.readUInt16LE();
  const resourcesMapping = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    resourcesMapping.push(buffer.readInt16LE());
  }

  const blendingFactors = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    const blending = tag === 0xc || tag === 0x23 ? buffer.readUInt8() : 0;

    // Blending equation is always s+d with the following factors
    // https://www.cairographics.org/operators/
    // https://en.wikipedia.org/wiki/Blend_modes
    const flag = (blending >> 6) & 1; // maybe inverted? (over -> dest_over). could also be invert colors
    switch (blending & 0x3f) {
      case 3:
        // A combination of mix and multiply. if alphaA = 0, take B. if alphaA=1, take AB.
        blendingFactors.push({ s: 'GL_DST_COLOR', d: 'GL_ONE_MINUS_SRC_ALPHA' });
        break;
      case 4:
        // CAIRO_OPERATOR_SCREEN. Screen
        blendingFactors.push({ s: 'GL_ONE', d: 'GL_ONE_MINUS_SRC_COLOR' });
        break;
      case 8:
        // CAIRO_OPERATOR_ADD. Linear dodge
        blendingFactors.push({ s: 'GL_ONE', d: 'GL_ONE' });
        break;
      // Not sure about 0xc and 0xf
      case 0xc:
      case 0xf: // only god knows. Not even used afaik
        blendingFactors.push({ s: 'GL_SRC_ALPHA', d: 'GL_ONE_MINUS_SRC_ALPHA' });
        break;
      default:
        // CAIRO_OPERATOR_OVER, A mix.
        // if alphaA = 0, take B.if alphaA = 1, take A.
        // Everything in between is a mix of A and B
        blendingFactors.push({ s: 'GL_ONE', d: 'GL_ONE_MINUS_SRC_ALPHA' });
    }
  }

  const resourcesStrings = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    // this is always empty on shapes.
    // usually contains something with text fields and movies, but not always
    // maybe default string?
    const string = buffer.scReadString();
    resourcesStrings.push(string);
    // logger.debug(`id: ${resourcesMapping[i]} x string: ${string}`);
  }

  let frameTag;
  let currentFrameResourceIndex = 0;

  const movieClip = {
    exportId,
    type: 'movieClip',
    frameRate,
    resourcesMapping,
    frameCount,
    blendingFactors,
    resourcesStrings,
  };

  movieClip.frames = [];

  while (frameTag !== 0) {
    frameTag = buffer.readUInt8();
    const frameTagLength = buffer.readUInt32LE();

    if (frameTagLength === 0) {
      break;
    }
    switch (frameTag) {
      case 0x05:
        console.warn('Deprecated tag in movie clip frame: 0x5');
        break;
      case 0x0b: {
        const numberOfResourcesInCurrentFrame = buffer.readUInt16LE();
        const frameName = buffer.scReadString();
        if (frameName !== null) {
          // logger.debug(`frameName: ${frameName}`);
        }

        const currentFrameResources = [];

        for (let i = 0; i < numberOfResourcesInCurrentFrame; i += 1) {
          currentFrameResources.push(frameResources[currentFrameResourceIndex + i]);
        }

        movieClip.frames.push({
          frameName,
          frameResources: currentFrameResources,
        });

        currentFrameResourceIndex += numberOfResourcesInCurrentFrame;
        break;
      }
      case 0x1f: {
        movieClip.nineSliceRegion = {
          left: buffer.scReadTwip(),
          top: buffer.scReadTwip(),
          right: buffer.scReadTwip(),
          bottom: buffer.scReadTwip(),
        };
        break;
      }
      case 0x29: { // only happens in effects_brawler i think
        movieClip.something = buffer.readUInt8();
        // console.log(`frame type 0x29: ${movieClip.something}`);
        break;
      }
      default:
    }
  }

  // console.log({ ...movieClip, frames: movieClip.frames.map((f) => f.frameName) });

  return movieClip;
};

const getTransformMatrix = (transformMatrices, index) => (
  index !== -1 ? transformMatrices[index] : null
);

const getColorTransformation = (colorTransforms, index) => (
  index !== -1 ? colorTransforms[index] : null
);

const applyTransforms = async (sharpObject, transformation, colorTransformation) => {
  const colorTransformedSharp = sharp(sharpObject.data, {
    raw: {
      channels: sharpObject.info.channels,
      width: sharpObject.info.width,
      height: sharpObject.info.height,
    },
  });
  // if (colorTransformation !== null) {
  //   const pixels = await resource.sharp.toBuffer({ resolveWithObject: true });
  //   const newPixels = imageUtils.applyColorTransformation(
  //     pixels.data,
  //     colorTransformation,
  //   );
  //   colorTransformedSharp = sharp(Buffer.from(newPixels), {
  //     raw: {
  //       channels: pixels.info.channels,
  //       width: pixels.info.width,
  //       height: pixels.info.height,
  //     },
  //   });
  // }
  let transformedSharp = colorTransformedSharp;

  if (transformation) {
    transformedSharp = transformedSharp
      .affine(transformation.matrix, {
        background: {
          r: 0, g: 0, b: 0, alpha: 0,
        },
      });
  }

  return transformedSharp.raw()
    .toBuffer({ resolveWithObject: true });
};

const pushIntoStripStream = (stripStream, frames, maxWidth, pageHeight) => {
  frames.forEach((frame) => {
    const stripBuffer = new Array(maxWidth * pageHeight * 4).fill(0);
    const left = Math.floor((maxWidth - frame.info.width) / 2);
    const top = Math.floor((pageHeight - frame.info.height) / 2);
    for (let i = 0; i < frame.info.height; i += 1) {
      for (let j = 0; j < frame.info.width; j += 1) {
        const x = left + j;
        const y = top + i;
        stripBuffer[(y * maxWidth + x) * 4] = frame.data[(i * frame.info.width + j) * 4];
        stripBuffer[(y * maxWidth + x) * 4 + 1] = frame.data[(i * frame.info.width + j) * 4 + 1];
        stripBuffer[(y * maxWidth + x) * 4 + 2] = frame.data[(i * frame.info.width + j) * 4 + 2];
        stripBuffer[(y * maxWidth + x) * 4 + 3] = frame.data[(i * frame.info.width + j) * 4 + 3];
      }
    }

    stripStream.push(Buffer.from(stripBuffer));
  });

  stripStream.push(null);
};

const compositeFrame = async (images) => {
  const left = Math.min(0, ...images.map(({ t }) => (t ? t.odx : 0)));
  const top = Math.min(0, ...images.map(({ t }) => (t ? t.ody : 0)));
  const right = Math.max(0, ...images.map(({ part, t }) => part.info.width + (t ? t.odx : 0)));
  const bottom = Math.max(0, ...images.map(({ part, t }) => part.info.height + (t ? t.ody : 0)));

  if (images.length === 1) {
    const { t } = images[0];
    return sharp(images[0].part.data, {
      raw: {
        channels: 4,
        width: images[0].part.info.width,
        height: images[0].part.info.height,
      },
    })
      .extend({
        top: t && t.ody > 0 ? Math.ceil(t.ody) : 0,
        bottom: t && t.ody < 0 ? Math.ceil(-t.ody) : 0,
        left: t && t.odx > 0 ? Math.ceil(t.odx) : 0,
        right: t && t.odx < 0 ? Math.ceil(-t.odx) : 0,
        background: {
          r: 0, g: 0, b: 0, alpha: 0,
        },
      })
      .toBuffer({ resolveWithObject: true });
  }

  // const width = Math.round(right - left);
  // const height = Math.round(bottom - top);
  // const pixels = new Uint8Array(width * height * 4);
  // images.forEach(({ part, t }) => {
  //   const partLeft = Math.round((t ? t.odx : 0) - left);
  //   const partTop = Math.round((t ? t.ody : 0) - top);

  //   for (let i = 0; i < part.data.length; i += 4) {
  //     const x = Math.floor(i / 4) % part.info.width;
  //     const y = Math.floor(Math.floor(i / 4) / part.info.width);
  //     const pixel = 4 * (width * (partTop + y) + (partLeft + x));

  //     const a = pixels;
  //     const b = part.data;
  //     const newAlpha = a[pixel + 3] / 255 + b[i + 3] / 255 * (1 - a[pixel + 3] / 255);
  //     pixels[pixel] = (a[pixel] / 255 + b[i] / 255 * (1 - a[pixel + 3] / 255)) / newAlpha * 255;
  //     pixels[pixel + 1] = (a[pixel + 1] / 255 + b[i + 1] / 255 * (1 - a[pixel + 3] / 255)) / newAlpha * 255;
  //     pixels[pixel + 2] = (a[pixel + 2] / 255 + b[i + 2] / 255 * (1 - a[pixel + 3] / 255)) / newAlpha * 255;
  //     pixels[pixel + 3] = newAlpha * 255;
  //     // if (
  //     //   pixels[currentPixelIndex] === 0 && pixels[currentPixelIndex + 1] === 0
  //     //   && pixels[currentPixelIndex + 2] === 0 && pixels[currentPixelIndex + 3] === 0) {
  //     //   for (let j = 0; j < 4; j += 1) {
  //     //     pixels[4 * (width * (partTop + y) + (partLeft + x)) + j] = a[i + j];
  //     //   }
  //     // }
  //   }
  // });

  // return {
  //   data: pixels,
  //   info: {
  //     channels: 4,
  //     width,
  //     height,
  //   },
  // };

  const finalFrame = sharp({
    create: {
      channels: 4,
      width: Math.round(right - left),
      height: Math.round(bottom - top),
      background: {
        r: 0, g: 0, b: 0, alpha: 0,
      },
    },
  }).composite(images.map(({ part, t }) => ({
    input: part.data,
    raw: {
      channels: 4,
      width: part.info.width,
      height: part.info.height,
    },
    blend: 'over',
    left: Math.round((t ? t.odx : 0) - left),
    top: Math.round((t ? t.ody : 0) - top),
  })));

  // const blends = ['overlay'];
  // const blends = ['clear', 'source', 'over', 'in',
  //   'out', 'atop', 'dest', 'dest-over', 'dest-in',
  //   'dest-out', 'dest-atop', 'xor', 'add', 'saturate',
  //   'multiply', 'screen', 'overlay', 'darken', 'lighten',
  //   'colour-dodge', 'color-dodge', 'colour-burn', 'color-burn',
  //   'hard-light', 'soft-light', 'difference', 'exclusion'];

  // for (let j = 0; j < blends.length; j += 1) {
  //   await sharp({
  //     create: {
  //       channels: 4,
  //       width: Math.round(right - left),
  //       height: Math.round(bottom - top),
  //       background: {
  //         r: 0, g: 0, b: 0, alpha: 0,
  //       },
  //     },
  //   }).composite(parts.map((c, i) => ({
  //     input: c.data,
  //     raw: {
  //       channels: 4,
  //       width: c.info.width,
  //       height: c.info.height,
  //     },
  //     left: Math.round(transformations[i].odx - left),
  //     top: Math.round(transformations[i].ody - top),
  //     blend: blends[j],
  //   }))).png().toFile(`out/sc/wtfffffff-${blends[j]}.png`);
  // }

  return finalFrame.toBuffer({ resolveWithObject: true });
};

const createMovieClip = async (
  exportId,
  resources,
  transformMatrices,
  colorTransforms,
) => {
  const cache = [];
  const movieClip = resources[exportId];
  movieClip.actualFrameCount = Math.min(200, Math.max(
    movieClip.frameCount,
    ...movieClip.resourcesMapping.map((rm) => resources[rm].actualFrameCount || 1),
  ));
  movieClip.finalFrames = [];
  for (let i = 0; i < movieClip.actualFrameCount; i += 1) {
    const currentFrame = movieClip.frames[i % movieClip.frames.length];
    const promises = [];
    const numberOfResources = Math.min(5, currentFrame.frameResources.length);
    for (let j = 0; j < numberOfResources; j += 1) {
      const frameResources = currentFrame.frameResources[j];
      const resourceExportId = movieClip.resourcesMapping[frameResources.resourceIndex];
      const resource = resources[resourceExportId];
      const transform = getTransformMatrix(transformMatrices, frameResources.transformMatrixIndex);
      const colorTransform = getColorTransformation(
        colorTransforms,
        frameResources.colorTransformIndex,
      );

      const cacheKey = resourceExportId.toString()
        + (resource.type === 'movieClip' ? i % resource.finalFrames.length : '')
        + transform?.matrix?.toString();
      let appliedTransform = cache[cacheKey];

      if (!appliedTransform) {
        if (resource.type === 'shape') {
          appliedTransform = applyTransforms(resource.sharp, transform, colorTransform);
        } else if (resource.type === 'textField') {
          // appliedTransform = applyTransforms(resource.sharp, transform, colorTransform);
        } else if (resource.type === 'movieClip') {
          // todo remove once text fields are used
          if (resource.finalFrames.length > 0) {
            appliedTransform = applyTransforms(
              resource.finalFrames[i % resource.finalFrames.length],
              transform,
              colorTransform,
            );
          }
        }
        cache[cacheKey] = appliedTransform;
      }

      promises.push(appliedTransform);
    }

    const currentFrameComposite = await Promise.all(promises);

    if (exportId === 61) {
      currentFrameComposite.forEach(async (frame, j) => {
        if (frame) {
          sharp(frame.data, {
            raw: {
              channels: 4,
              width: frame.info.width,
              height: frame.info.height,
            },
          }).png().toFile(`out/sc/part-${exportId}-${i}-${j}.png`);
        }
      });
    }

    // movieClip.finalFrames[i] = currentFrameComposite[0];
    const imagesToComposite = currentFrameComposite.map((e, j) => ({
      part: e,
      t: getTransformMatrix(
        transformMatrices,
        currentFrame.frameResources[j].transformMatrixIndex,
      ),
    })).filter((e) => e.part); // todo remove filter once text fields are implemented

    // todo remove filter once text fields are implemented
    if (imagesToComposite.length > 0) {
      movieClip.finalFrames.push(await compositeFrame(imagesToComposite));
    }
  }
};

const saveAsWebp = (movieClip, exportName, fileName) => {
  const maxWidth = Math.max(...movieClip.finalFrames.map((f) => f.info.width));
  const pageHeight = Math.max(...movieClip.finalFrames.map((f) => f.info.height));
  const stripStream = new stream.Readable();

  const sharpStream = sharp({
    raw: {
      channels: 4,
      width: maxWidth,
      height: pageHeight * movieClip.actualFrameCount,
    },
    limitInputPixels: false,
  })
    .webp({ pageHeight, loop: 1, lossless: true })
    .on('data', (c) => {
      console.log('got image page');
    });

  stripStream.pipe(sharpStream);
  pushIntoStripStream(stripStream, movieClip.finalFrames, maxWidth, pageHeight);
  const exportNameString = exportName ? `${exportName.join('&')}-` : 'noexport-';

  return sharpStream
    .clone()
    .toFile(`out/${fileName}-movieclip-${exportNameString}${movieClip.exportId}-${movieClip.actualFrameCount}.webp`);
};

const createMovieClips = async (filename, transformMatrices, colorTransforms, resources, exports) => {
  logger.info('Extracting movie clips');
  const t = Date.now();
  // const resource = resources[4];
  // resources = {
  //   0: resources[0],
  //   1: resources[1],
  //   2: resources[2],
  //   4: resources[4],
  //   5: resources[5],
  //   6: resources[6],
  //   8: resources[8],
  // };
  // resources = {
  //   0: resources[0],
  //   2: resources[2],
  //   4: resources[4],
  //   9: resources[9],
  //   10: resources[10],
  //   12: resources[12],
  // };
  // resources = {
  //   2: resources[2],
  //   9: resources[9],
  //   10: resources[10],
  // };
  // resources = {
  //   0: resources[0],
  //   4: resources[4],
  // };

  const promises = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const resource of Object.values(resources)) {
    if (resource.type === 'movieClip') {
      await createMovieClip(
        resource.exportId,
        resources,
        transformMatrices,
        colorTransforms,
      );
      // todo remove once text fields are used
      if (resource.finalFrames.length > 0) {
        promises.push(saveAsWebp(resource, exports[resource.exportId], filename));
      }
    }
  }

  console.log(`Movie clip frames generation time: ${Date.now() - t}ms`);
  const t2 = Date.now();
  await Promise.allSettled(promises);
  console.log(`Movie clip to webp time: ${Date.now() - t2}ms`);

  logger.info('Finished extracting movie clips');
};

module.exports = {
  readMovieClip,
  createMovieClips,
};
