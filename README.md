# Supercell Extractor
Extract SC files for Brawl Stars, Clash of Clans, Hay Day, Clash Royal and any future SC game.

This project is purely for fun. You may not use it to develop a clone to these games or hack the games in any way.

Please follow the Supercell fan content policy - http://supercell.com/fan-content-policy

## About the tool
Welcome! The tool extracts assets from `.sc` files from all Supercell games (Brawl Stars, Clash of Clans, Hay Day and Clash Royal).

The tool extracts many more resources than any other SC extraction tool. Normally other tools can only extract textures and shapes (partially, as some aren't extracted correctly), but this tool is capable of extracting textures, shapes (fully, no weird pasting issues), gradients and **movie clips**.

The tool also does it much quicker than any other tool, about twice as fast as the currently fastest tool - https://github.com/AriusX7/sc-extract. This is due to the high performance library `SharpJS`.

The tool is in heavy development, and still has a lot of bugs and performance issues when it comes to generating movie clips. Please report if you see any bug, I'll gladly fix it.

## Movie clips
What are movie clips? Well, a movie clip is a collection of shapes, which can be used as a non-animated image or as an animated clip.

For example, the brawl stars background is a blue screen with a lot of moving skeletons. The game stores half of the blue screen as a shape, and one skeleton as a shape. To achieve the full background, the game takes the blue screen shape, rotates it and stitches the two halves together to form the entire blue screen. The game also takes the skeleton shape and adds an animation that moves it up. Lastly, the game takes the animated skeleton and duplicates it multiple times to achieve the final background.

## Installation
* Install NPM - https://www.npmjs.com/get-npm
* Install Node - https://nodejs.org/en/download/
* Clone the project - `git clone https://github.com/baraklevy20/Supercell-Viewer.git`
* Run `cd Supercell-Viewer`
* Run `npm i`
* Done, now you can use the extractor.

## Usage
To run the extractor, run `node extractor.js` followed by a list of files or folders you wish to extract, using the `--folder` and `--file` arguments.

For example, to extract the content of the folders `sc`, `sc2` and the file `sc/hayday/animals.sc`, use `node extractor.js --folder sc --folder sc2 --file sc/hayday/animals.sc`.

By default, movie clips are **NOT** extracted, as movie clips are still buggy and extremely slow. To extract them anyway,
add the `--extract-movie-clips` flag. e.g. `node extractor.js --folder sc --extract-movie-clips`.

## What about SCP files from Everdale?
SCP files are archive files. Once you unzip the files in them, you can use this extractor to extract normally.

To unzip the files, use this other tool that I wrote - https://github.com/baraklevy20/SCP-Unpacker

## What about SC3D/CSV/Other file formats
Maybe in the future.

## What about changing the textures and saving it back as `.sc` files?
Compressing back into a valid `.sc` file is **NOT** supported.
