/* eslint-disable no-await-in-loop */
const sharp = require('sharp');
const stream = require('stream');
const logger = require('../../../logger');

const readMovieClip = (buffer) => {
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
  // still no idea what this is, but it uses this mapping
  // i'm pretty sure it might be a bit field (values are 000, 001, 010, 011, 100)
  // i took 3 values because the game stores it in 3 bits
  const uint8Mapping = [0, 0, 0, 0x80, 0xC0, 0, 0, 0, 0x40, 0, 0, 0, 0x100];
  const uint8s = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    const num = buffer.readUInt8();
    uint8s.push(num);
    if (num !== 0) {
      // logger.debug(`${resourcesMapping[frameResources[i].resourceIndex]} number uint8: ${uint8Mapping[num]}`);
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

  let frameType;
  let currentFrameResourceIndex = 0;
  const frames = [];

  let v27;
  let v28;
  let v29;
  let v30;
  let something;

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
          frameName,
          frameResources: currentFrameResources,
        });

        currentFrameResourceIndex += numberOfResourcesInCurrentFrame;
        break;
      }
      case 0x1f: {
        v27 = buffer.readInt32LE() * 0.05;
        v28 = buffer.readInt32LE() * 0.05;
        v29 = buffer.readInt32LE() * 0.05 + v27;
        v30 = buffer.readInt32LE() * 0.05 + v28;
        // logger.debug(`frame type 0x1f: ${[v27, v28, v29, v30]}`);
        break;
      }
      case 0x29: { // only happens in effects_brawler i think
        something = buffer.readUInt8();
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
    uint8s,
    resourcesStrings,
    v27,
    v28,
    v29,
    v30,
    something,
  };

  // console.log({ ...movieClip, frames: movieClip.frames.map((f) => f.frameName) });

  return movieClip;
};

const getTransformMatrix = (transformMatrices, index) => (
  index !== -1 ? transformMatrices[index] : null
);

const getColorTransformation = (colorTransforms, index) => (
  index !== -1 ? colorTransforms[index] : null
);

const applyTransforms = async (resource, transformation, colorTransformation) => {
  const colorTransformedSharp = resource.sharp;
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
    const extended = await transformedSharp.extend({
      top: 0,
      bottom: 0,
      // top: transformation.ody > 0 ? Math.ceil(transformation.ody) : 0,
      // bottom: transformation.ody < 0 ? Math.ceil(-transformation.ody) : 0,
      left: 0,
      right: 0,
      // left: transformation.odx < 0 ? Math.ceil(-transformation.odx) : 0,
      // right: transformation.odx > 0 ? Math.ceil(transformation.odx) : 0,
      background: {
        r: 0, g: 0, b: 0, alpha: 0,
      },
    }).raw().toBuffer({ resolveWithObject: true });
    transformedSharp = sharp(extended.data,
      {
        raw: {
          channels: extended.info.channels,
          width: extended.info.width,
          height: extended.info.height,
        },
      }).affine(transformation.matrix, {
      background: {
        r: 0, g: 0, b: 0, alpha: 0,
      },
    });
  }

  return transformedSharp.toBuffer({ resolveWithObject: true });
};

const multiplyMatrices = (a, b) => {
  if (a === null) {
    return b;
  }
  if (b === null) {
    return a;
  }
  return {
    matrix: [
      a.matrix[0] * b.matrix[0] + a.matrix[1] * b.matrix[2],
      a.matrix[0] * b.matrix[1] + a.matrix[1] * b.matrix[3],
      a.matrix[2] * b.matrix[0] + a.matrix[3] * b.matrix[2],
      a.matrix[2] * b.matrix[1] + a.matrix[3] * b.matrix[3],
    ],
    odx: a.odx * b.matrix[0] + a.ody * b.matrix[2] + b.odx,
    ody: a.ody * b.matrix[3] + a.odx * b.matrix[1] + b.ody,
  };
};

const pushIntoStripStream = (stripStream, frames, maxWidth, pageHeight) => {
  frames.forEach((frame) => {
    const stripBuffer = new Array(maxWidth * pageHeight * 4).fill(0);
    const left = Math.floor((maxWidth - frame.result.info.width) / 2);
    const top = Math.floor((pageHeight - frame.result.info.height) / 2);
    for (let i = 0; i < frame.result.info.height; i += 1) {
      for (let j = 0; j < frame.result.info.width; j += 1) {
        const x = left + j;
        const y = top + i;
        stripBuffer[(y * maxWidth + x) * 4] = frame.result.data[(i * frame.result.info.width + j) * 4];
        stripBuffer[(y * maxWidth + x) * 4 + 1] = frame.result.data[(i * frame.result.info.width + j) * 4 + 1];
        stripBuffer[(y * maxWidth + x) * 4 + 2] = frame.result.data[(i * frame.result.info.width + j) * 4 + 2];
        stripBuffer[(y * maxWidth + x) * 4 + 3] = frame.result.data[(i * frame.result.info.width + j) * 4 + 3];
      }
    }

    stripStream.push(Buffer.from(stripBuffer));
  });

  stripStream.push(null);
};

