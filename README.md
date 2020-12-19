# Supercell Extractor
Extract SC files for Brawl Stars, Clash of Clans, Hay Day and Clash Royal.

The tool is still in development.

This project is purely for fun. You may not use it to develop a clone to these games or hack the games in any way.

Please follow the Supercell fan content policy - http://supercell.com/fan-content-policy

## About the tool

The tool extracts many more resources than any other SC extraction tool. Normally other tools can only extract textures and shapes (partially, as some aren't extracted correctly), but this tool is capable of extracting textures, shapes (fully), gradients and **movie clips**.

The tool also does it much quicker than any other tool, about twice as fast as the currently fastest tool - https://github.com/AriusX7/sc-extract.

## Installation
* Install NPM - https://www.npmjs.com/get-npm
* Install Node - https://nodejs.org/en/download/
* Clone the project - `git clone https://github.com/baraklevy20/Supercell-Viewer.git`
* Run `cd Supercell-Viewer`
* Run `npm i`
* Done, now you can use the extractor.

## Usage
* To run the extractor, run `node index.js` followed by a list of files or folders you wish to extract, using the `--folder` and `--file` arguments.

For example, to extract the content of the folders `sc`, `sc2` and the file `sc/hayday/animals.sc`, use `node index.js --folder sc --folder sc2 --file sc/hayday/animals.sc`.
