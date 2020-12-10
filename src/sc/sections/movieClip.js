const readMovieClip = (buffer) => {
  const exportId = buffer.readUInt16LE();
  // console.log(`MovieClip exportId: ${exportId}`);
  if (exportId === 3476) {
    // console.log('working');
  }
  // console.log(exports[exportId]);
  const frameRate = buffer.readUInt8();
  const countFrames = buffer.readUInt16LE();
  const countTriples = buffer.readUInt32LE();
  const triples = [];
  // console.log(`count triples: ${countTriples}`);

  for (let i = 0; i < countTriples; i++) {
    // First number - index of resourcesMapping
    // Second number - index of transform matrix or default matrix if -1
    // Third number - index of color transform or default if -1
    const triple = [buffer.readInt16LE(), buffer.readInt16LE(), buffer.readInt16LE()];
    triples.push(triple);
  }

  const numberOfResources = buffer.readUInt16LE();
  const resourcesMapping = [];
  for (let i = 0; i < numberOfResources; i++) {
    resourcesMapping.push(buffer.readInt16LE());
  }
  for (let i = 0; i < numberOfResources; i++) {
    const num = buffer.readUInt8();
    // console.log(`xuint8: ${num}`);
  }

  for (let i = 0; i < numberOfResources; i++) {
    const string = buffer.scReadString();
    // console.log(`id: ${resourcesMapping[i]} x string: ${string}`);
  }

  let frameType;
  let currentTripleIndex = 0;
  const frames = [];

  while (frameType !== 0) {
    frameType = buffer.readUInt8();
    const frameSize = buffer.readUInt32LE();

    if (frameSize === 0) {
      break;
    }
    switch (frameType) {
      case 0x0b: {
        const numberOfTriplesInCurrentFrame = buffer.readUInt16LE();
        const frameName = buffer.scReadString();
        if (frameName !== null) {
          // console.log(`frameName: ${frameName}`);
        }

        const currentFrameTriples = [];

        for (let i = 0; i < numberOfTriplesInCurrentFrame; i++) {
          const currentTriple = triples[currentTripleIndex + i];
          currentFrameTriples.push(currentTriple);
        }

        frames.push({
          triples: currentFrameTriples,
        });

        currentTripleIndex += numberOfTriplesInCurrentFrame;
        break;
      }
      case 0x1f: {
        const v27 = buffer.readInt32LE() * 0.05;
        const v28 = buffer.readInt32LE() * 0.05;
        const v29 = buffer.readInt32LE() * 0.05 + v27;
        const v30 = buffer.readInt32LE() * 0.05 + v28;
        // console.log(`frame type 0x1f: ${[v27, v28, v29, v30]}`);
        break;
      }
      case 0x29: { // only happens in effects_brawler i think
        const something = buffer.readUInt8();
        // console.log(`frame type 0x29: ${something}`);
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

module.exports = {
  readMovieClip,
};