const compositeFrame = async (currentFrameComposite) => {
  const minX = Math.min(0, ...currentFrameComposite.map((f) => f.odx));
  const minY = Math.min(0, ...currentFrameComposite.map((f) => f.ody));
  const maxX = Math.max(0, ...currentFrameComposite.map((f) => f.result.info.width + f.odx));
  const maxY = Math.max(0, ...currentFrameComposite.map((f) => f.result.info.height + f.ody));

  const finalFrame = sharp({
    create: {
      channels: 4,
      width: Math.round(maxX - minX),
      height: Math.round(maxY - minY),
      background: {
        r: 0, g: 0, b: 0, alpha: 0,
      },
    },
  }).composite(currentFrameComposite.map((c, i) => ({
    input: c.result.data,
    raw: {
      channels: 4,
      width: c.result.info.width,
      height: c.result.info.height,
    },
    left: Math.round(c.odx - minX), // + Math.floor((maxWidth - c.result.info.width) / 2)),
    top: Math.round(c.ody - minY), // + Math.floor((maxHeight - c.result.info.height) / 2)),
  })));

  return {
    result: await finalFrame.toBuffer({ resolveWithObject: true }),
    odx: 0,
    ody: 0,
  };
};
const applyRecursively = async (
  frameIndex,
  resources,
  transformMatrices,
  colorTransforms,
  resource,
  transformation,
  colorTransform,
) => {
  // and text fields
  if (resource.type === 'shape') {
    return {
      result: await applyTransforms(resource, transformation, colorTransform),
      odx: transformation ? transformation.odx : 0,
      ody: transformation ? transformation.ody : 0,
    };
  }
  if (resource.type === 'textField') {
    return null;
  }
  if (resource.type === 'movieClip') {
    const currentFrameComposite = [];
    const { frameResources } = resource.frames[frameIndex % resource.frameCount];
    const newTransformations = [];
    for (let j = 0; j < Math.min(10, frameResources.length); j += 1) {
      const currentFrameResource = frameResources[j];
      const currentTransformation = getTransformMatrix(transformMatrices, currentFrameResource.transformMatrixIndex);
      const newTransformation = multiplyMatrices(
        currentTransformation,
        transformation,
      );
      newTransformations.push(newTransformation || { odx: 0, ody: 0 });
      // todo multiply colors
      const result = await applyRecursively(
        frameIndex,
        resources,
        transformMatrices,
        colorTransforms,
        resources[resource.resourcesMapping[currentFrameResource.resourceIndex]],
        newTransformation,
        colorTransform,
      );

      // todo once textfields are implemented, remove this if
      if (result !== null) {
        currentFrameComposite.push(result);
      }
    }

    if (currentFrameComposite.length === 0) {
      return null;
    }

    return compositeFrame(currentFrameComposite, newTransformations);
  }
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
  const maxNumberOfFrames = Math.max(
    movieClip.frameCount,
    ...movieClip.resourcesMapping.map((rm) => resources[rm].frameCount || 1),
  );
  const numberOfFrames = Math.min(1, maxNumberOfFrames);
  const frames = [];
  for (let i = 0; i < numberOfFrames; i += 1) {
    const result = await applyRecursively(
      i,
      resources,
      transformMatrices,
      colorTransforms,
      movieClip,
      null,
      null,
    );

    // todo once textfields are implemented, remove this if
    if (result) {
      frames.push(result);
    }
  }
  // todo remove if. this should never happen once you finish
  // it currently only happens because i'm skipping text fields and movie clips in compositeFrame
  if (frames.length > 0) {
    const maxWidth = Math.max(...frames.map((f) => f.result.info.width));
    const pageHeight = Math.max(...frames.map((f) => f.result.info.height));
    const stripStream = new stream.Readable();
    const sharpStream = sharp({
      raw: {
        channels: 4,
        width: maxWidth,
        height: pageHeight * numberOfFrames,
      },
      limitInputPixels: false,
    })
      .webp({ pageHeight, loop: 0, lossless: true })
      .on('data', (c) => {
        console.log('got image page');
      });

    stripStream.pipe(sharpStream);
    pushIntoStripStream(stripStream, frames, maxWidth, pageHeight);
    const exportNameString = exportName ? `${exportName.join('&')}-` : 'noexport-';
    return sharpStream
      .clone()
      .toFile(`out/${fileName}-movieclip-${exportNameString}${exportId}-${numberOfFrames}.webp`);
  }

  logger.info('Finished extracting movie clips');
};

const createMovieClips = async (filename, transformMatrices, colorTransforms, resources, exports) => {
  logger.info('Extracting movie clips');
  const generateMovieClipsPromises = [];
  // const resource = resources[4];
  Object.values(resources).forEach((resource) => {
    if (resource.type === 'movieClip') {
      generateMovieClipsPromises.push(createMovieClip(
        exports[resource.exportId],
        filename,
        resource.exportId,
        resources,
        transformMatrices,
        colorTransforms,
      ));
    }
  });
  await Promise.all(generateMovieClipsPromises);
  logger.info('Finished extracting movie clips');
};

module.exports = {
  readMovieClip,
  createMovieClips,
};
