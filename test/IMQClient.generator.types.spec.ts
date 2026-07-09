/*!
 * IMQClient generator coverage: type interfaces, method JSDoc, Promise return,
 * and the non-compiling generation branch.
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
import * as fs from 'node:fs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
    IMQService,
    IMQClient,
    expose,
    property,
    classType,
    indexed,
} from '../index.js';

// The generated client imports from '@imqueue/rpc'; the package.json `exports`
// field lets that specifier self-resolve to this in-tree build, so no module
// mock is needed to make the compiled client load.

const CLIENTS_PATH = './test/clients-generator-types';

@classType()
class GenPoint {
    @property('number')
    public x!: number;

    @property('number', true)
    public y?: number;
}

@classType()
class GenPoint3D extends GenPoint {
    @property('number')
    public z!: number;
}

@indexed('[key: string]: string')
@classType()
class GenBag {}

class GenTypesService extends IMQService {
    /**
     * Saves a point in space.
     *
     * @param {GenPoint3D} p - the point to save
     * @return {void}
     */
    @expose()
    public save(p: GenPoint3D) {
        void p;
    }

    /**
     * @return {Promise}
     */
    @expose()
    public bare() {
        return Promise.resolve();
    }
}

function rmdirr(path: string): void {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(file => {
            const curPath = `${path}/${file}`;

            if (fs.lstatSync(curPath).isDirectory()) {
                rmdirr(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

describe('IMQClient.generator type interfaces', () => {
    let service: GenTypesService;

    before(async () => {
        service = new GenTypesService();
        await service.start();
    });
    after(async () => {
        await service.destroy();
        rmdirr(CLIENTS_PATH);
    });

    it('emits interfaces, JSDoc and Promise<any>, returning null uncompiled', async () => {
        // compile: false exercises the non-compiling generation branch and
        // returns null, while write: true still emits the .ts we inspect
        const result = await IMQClient.create('GenTypesService', {
            path: CLIENTS_PATH,
            compile: false,
            write: true,
        });

        assert.equal(result, null);

        const src = fs.readFileSync(
            `${CLIENTS_PATH}/GenTypesService.ts`,
            'utf8',
        );

        // registered types become interfaces; an inheriting type uses extends
        assert.match(src, /export interface GenPoint\s*\{/);
        assert.match(src, /export interface GenPoint3D\s+extends GenPoint/);
        // @indexed type emits its index signature
        assert.match(src, /export interface GenBag/);
        assert.match(src, /\[key: string\]: string/);
        // required and optional properties
        assert.match(src, /x: number;/);
        assert.match(src, /y\?: number;/);
        // a method description renders into the generated JSDoc
        assert.match(src, /Saves a point in space\./);
        // a bare Promise return type becomes Promise<any>
        assert.match(src, /bare\([^)]*\)\s*:\s*Promise<any>/);
    });
});
