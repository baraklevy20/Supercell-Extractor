const fs = require('fs');
const { SmartBuffer } = require('smart-buffer');
const sharp = require('sharp');
const utils = require('./utils');
const imageUtils = require('../imageUtils');

const shapeSection = require('./sections/shape');
const textFieldSection = require('./sections/textField');
const colorVariationSection = require('./sections/colorVariation');
const transformMatrixSection = require('./sections/transformMatrix');
const textureSection = require('./sections/texture');
const movieClipSection = require('./sections/movieClip');

const addResource = (resources, resource) => {
  resources[resource.exportId] = resource;
};

const readNormalScFile = async (filename, buffer, textures, isOld = false) => {
  console.log(`starting ${filename}`);
  // These are used to verify if you're attempting to read too many shapes/animations
  const resources = {};
  const transformMatrices = [];
  const colorMatrices = [];
  const shapesCount = buffer.readUInt16LE();
  const movieClipsCount = buffer.readUInt16LE();
  const texturesCount = buffer.readUInt16LE();
  const textFieldsCount = buffer.readUInt16LE();
  const transformMatricesCount = buffer.readUInt16LE();
  const colorTransformsCount = buffer.readUInt16LE();

  // Not used
  buffer.readBuffer(5);

  const numberOfExports = buffer.readUInt16LE();
  const exportsIds = [];
  const exports = {};

  for (let i = 0; i < numberOfExports; i++) {
    exportsIds.push(buffer.readUInt16LE());
  }

  for (let i = 0; i < numberOfExports; i++) {
    const exportName = utils.readString(buffer);
    // console.log(`${exportsIds[i].toString()} - ${exportName}`);
    exports[exportsIds[i]] = exportName;
  }

  // some block?
  if (!isOld) {
    const uselessBlock = buffer.readUInt8();
    if (uselessBlock === 0x17) {
      buffer.readBuffer(0x13);
    } else if (uselessBlock === 0x1a) {
      buffer.readBuffer(0xe);
    }
  }

  let blockSize;
  const readSpritePromises = [];
  let i = 0;
  while (blockSize !== 0) {
    const blockType = buffer.readUInt8();
    blockSize = buffer.readUInt32LE();

    if (blockSize === 0) {
      break;
    }

    // if (i === 1) {
    //   break;
    // }

    switch (blockType) {
      case 0x07:
      case 0x0f:
      case 0x14:
      case 0x15:
      case 0x19:
      case 0x21:
      case 0x2c:
        addResource(resources, textFieldSection.readTextField(buffer, blockType));
        break;
      case 0x08:
        transformMatrices.push(transformMatrixSection.readTransformMatrix(buffer));
        break;
      case 0x09:
        colorMatrices.push(colorVariationSection.readColorTransform(buffer));
        break;
      case 0x03:
      case 0x0a:
      case 0x0c:
      case 0x0e:
      case 0x23:
        addResource(resources, movieClipSection.readMovieClip(buffer));
        break;
      case 0x02:
      case 0x12:
        if (isOld) {
          buffer.readBuffer(blockSize);
        } else {
          addResource(resources, shapeSection.readShape(buffer, textures));
        }
        break;
      default: {
        const block = buffer.readBuffer(blockSize);
        console.log(
          `${i} Block type: ${blockType.toString(
            16,
          )}. Size: ${blockSize}. Data: ${block.slice(0, 20).toString('hex')}`,
        );
      }
    }
    i++;
  }

  console.log(`done with blocks. total: ${i}, filename: ${filename}`);
  await createMovieClips(transformMatrices, colorMatrices, textures, resources);
};

const applyOperations = async (path, resource, transformation, colorTransformation) => {
  if (resource.extractedShapes === undefined) {
    console.log('wtf');
  } else {
    for (let s = 0; s < resource.extractedShapes.length; s++) {
      const e = resource.extractedShapes[s];
      const { pixels } = e;

      for (let k = 0; k < pixels.length; k += 4) {
        pixels[4 * k] = Math.floor(pixels[4 * k] * colorTransformation.redMultiplier / 255);
        pixels[4 * k + 1] = Math.floor(pixels[4 * k + 1] * colorTransformation.greenMultiplier / 255);
        pixels[4 * k + 2] = Math.floor(pixels[4 * k + 2] * colorTransformation.blueMultiplier / 255);
        pixels[4 * k + 3] = Math.floor(pixels[4 * k + 3] * colorTransformation.alphaMultiplier / 255);
        pixels[4 * k] = Math.min(255, pixels[4 * k] + colorTransformation.redAddition);
        pixels[4 * k + 1] = Math.min(255, pixels[4 * k + 1] + colorTransformation.greenAddition);
        pixels[4 * k + 2] = Math.min(255, pixels[4 * k + 2] + colorTransformation.blueAddition);
      }

      // const transformed = e.shape.affine(transformation.matrix, { background: 'white', odx: transformation.odx, ody: transformation.ody });
      const transformed = sharp(pixels, {
        raw:
        {
          channels: 4,
          width: e.width,
          height: e.height,
        },
      })
        .affine(transformation.matrix, { background: '#00000000', odx: transformation.odx, ody: transformation.ody });
      await imageUtils.saveSharp(`${path} ${s}`, transformed);
    }
  }
};

const getTransformMatrix = (transformMatrices, index) => {
  if (index === -1) {
  // Identity matrix
    return {
      matrix: [1, 0, 0, 1],
      odx: 0,
      ody: 0,
    };
  }
  return transformMatrices[index];
};
const getColorTransformation = (colorMatrices, index) => {
  if (index === -1) {
    return {
      redMultiplier: 0xff,
      greenMultiplier: 0xff,
      blueMultiplier: 0xff,
      alphaMultiplier: 0xff,
      redAddition: 0,
      greenAddition: 0,
      blueAddition: 0,
    };
  }
  return colorMatrices[index];
};

