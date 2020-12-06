const Jimp = require('jimp');

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

module.exports = {
  saveImage,
};
