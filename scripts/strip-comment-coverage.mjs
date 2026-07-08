/*!
 * Coverage post-processor
 *
 * I'm Queue Software Project
 * Copyright (C) 2025  imqueue.com <support@imqueue.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * If you want to use this code in a closed source (commercial) project, you can
 * purchase a proprietary commercial license. Please contact us at
 * <support@imqueue.com> to get commercial licensing options.
 */

/**
 * Node's built-in coverage (`--experimental-test-coverage --enable-source-maps`)
 * reports every non-code line of a `.ts` source as uncovered, because comment
 * and blank lines have no source-map mappings and therefore fall outside every
 * covered V8 byte-range. That paints the license header and each JSDoc block
 * red in the HTML report and pushes per-file line% far below reality.
 *
 * Node's reporter also emits records that the (strict) genhtml LCOV 2.x tool
 * rejects — function entries with `undefined` line numbers or synthetic,
 * duplicated names (`<instance_members_initializer>`, and decorated methods all
 * mis-named `has`/`get`), plus `BRDA:undefined,...` branch records. Left in,
 * they produce a wall of warnings and a fatal "unexpected category" error.
 *
 * This script rewrites an lcov file in place: it drops the `DA`/`BRDA` records
 * for lines that contain no executable code (comments and blank lines), drops
 * all function records and malformed branch records, then recomputes the
 * `LF`/`LH`/`BRF`/`BRH` totals. It uses the TypeScript scanner (already a dev
 * dependency) to locate comments reliably — comment markers inside strings,
 * template literals and regexes are not misdetected. The result renders in
 * genhtml with accurate line + branch coverage and no warnings or errors.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

const lcovPath = process.argv[2] || 'coverage/lcov.info';

if (!existsSync(lcovPath)) {
    console.warn(`strip-comment-coverage: ${lcovPath} not found, skipping`);
    process.exit(0);
}

/**
 * Returns the set of 1-based line numbers in the given source that hold no
 * executable code — i.e. blank lines and lines whose only content is a comment.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function nonCodeLines(text) {
    const commentChars = new Uint8Array(text.length);
    // Collect every comment range from the parsed tree. A standalone
    // ts.createScanner is unreliable here — without parser context it can
    // mis-scan a stray `/` as a regex literal and swallow the comments inside
    // it — so walk all tokens and take their leading/trailing comment trivia,
    // which every comment in the file belongs to.
    const sf = ts.createSourceFile('x.ts', text, ts.ScriptTarget.Latest, true);
    const seen = new Set();
    const mark = pos => {
        for (const get of [
            ts.getLeadingCommentRanges,
            ts.getTrailingCommentRanges,
        ]) {
            for (const range of get(text, pos) || []) {
                const key = `${range.pos}:${range.end}`;

                if (seen.has(key)) {
                    continue;
                }

                seen.add(key);

                for (let i = range.pos; i < range.end; i++) {
                    commentChars[i] = 1;
                }
            }
        }
    };
    const visit = node => {
        mark(node.getFullStart());
        node.getChildren(sf).forEach(visit);
    };

    visit(sf);

    const lines = text.split('\n');
    const result = new Set();
    let pos = 0;

    for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        let hasCode = false;

        for (let i = 0; i < line.length; i++) {
            const ch = line[i];

            if (ch === ' ' || ch === '\t' || ch === '\r') {
                continue;
            }

            if (!commentChars[pos + i]) {
                hasCode = true;
                break;
            }
        }

        if (!hasCode) {
            result.add(ln + 1);
        }

        pos += line.length + 1; // account for the split '\n'
    }

    return result;
}

/**
 * Returns the set of 1-based lines that carry no coverable executable code of
 * their own yet Node's source-mapped coverage mis-reports as uncovered
 * (the mapping lands outside the covered byte-range, especially under
 * `nodenext` output). These are:
 *   - imports (compile to a `require` that always runs on load);
 *   - module-scope variable declarations (`const`/`let`/`var`) — the whole
 *     statement if its initializer has no function body, otherwise just the
 *     declaration line so real bodies keep their coverage;
 *   - class declaration headers and type-only property fields (no initializer).
 * Method/accessor/constructor bodies are never touched, so genuinely unreached
 * code still shows up.
 *
 * @param {string} text
 * @returns {Set<number>}
 */
