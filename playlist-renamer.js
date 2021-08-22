const path = require('path');
const fs = require('fs');
const commandLineArgs = require('command-line-args');

const optionDefinitions = [
    { name: 'src', alias: 's', type: String },
    { name: 'playlist', alias: 'p', type: String }
]

const cliOptions = commandLineArgs(optionDefinitions);
// const startPathMock = path.resolve('./sandbox');
// const playlistPathMock = path.resolve('./sandbox/playlist.pls');

if (!cliOptions.src || !cliOptions.playlist) {
    console.error('You have to provide playlist and path to your music folder');
    return;
}

const startPath = path.resolve(cliOptions.src);
const playlistPath = path.resolve(cliOptions.playlist);

if (!playlistPath.match(/pls$/)) {
    console.error('Unexcpected playlist format. You have to store only Winamp format (*.pls file)');
    return;
}

Main();

function Main() {
    const files = getAllFilenamesInFolder();
    
    const playlist = getPlaylist(playlistPath);
    const fixedNames = performNames(playlist, files);

    renameFiles(fixedNames);
}

/**
 * 
 * @returns {Array<string>} all filenames in target folder
 */
function getAllFilenamesInFolder() {
    const files = fs.readdirSync(startPath);
    const filenames = files
        // we need only audio files
        .filter((file, idx, arr) => {
            if (file.match(/(mp3$|wav$|flac$)/)) {
                return true;
            } else {
                return false;
            }
        })
    
    return filenames;
}

/**
 * 
 * @param {String} filename 
 * @returns {String} filename without digits at start of the name, i.e
 * 012 - Track-1.mp3 => Track-1.mp3
 */
function removeDigitsFromFilename(filename) {
    const regex = /^[0-9]+(\.|-|\s|_|)+/;
    
    if (filename.match(regex)) {
        return filename.replace(regex, '');
    }

    return filename;
}

/**
 * 
 * @param {Array<{ old: string, new: string }>} files 
 */
function renameFiles(files) {
    files.forEach(file => {
        if (fs.existsSync(file.old)) {
            fs.renameSync(file.old, file.new);
        } else {
            console.warn(`Что-то пошло не так с ${file.old}::${file.new}`)
        }
    })
}

/**
 * 
 * @param {String} pathToPlaylist 
 * @returns {Array<{ file: string, title: string }>}
 */
function getPlaylist(pathToPlaylist) {
    const rawFile = fs.readFileSync(pathToPlaylist);

    return parsePlaylist(rawFile.toString());
}

/**
 * @returns {Array<{ file: string, title: string }>}
 */
function parsePlaylist(playlistRaw) {
    const playListCopy = playlistRaw.replace(/(Length[0-9]+.+|NumberOfEntries=[0-9]+|Version=[0-9]+|\[playlist\]|\r)/g, '');
    const splittedRows = playListCopy.split('\n').filter(v => v);

    let container = {};

    return splittedRows.reduce((acc, curr, currIdx) => {
        const shiftedIndex = currIdx + 1;
        
        if (shiftedIndex % 2 > 0) {
            container['file'] = curr;
        } else if (shiftedIndex % 2 === 0) {
            container['title'] = curr;
            // push previous completed container and start fill next one
            acc.push(container);
            container = {};            
        }

        return acc;
    }, [])
}

/** Переименовывает только файлы, согласно их именам на ФС,
 * метаданные из плейлиста про исоплнителя не берет
 * 
 * @returns {Array<{ old: string; new: string> }
 */
function performNames(parsedPlaylist, files) {
    return files.map((file, idx, arr) => {
        const target = parsedPlaylist.find(item => item.file.indexOf(file) > -1);

        if (!target) {
            const fallback = '000_' + removeDigitsFromFilename(file);
            
            return {
                old: path.resolve(startPath, file),
                new: path.resolve(startPath, fallback)
            }
        }

        const fixedIndex = target.file.match(/File\d+/)[0].replace(/[a-z]/gi, '');
        const humanReadableTitle = removeDigitsFromFilename(file);
        const prefix = fixedIndex < 10 ? '00' : '0';


        return {
            old: path.resolve(startPath, file),
            new: path.resolve(startPath, `${prefix + fixedIndex}_${humanReadableTitle}`)
        }
    });
}