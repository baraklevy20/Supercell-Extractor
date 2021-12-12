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

  const blendingTypes = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    const blending = tag === 0xc || tag == 0x23 ? buffer.readUInt8() : 0;
    blendingTypes.push(blending);
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
    blendingTypes,
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
    transformedSharp = await transformedSharp
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
    const left = 0;
    const top = 0;
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

const compositeFrame = async (parts, transformations) => {
  const left = Math.min(0, ...transformations.map((t) => (t ? t.odx : 0)));
  const top = Math.min(0, ...transformations.map((t) => (t ? t.ody : 0)));
  const right = Math.max(0, ...transformations.map((t, i) => parts[i].info.width + (t ? t.odx : 0)));
  const bottom = Math.max(0, ...transformations.map((t, i) => parts[i].info.height + (t ? t.ody : 0)));

  const finalFrame = sharp({
    create: {
      channels: 4,
      width: Math.round(right - left),
      height: Math.round(bottom - top),
      background: {
        r: 0, g: 0, b: 0, alpha: 0,
      },
    },
  }).composite(parts.map((c, i) => ({
    input: c.data,
    raw: {
      channels: 4,
      width: c.info.width,
      height: c.info.height,
    },
    blend: 'over',
    left: Math.round((transformations[i] ? transformations[i].odx : 0) - left),
    top: Math.round((transformations[i] ? transformations[i].ody : 0) - top),
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
  exportName,
  fileName,
  exportId,
  resources,
  transformMatrices,
  colorTransforms,
) => {
  const movieClip = resources[exportId];
  movieClip.actualFrameCount = Math.min(100, Math.max(
    movieClip.frameCount,
    ...movieClip.resourcesMapping.map((rm) => resources[rm].actualFrameCount || 1),
  ));
  movieClip.finalFrames = [];
  for (let i = 0; i < movieClip.actualFrameCount; i += 1) {
    const currentFrame = movieClip.frames[i % movieClip.frames.length];
    const promises = [];
    const numberOfResources = Math.min(30, currentFrame.frameResources.length);
    for (let j = 0; j < numberOfResources; j += 1) {
      const frameResources = currentFrame.frameResources[j];
      const resourceExportId = movieClip.resourcesMapping[frameResources.resourceIndex];
      const resource = resources[resourceExportId];
      const transform = getTransformMatrix(transformMatrices, frameResources.transformMatrixIndex);
      const colorTransform = getColorTransformation(
        colorTransforms,
        frameResources.colorTransformIndex,
      );

      if (resource.type === 'shape') {
        promises.push(applyTransforms(resource.sharp, transform, colorTransform));
      } else if (resource.type === 'movieClip') {
        promises.push(applyTransforms(
          resource.finalFrames[i % resource.finalFrames.length],
          transform,
          colorTransform,
        ));
      }
    }

    const currentFrameComposite = await Promise.all(promises);

    movieClip.finalFrames[i] = await compositeFrame(
      currentFrameComposite,
      currentFrameComposite.map(
        (_, j) => getTransformMatrix(
          transformMatrices,
          currentFrame.frameResources[j].transformMatrixIndex,
        ),
      ),
    );
  }

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
    .toFile(`out/${fileName}-movieclip-${exportNameString}${exportId}-${movieClip.actualFrameCount}.webp`);
};

const createMovieClips = async (filename, transformMatrices, colorTransforms, resources, exports) => {
  logger.info('Extracting movie clips');
  // const resource = resources[4];
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
  // eslint-disable-next-line no-restricted-syntax
  for (const resource of Object.values(resources)) {
    if (resource.type === 'movieClip') {
      await createMovieClip(
        exports[resource.exportId],
        filename,
        resource.exportId,
        resources,
        transformMatrices,
        colorTransforms,
      );
    }
  }
  logger.info('Finished extracting movie clips');
};

module.exports = {
  readMovieClip,
  createMovieClips,
};