function importLines(text) {
    const sf = ts.createSourceFile(
        'x.ts',
        text,
        ts.ScriptTarget.Latest,
        false,
    );
    const result = new Set();
    const lineAt = pos => sf.getLineAndCharacterOfPosition(pos).line;
    const addRange = (start, end) => {
        for (let line = lineAt(start); line <= lineAt(end); line++) {
            result.add(line + 1);
        }
    };
    const hasFunction = node => {
        let found = false;
        const walk = n => {
            if (found) {
                return;
            }

            if (
                ts.isFunctionExpression(n) ||
                ts.isArrowFunction(n) ||
                ts.isFunctionDeclaration(n) ||
                ts.isMethodDeclaration(n)
            ) {
                found = true;

                return;
            }

            n.forEachChild(walk);
        };

        walk(node);

        return found;
    };

    for (const stmt of sf.statements) {
        if (
            ts.isImportDeclaration(stmt) ||
            ts.isImportEqualsDeclaration(stmt)
        ) {
            addRange(stmt.getStart(sf), stmt.getEnd());
        } else if (ts.isVariableStatement(stmt)) {
            if (hasFunction(stmt)) {
                result.add(lineAt(stmt.getStart(sf)) + 1);
            } else {
                addRange(stmt.getStart(sf), stmt.getEnd());
            }
        } else if (ts.isClassDeclaration(stmt)) {
            // class header (`class X extends Y {`): everything up to the first
            // member, or the whole thing for an empty class
            const headerEnd = stmt.members.length
                ? stmt.members[0].getStart(sf)
                : stmt.getEnd();

            addRange(stmt.getStart(sf), headerEnd);
            // the closing brace line emits no coverable code either
            result.add(lineAt(stmt.getEnd()) + 1);

            // type-only fields (definite-assignment / uninitialized) emit no JS
            for (const member of stmt.members) {
                if (
                    ts.isPropertyDeclaration(member) &&
                    !member.initializer
                ) {
                    addRange(member.getStart(sf), member.getEnd());
                }
            }
        }
    }

    return result;
}

const B64 =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64MAP = new Map([...B64].map((c, i) => [c, i]));

/**
 * Decodes one base64 VLQ source-map segment into its integer fields.
 *
 * @param {string} seg
 * @returns {number[]}
 */
function decodeVLQ(seg) {
    const out = [];
    let shift = 0;
    let value = 0;

    for (const ch of seg) {
        const digit = B64MAP.get(ch);

        if (digit === undefined) {
            break;
        }

        value += (digit & 31) << shift;

        if (digit & 32) {
            shift += 5;
        } else {
            out.push(value & 1 ? -(value >> 1) : value >> 1);
            value = 0;
            shift = 0;
        }
    }

    return out;
}

/**
 * Returns the set of 1-based source lines that produced generated JavaScript,
 * read from the file's `.js.map`. These are exactly the coverable lines — every
 * other line (comments, blanks, type-only declarations, interfaces) emits no
 * code and can never be executed. Returns null when no source map is present.
 *
 * @param {string} sourceFile - path of the .ts source (e.g. src/RedisQueue.ts)
 * @returns {Set<number> | null}
 */
function emittedLines(sourceFile) {
    const mapPath = sourceFile.replace(/\.ts$/, '.js.map');

    if (!existsSync(mapPath)) {
        return null;
    }

    let map;

    try {
        map = JSON.parse(readFileSync(mapPath, 'utf8'));
    } catch {
        return null;
    }

    if (typeof map.mappings !== 'string') {
        return null;
    }

    const lines = new Set();
    let srcIndex = 0;
    let srcLine = 0;

    for (const group of map.mappings.split(';')) {
        for (const seg of group.split(',')) {
            if (!seg) {
                continue;
            }

            const fields = decodeVLQ(seg);

            // [genCol, srcIndex, srcLine, srcCol, nameIndex]; <4 fields = no
            // source position for this segment
            if (fields.length >= 4) {
                srcIndex += fields[1];
                srcLine += fields[2];

                if (srcIndex === 0) {
                    lines.add(srcLine + 1); // map lines are 0-based
                }
            }
        }
    }

    return lines;
}

const coverableCache = new Map();

/**
 * Resolves how to filter a source file's line records:
 *   - `{ mode: 'keep', set }` — keep only lines in `set` (source-map driven);
 *   - `{ mode: 'drop', set }` — drop lines in `set` (comment-scanner fallback).
 *
 * @param {string} sourceFile
 * @returns {{ mode: 'keep' | 'drop', set: Set<number> }}
 */
