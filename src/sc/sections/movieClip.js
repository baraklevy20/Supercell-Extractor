const sharp = require('sharp');
const imageUtils = require('../../imageUtils');
const shapeSection = require('./shape');
const logger = require('../../../logger');

const readMovieClip = (buffer) => {
  const exportId = buffer.readUInt16LE();
  // logger.debug(`MovieClip exportId: ${exportId}`);
  if (exportId === 3476) {
    // logger.debug('working');
  }

  const frameRate = buffer.readUInt8();
  const framesCount = buffer.readUInt16LE();
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
  }

  const numberOfResources = buffer.readUInt16LE();
  const resourcesMapping = [];
  for (let i = 0; i < numberOfResources; i += 1) {
    resourcesMapping.push(buffer.readInt16LE());
  }
  for (let i = 0; i < numberOfResources; i += 1) {
    const num = buffer.readUInt8();
    // logger.debug(`number uint8: ${num}`);
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
  };

  return movieClip;
};

const getTransformMatrix = (transformMatrices, index) => (
  index !== -1 ? transformMatrices[index] : null
);

const getColorTransformation = (colorMatrices, index) => (
  index !== -1 ? colorMatrices[index] : null
);

const applyOperations = async (path, resource, transformation, colorTransformation) => {
  if (resource.type !== 'shape') {
    // logger.debug(path, resource.type);
  } else {
    if (colorTransformation !== null) {
      imageUtils.applyColorTransformationMutable(resource.pixels, colorTransformation);
    }
    let transformed = sharp(resource.pixels, {
      raw:
      {
        channels: 4,
        width: resource.width,
        height: resource.height,
      },
    });

    if (transformation) {
      transformed = transformed.affine(transformation.matrix, {
        background: '#00000000',
        odx: transformation.odx,
        ody: transformation.ody,
      });
    }

    await imageUtils.saveSharp(`${path}`, transformed);
  }
};

const getResourceByExportId = (resources, shapes, exportId) => {
  if (exportId in shapes) {
    return shapes[exportId];
  }

  return resources[exportId];
};

const createMovieClips = async (filename, transformMatrices, colorMatrices, textures, resources) => {
  const shapes = await shapeSection.extractShapes(filename, textures, resources);
  logger.info('Extracting movie clips');
  // eventually i'll split resources into text fields and movie clips as well
  const generateMovieClipsPromises = [];
  Object.keys(resources).forEach((exportId) => {
    const movieClip = getResourceByExportId(resources, shapes, exportId);

    if (movieClip.type === 'movieClip') {
      movieClip.frames.forEach((frame, frameIndex) => {
        frame.frameResources.forEach((frameResource, frameResourceIndex) => {
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

          generateMovieClipsPromises.push(
            applyOperations(
              `out/${filename}-movieclip${exportId}-frame${frameIndex}-frameResource${frameResourceIndex}`,
              resource,
              transformation,
              colorTransformation,
            ),
          );
        });
      });
    }
  });

  await Promise.all(generateMovieClipsPromises);
  logger.info('Finished extracting movie clips');
};

module.exports = {
  readMovieClip,
  createMovieClips,
};
