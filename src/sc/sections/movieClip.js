const sharp = require('sharp');
const imageUtils = require('../../imageUtils');
const shapeSection = require('./shape');
const logger = require('../../../logger');

const readMovieClip = (buffer) => {
  const exportId = buffer.readUInt16LE();
  // logger.debug(`MovieClip exportId: ${exportId}`);
  if (exportId === 5) {
    logger.debug('working');
  }

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
      // logger.debug(JSON.stringify(frameResources[i]));
    }
  }

  const numberOfResources = buffer.readUInt16LE();
  const resourcesMapping = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    resourcesMapping.push(buffer.readInt16LE());
  }
  for (let i = 0; i < numberOfResources; i += 1) {
    // this might be the delay between each frame? just an idea, no basis behind it
    const num = buffer.readUInt8();
    if (exportId === 282 || exportId === 280) {
      logger.debug(`number uint8: ${num}`);
    }
  }

  for (let i = 0; i < numberOfResources; i += 1) {
    // this is always empty on shapes.
    // usually contains something with text fields and movies, but not always
    // maybe default string?
    const string = buffer.scReadString();
    // logger.debug(`id: ${resourcesMapping[i]} x string: ${string}`);
  }

  let frameType;
  let currentFrameResourceIndex = 0;
  const frames = [];

  while (frameType !== 0) {
    frameType = buffer.readUInt8();
    const frameSize = buffer.readUInt32LE();

    if (frameSize === 0) {
      break;
    }
    switch (frameType) {
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

        frames.push({
          frameResources: currentFrameResources,
        });

        currentFrameResourceIndex += numberOfResourcesInCurrentFrame;
        break;
      }
      case 0x1f: {
        const v27 = buffer.readInt32LE() * 0.05;
        const v28 = buffer.readInt32LE() * 0.05;
        const v29 = buffer.readInt32LE() * 0.05 + v27;
        const v30 = buffer.readInt32LE() * 0.05 + v28;
        // logger.debug(`frame type 0x1f: ${[v27, v28, v29, v30]}`);
        break;
      }
      case 0x29: { // only happens in effects_brawler i think
        const something = buffer.readUInt8();
        // logger.debug(`frame type 0x29: ${something}`);
        break;
      }
      default:
    }
  }

  const movieClip = {
    exportId,
    type: 'movieClip',
    frames,
    frameRate,
    resourcesMapping,
    frameCount,
  };

  return movieClip;
};

const getTransformMatrix = (transformMatrices, index) => (
  index !== -1 ? transformMatrices[index] : null
);

const getColorTransformation = (colorMatrices, index) => (
  index !== -1 ? colorMatrices[index] : null
);

const applyTransforms = async (resource, transformation, colorTransformation) => {
  let colorTransformedPixels = resource.pixels;
  if (colorTransformation !== null) {
    colorTransformedPixels = imageUtils.applyColorTransformation(
      resource.pixels,
      colorTransformation,
    );
  }
  let transformed = sharp(colorTransformedPixels, {
    raw:
      {
        channels: 4,
        width: resource.width,
        height: resource.height,
      },
  });

  if (transformation) {
    const extended = await transformed.extend({
      top: transformation.ody > 0 ? Math.ceil(transformation.ody) : 0,
      bottom: transformation.ody < 0 ? Math.ceil(-transformation.ody) : 0,
      left: 0,
      right: 0,
      // left: transformation.odx < 0 ? Math.ceil(-transformation.odx) : 0,
      // right: transformation.odx > 0 ? Math.ceil(transformation.odx) : 0,
      background: '#00000000',
    }).raw().toBuffer({ resolveWithObject: true });
    transformed = sharp(extended.data,
      {
        raw: {
          channels: extended.info.channels,
          width: extended.info.width,
          height: extended.info.height,
        },
      }).affine(transformation.matrix, {
      background: '#00000000',
      odx: transformation.odx,
      ody: transformation.ody,
    });
  }

  return transformed.toBuffer({ resolveWithObject: true });
};