function coverableInfo(sourceFile) {
    if (coverableCache.has(sourceFile)) {
        return coverableCache.get(sourceFile);
    }

    const emitted = sourceFile ? emittedLines(sourceFile) : null;
    let info;

    if (emitted && existsSync(sourceFile)) {
        // A line is coverable only if it emitted JS (has a source-map mapping)
        // AND is not a comment/blank AND is not an import statement. The comment
        // check is required because `removeComments: false` keeps license/JSDoc
        // comments in the output, so they carry mappings too; the mapping check
        // drops type-only lines (interfaces, type aliases) which emit nothing;
        // the import check drops the mis-mapped import artifact.
        const text = readFileSync(sourceFile, 'utf8');
        const nonCode = nonCodeLines(text);
        const imports = importLines(text);
        const keep = new Set(
            [...emitted].filter(
                line => !nonCode.has(line) && !imports.has(line),
            ),
        );
        info = { mode: 'keep', set: keep };
    } else if (sourceFile && existsSync(sourceFile)) {
        const text = readFileSync(sourceFile, 'utf8');
        const skip = nonCodeLines(text);

        for (const line of importLines(text)) {
            skip.add(line);
        }

        info = { mode: 'drop', set: skip };
    } else {
        info = { mode: 'drop', set: new Set() };
    }

    coverableCache.set(sourceFile, info);

    return info;
}

let strippedLines = 0;

/**
 * Rewrites a single lcov record so that genhtml accepts it without warnings or
 * errors. It:
 *   - drops DA/BRDA entries on non-code (comment/blank) lines;
 *   - drops all function records (FN/FNDA/FNF/FNH) — Node's source-mapped
 *     function detection is unreliable here (undefined line numbers, mis-named
 *     and duplicated entries), which genhtml rejects, so line + branch coverage
 *     is kept instead;
 *   - drops malformed branch records such as `BRDA:undefined,...`;
 *   - recomputes the LF/LH/BRF/BRH totals.
 *
 * @param {string[]} recordLines - record body, excluding the end_of_record line
 * @returns {string}
 */
function processRecord(recordLines) {
    const sfLine = recordLines.find(line => line.startsWith('SF:'));
    const sourceFile = sfLine ? sfLine.slice(3).trim() : '';
    const info = coverableInfo(sourceFile);

    // true when a source line produces no executable code and must be dropped
    const drop = n => (info.mode === 'keep' ? !info.set.has(n) : info.set.has(n));

    let lf = 0;
    let lh = 0;
    let brf = 0;
    let brh = 0;

    const kept = recordLines.filter(line => {
        // drop all function records — unreliable under source maps
        if (/^(FN:|FNDA:|FNF:|FNH:)/.test(line)) {
            return false;
        }

        const da = line.match(/^DA:(\d+),(\d+)/);

        if (da) {
            if (drop(+da[1])) {
                strippedLines++;

                return false;
            }

            lf++;

            if (+da[2] > 0) {
                lh++;
            }

            return true;
        }

        if (line.startsWith('BRDA:')) {
            const brda = line.match(/^BRDA:(\d+),\d+,\d+,(\d+|-)$/);

            // drop malformed (e.g. BRDA:undefined,...) or non-code branches
            if (!brda || drop(+brda[1])) {
                return false;
            }

            brf++;

            if (brda[2] !== '-' && +brda[2] > 0) {
                brh++;
            }

            return true;
        }

        // drop the old totals — they are recomputed below
        return !/^(LF|LH|BRF|BRH):/.test(line);
    });

    return (
        `${kept.join('\n')}\n` +
        `LF:${lf}\nLH:${lh}\nBRF:${brf}\nBRH:${brh}\nend_of_record\n`
    );
}

const output = [];
let record = [];

for (const line of readFileSync(lcovPath, 'utf8').split('\n')) {
    if (line === 'end_of_record') {
        output.push(processRecord(record));
        record = [];
    } else if (line !== '') {
        record.push(line);
    }
}

writeFileSync(lcovPath, output.join(''));
console.info(
    `strip-comment-coverage: removed ${strippedLines} comment/blank line ` +
        `entries from ${lcovPath}`,
);
