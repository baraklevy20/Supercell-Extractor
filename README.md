# Supercell Extractor
Extract SC files for Brawl Stars, Clash of Clans, Hay Day, Clash Royal and any future SC game.

This project is purely for fun. You may not use it to develop a clone to these games or hack the games in any way.

Please follow the Supercell fan content policy - http://supercell.com/fan-content-policy

## About the tool
Welcome! The tool extracts assets from `.sc` files from all Supercell games (Brawl Stars, Clash of Clans, Hay Day and Clash Royal).

The tool extracts many more resources than any other SC extraction tool. Normally other tools can only extract textures and shapes (partially, as some aren't extracted correctly), but this tool is capable of extracting textures, shapes (fully, no weird pasting issues), gradients and **movie clips**.

The tool also does it much quicker than any other tool, about twice as fast as the currently fastest tool - https://github.com/AriusX7/sc-extract.

The tool is in heavy development, and still has a lot of bugs and performance issues when it comes to generating movie clips. Please report if you see any bug, I'll gladly fix it.

## Movie clips
What are movie clips? Well, a movie clip is a collection of shapes, which can be used as a non-animated image or as an animated image. For example, the `background_basic.sc` file in Brawl Stars contains a shape that corresponds to the left portion of the background. The file also contains a movie clip that contains the left portion of the background plus the same shape but rotated and stitched together, to form the entire background (the right portion too). Then, a second movie clip uses that movie clip (the movie clip that contains the full background) and adds the animated skulls, resulting in a 'final' animated image that contains the background and the moving skulls on top of it.

In other words, this tool extracts non-animated and animated movie clips as well.

## Installation
* Install NPM - https://www.npmjs.com/get-npm
* Install Node - https://nodejs.org/en/download/
* Clone the project - `git clone https://github.com/baraklevy20/Supercell-Viewer.git`
* Run `cd Supercell-Viewer`
* Run `npm i`
* Done, now you can use the extractor.

## Usage
To run the extractor, run `node index.js` followed by a list of files or folders you wish to extract, using the `--folder` and `--file` arguments.

For example, to extract the content of the folders `sc`, `sc2` and the file `sc/hayday/animals.sc`, use `node index.js --folder sc --folder sc2 --file sc/hayday/animals.sc`.

## What about changing the textures and saving it back as `.sc` files?
Compressing back into a valid `.sc` file is **not** supported.