const applyOperations = async (resource, transformation, colorTransformation) => {
  if (resource.type === 'movieClip') {
    const newFrames = [];
    for (let i = 0; i < resource.finalFrames.length; i += 1) {
      newFrames.push(await applyTransforms(resource.finalFrames[i], transformation, colorTransformation));
    }
    return newFrames;
  }

  if (resource.type === 'shape') {
    return [await applyTransforms(resource, transformation, colorTransformation)];
  }

  return null;
};

const getResourceByExportId = (resources, shapes, exportId) => {
  if (exportId in shapes) {
    return shapes[exportId];
  }

  return resources[exportId];
};

const readFrameResource = (resources, shapes, transformMatrices, colorMatrices, movieClip, frameResource) => {
  const resource = getResourceByExportId(
    resources,
    shapes,
    movieClip.resourcesMapping[frameResource.resourceIndex],
  );
  const transformation = getTransformMatrix(
    transformMatrices,
    frameResource.transformMatrixIndex,
  );
  const colorTransformation = getColorTransformation(
    colorMatrices,
    frameResource.colorTransformIndex,
  );

  return applyOperations(
    resource,
    transformation,
    colorTransformation,
  );
};

const compositeFrame = async (frame, resources, shapes, transformMatrices, colorMatrices, movieClip) => {
  // const blendTypes = ['clear', 'source', 'over', 'in', 'out', 'atop', 'dest', 'dest-over', 'dest-in', 'dest-out', 'dest-atop', 'xor', 'add', 'saturate', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'colour-dodge', 'color-dodge', 'colour-burn', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'];
  // for (let j = 0; j < blendTypes.length; j += 1) {
  //   const currentFrameComposite = [];
  //   for (let i = 0; i < frame.frameResources.length; i += 1) {
  //     const frameResourceImage = await readFrameResource(resources, shapes, transformMatrices, colorMatrices, movieClip, frame.frameResources[i]);

  //     // todo eventually readFrameResource should always return.
  //     // right now it only supports sprites so it doesn't always return a frame resource
  //     if (frameResourceImage) {
  //       currentFrameComposite.push({
  //         input: frameResourceImage.data,
  //         raw: {
  //           width: frameResourceImage.info.width,
  //           height: frameResourceImage.info.height,
  //           channels: 4,
  //         },
  //         blend: blendTypes[j],
  //       });
  //     }
  //   }
  //   // todo again, remove this eventually. shouldn't happen
  //   // if (currentFrameComposite.length > 0) {
  //   //   return sharp(currentFrameComposite[0].input, {
  //   //     raw: currentFrameComposite[0].raw,
  //   //   }).composite(currentFrameComposite.slice(1));
  //   // }

  //   sharp({
  //     create: {
  //       channels: 4,
  //       width: currentFrameComposite[0].raw.width,
  //       height: currentFrameComposite[0].raw.height,
  //       background: '#00000000',
  //     },
  //   }).composite([currentFrameComposite[1], currentFrameComposite[0]]).toFile(`four/four-${blendTypes[j]}.png`);

  //   sharp({
  //     create: {
  //       channels: 4,
  //       width: currentFrameComposite[0].raw.width,
  //       height: currentFrameComposite[0].raw.height,
  //       background: '#00000000',
  //     },
  //   }).composite([currentFrameComposite[0], currentFrameComposite[1]]).toFile(`four/three-${blendTypes[j]}.png`);

  //   sharp(currentFrameComposite[1].input, {
  //     raw: currentFrameComposite[1].raw,
  //   }).composite([currentFrameComposite[0]]).toFile(`four/two-${blendTypes[j]}.png`);
  //   sharp(currentFrameComposite[0].input, {
  //     raw: currentFrameComposite[0].raw,
  //   }).composite([currentFrameComposite[1]]).toFile(`four/one-${blendTypes[j]}.png`);
  // }

  const currentFrameComposite = [];
  const blendType = 'over';
  for (let i = 0; i < frame.frameResources.length; i += 1) {
    const frameResourceImages = await readFrameResource(resources, shapes, transformMatrices, colorMatrices, movieClip, frame.frameResources[i]);

    // this won't be needed once i read text fields too
    if (!frameResourceImages) {
      break;
    }

    for (let j = 0; j < frameResourceImages.length; j++) {
      const frameResourceImage = frameResourceImages[j];
      currentFrameComposite.push({
        input: frameResourceImage.data,
        raw: {
          width: frameResourceImage.info.width,
          height: frameResourceImage.info.height,
          channels: 4,
        },
        blend: blendType,
      });
    }
  }

  // todo again, remove this eventually. shouldn't happen
  if (currentFrameComposite.length > 0) {
    const maxWidth = Math.max(...currentFrameComposite.map((f) => f.raw.width));
    const maxHeight = Math.max(...currentFrameComposite.map((f) => f.raw.height));

    const finalFrame = sharp({
      create: {
        channels: 4,
        width: maxWidth,
        height: maxHeight,
        background: '#00000000',
      },
    }).composite(currentFrameComposite.map((c) => ({
      ...c,
      left: Math.floor((maxWidth - c.raw.width) / 2),
      top: Math.floor((maxHeight - c.raw.height) / 2),
    })));

    return {
      pixels: await finalFrame.toBuffer(),
      width: maxWidth,
      height: maxHeight,
    };
  }
};

