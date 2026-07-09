/*!
 * IMQClient client-transpiler failure coverage
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
import './mocks/index.js';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
// live module object so mock.method() patches the same spawnSync the client
// transpiler reads at call time; under ESM the transpiler's named-import
// binding only picks the patch up after syncBuiltinESMExports()
import childProcess = require('node:child_process');
import { syncBuiltinESMExports } from 'node:module';
import { IMQService, IMQClient, expose } from '../index.js';

// Own spec file (hence own process): generating a client makes exactly one
// getDescription() round-trip; a second create() in the same process would hang
// on the shared redis mock, so this failure path is isolated here.
class TranspileErrService extends IMQService {
    @expose()
    public ping() {
        return 'pong';
    }
}

describe('IMQClient client transpiler failure', () => {
    let service: TranspileErrService;

    before(async () => {
        service = new TranspileErrService();
        await service.start();
    });
    after(async () => {
        await service.destroy();
    });

    it('throws when the client transpiler produces no output', async t => {
        // stub spawnSync so the tsc CLI never runs and emits no .js; the
        // transpiler must detect the missing output and throw, echoing the
        // captured stdout/stderr
        t.mock.method(childProcess, 'spawnSync', (() => ({
            stdout: 'boom-out',
            stderr: 'boom-err',
            status: 1,
        })) as any);
        syncBuiltinESMExports();
        t.after(() => {
            // t.mock auto-restores the CJS object; the ESM bindings must be
            // re-synced separately or the stub would leak into other tests
            setImmediate(() => syncBuiltinESMExports());
        });

        await assert.rejects(
            IMQClient.create('TranspileErrService', {
                compile: false,
                write: false,
            }),
            /client transpilation produced no output[\s\S]*boom-out[\s\S]*boom-err/,
        );
    });
});
