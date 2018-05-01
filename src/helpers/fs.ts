import * as fs from 'fs';

export function fileExists(path: string) {
    return new Promise(resolve => fs.access(path, err => resolve(!err)));
}

export function mkdir(path: string) {
    return new Promise((resolve, reject) => fs.mkdir(
        path,
        generalCallback.bind(null, resolve, reject)));
}

export function writeFile(path: string, content: string) {
    return new Promise((resolve, reject) =>
        fs.writeFile(
            path,
            content,
            { encoding: 'utf8' },
            generalCallback.bind(null, resolve, reject)));
}

function generalCallback(resolve: () => void, reject: (err: Error) => void, err?: Error) {
    if (err) {
        reject(err);
    }
    resolve();
}