const createFramesStrip = (frames, maxWidth, pageHeight) => {
  const stripBuffer = new Array(frames.length * maxWidth * pageHeight * 4).fill(0);

  // todo consider using destBuf.write(srcBuf.read) and see if it's faster than random access
  frames.forEach((frame, frameIndex) => {
    const left = Math.floor((maxWidth - frame.width) / 2);
    const top = frameIndex * pageHeight + Math.floor((pageHeight - frame.height) / 2);
    for (let i = 0; i < frame.height; i += 1) {
      for (let j = 0; j < frame.width; j += 1) {
        const x = left + j;
        const y = top + i;
        stripBuffer[(y * maxWidth + x) * 4] = frame.pixels[(i * frame.width + j) * 4];
        stripBuffer[(y * maxWidth + x) * 4 + 1] = frame.pixels[(i * frame.width + j) * 4 + 1];
        stripBuffer[(y * maxWidth + x) * 4 + 2] = frame.pixels[(i * frame.width + j) * 4 + 2];
        stripBuffer[(y * maxWidth + x) * 4 + 3] = frame.pixels[(i * frame.width + j) * 4 + 3];
      }
    }
  });

  return Buffer.from(stripBuffer);
};

const createMovieClips = async (filename, transformMatrices, colorMatrices, resources, shapes) => {
  logger.info('Extracting movie clips');
  // eventually i'll split resources into text fields and movie clips as well
  const generateMovieClipsPromises = [];
  for (let r = 0; r < Object.keys(resources).length; r++) {
    // const exportId = 5;
    const exportId = Object.keys(resources)[r];
    const movieClip = getResourceByExportId(resources, shapes, exportId);

    if (movieClip.type === 'movieClip') {
      const currentMovieClipFinalFrames = [];
      for (let i = Math.max(0, movieClip.frames.length - 700); i < movieClip.frames.length; i += 1) {
        const compositedFrame = await compositeFrame(movieClip.frames[i], resources, shapes, transformMatrices, colorMatrices, movieClip);

        if (compositedFrame) {
          currentMovieClipFinalFrames.push(compositedFrame);
        }
      }
      movieClip.finalFrames = currentMovieClipFinalFrames;

      // todo remove. this should never happen once you finish
      // it currently only happens because i'm skipping text fields and movie clips in compositeFrame
      if (currentMovieClipFinalFrames.length > 0) {
        const maxWidth = Math.max(...currentMovieClipFinalFrames.map((f) => f.width));
        const pageHeight = Math.max(...currentMovieClipFinalFrames.map((f) => f.height));
        const framesStrip = createFramesStrip(currentMovieClipFinalFrames, maxWidth, pageHeight);
        sharp(framesStrip, {
          raw: {
            channels: 4,
            width: maxWidth,
            height: pageHeight * currentMovieClipFinalFrames.length,
          },
        }).webp({ pageHeight, loop: 0, lossless: true }).toFile(`out/${filename}-movieclip${exportId}-${movieClip.frameCount}.webp`);
      }
    }
  }

  await Promise.all(generateMovieClipsPromises);
  logger.info('Finished extracting movie clips');
};

module.exports = {
  readMovieClip,
  createMovieClips,
};