const getShapeRegion = (polygons) => {
  const allX = [];
  const allY = [];
  polygons.forEach((polygon) => {
    polygon.coordinates.forEach((coordinate) => {
      allX.push(coordinate[0]);
      allY.push(coordinate[1]);
    });
  });

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  return {
    minX, maxX, minY, maxY,
  };
};

const extractColor = async (exportId, polygonIndex, shape, textures, tx, ty) => {
  if (polygonIndex === 4) {
    console.log('what')
  }
  // todo sometimes polygon[0] = polygon[2] and polygon[1]=polygon[3] wtf
  const color1Position = shape.polygon[0];
  const color2Position = shape.polygon[0][0] !== shape.polygon[1][0]
    || shape.polygon[0][1] !== shape.polygon[1][1] ? shape.polygon[1] : shape.polygon[2];
  const extractedShape = await imageUtils.createShapeWithColor(
    shape.coordinates,
    textures[shape.textureId].pixels[color1Position[1] * textures[shape.textureId].width + color1Position[0]],
    textures[shape.textureId].pixels[color2Position[1] * textures[shape.textureId].width + color2Position[0]],
    tx,
    ty,
  );

  return {
    exportId,
    polygonIndex,
    pixels: extractedShape.pixels,
    width: extractedShape.width,
    height: extractedShape.height,
  };
};

const extractShapes = async (textures, resources) => {
  for (const exportId in resources) {
    const resource = resources[exportId];

    if (resource.type === 'shape') {
      const extractShapePromises = [];
      const shapeRegion = getShapeRegion(resource.shapes);
      resource.shapes.forEach(async (shape, index) => {
        if (shape.isPolygon) {
          extractShapePromises.push(imageUtils.extractShapeAndResize(
            exportId,
            index,
            shape,
            textures[shape.textureId],
          ));
        } else {
          extractShapePromises.push(extractColor(exportId, index, shape, textures, shapeRegion.minX, shapeRegion.minY));
        }
      });

      const result = await Promise.all(extractShapePromises);
      const shapeWidth = Math.round(shapeRegion.maxX - shapeRegion.minX) + 1;
      const shapeHeight = Math.round(shapeRegion.maxY - shapeRegion.minY) + 1;

      // todo remove round, make sure coordinates are integers instead
      const shape = await sharp({
        create: {
          width: shapeWidth,
          height: shapeHeight,
          channels: 4,
          background: {
            r: 0, g: 0, b: 0, alpha: 0,
          },
        },
      })
        .composite(result.map((r) => ({
          input: r.pixels,
          raw: {
            channels: 4,
            width: r.width,
            height: r.height,
          },
          left: Math.round(resource.shapes[r.polygonIndex].minX - shapeRegion.minX),
          top: Math.round(resource.shapes[r.polygonIndex].minY - shapeRegion.minY),
        })))
        .toBuffer();
      await sharp(shape, {
        raw: {
          channels: 4,
          width: shapeWidth,
          height: shapeHeight,
        },
      })
        .png()
        .toFile(`out/shape${exportId}.png`);
      console.log('res');
    }
  }
  // const result = await Promise.all(extractShapePromises);
  // result.forEach((extractedShape) => {
  //   if (extractedShape) {
  //     resources[extractedShape.exportId].extractedShapes.push(extractedShape);
  //   }
  // });
};

const createMovieClips = async (transformMatrices, colorMatrices, textures, resources) => {
  await extractShapes(textures, resources);
  // const generateMovieClipsPromises = [];
  // Object.keys(resources).forEach((exportId) => {
  //   const movieClip = resources[exportId];

  //   if (movieClip.type === 'movieClip') {
  //     movieClip.frames.forEach((frame, frameIndex) => {
  //       frame.triples.forEach((triple, tripleIndex) => {
  //         const resource = resources[movieClip.resourcesMapping[triple[0]]];
  //         const transformation = getTransformMatrix(transformMatrices, triple[1]);
  //         const colorTransformation = getColorTransformation(colorMatrices, triple[2]);
  //         generateMovieClipsPromises.push(
  //           applyOperations(`out/MovieClip${exportId}-frame${frameIndex}-triple${tripleIndex}`, resource, transformation, colorTransformation),
  //         );
  //       });
  //     });
  //   }
  // });

  // const result = await Promise.all(generateMovieClipsPromises);
};

const getScBuffer = async (scFileName) => {
  const buffer = fs.readFileSync(`sc/${scFileName}.sc`);
  const decompressedScFile = SmartBuffer.fromBuffer(await utils.decompress(buffer));

  if (!utils.checkValidity(buffer, decompressedScFile)) {
    console.log('File is corrupted');
  }

  return decompressedScFile;
};

const getOldScBuffer = async (scFileName) => {
  const buffer = fs.readFileSync(`sccoc/${scFileName}.sc`);
  const decompressedScFile = SmartBuffer.fromBuffer(await utils.oldDecompress(buffer));
  return decompressedScFile;
};

const readScFile = async (scFileName) => {
  const textures = textureSection.readTextures(scFileName, await getScBuffer(`${scFileName}_tex`));
  readNormalScFile(scFileName, await getScBuffer(scFileName), textures);
};

const readOldScFile = async (scFileName) => {
  readNormalScFile(scFileName, await getOldScBuffer(scFileName), null, true);
};

module.exports = {
  readScFile,
  readOldScFile,
};
