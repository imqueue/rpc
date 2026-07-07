/*!
 * IMQClient generator trailing args removal coverage test
 */
import * as fs from 'fs';
import mockRequire from 'mock-require';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { IMQService, IMQClient, IMQDelay, IMQMetadata, expose } from '..';
import * as imqRpc from '..';

// The generated client imports from '@imqueue/rpc'; map it to this package so
// the compiled-and-required client resolves without a self node_modules link.
mockRequire('@imqueue/rpc', imqRpc);

const CLIENTS_PATH = './test/clients-generator-trailing';

class GenTrailingService extends IMQService {
    /**
     * @param {string} name
     * @param {IMQMetadata} [meta]
     * @param {IMQDelay} [delay]
     * @return {string}
     */
    @expose()
    public greet(name: string, meta?: IMQMetadata, delay?: IMQDelay) {
        return `hi ${name}`;
    }
}

// We don't need a manual client; the generator will create it dynamically.

describe('IMQClient.generator trailing args removal (IMQDelay/IMQMetadata)', () => {
    let service: GenTrailingService;

    function rmdirr(path: string) {
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

    before(async () => {
        service = new GenTrailingService();
        await service.start();
    });

    after(async () => {
        await service.destroy();
        rmdirr(CLIENTS_PATH);
    });

    it('should strip trailing metadata/delay from service description and add imqMetadata/imqDelay once', async () => {
        const mod: any = await IMQClient.create('GenTrailingService', {
            path: CLIENTS_PATH,
            compile: true,
            write: true,
        });

        // Ensure client class exists and can be instantiated
        const client = new mod.GenTrailingClient();
        await client.start();

        // Read generated TypeScript to verify the signature
        const tsPath = `${CLIENTS_PATH}/GenTrailingService.ts`;
        assert.equal(fs.existsSync(tsPath), true);
        const src = fs.readFileSync(tsPath, 'utf8');

        // The generated method should not keep original parameter names 'meta' or 'delay'
        // as they are stripped and replaced by imqMetadata/imqDelay at the end once.
        const signatureRe = /public\s+async\s+greet\(([^)]*)\)/;
        const m = src.match(signatureRe);
        assert.notEqual(
            m,
            null,
            'method signature not found in generated client',
        );
        const signature = (m as RegExpMatchArray)[1];

        // It should include imqMetadata?: IMQMetadata and imqDelay?: IMQDelay
        assert.match(signature, /imqMetadata\?\s*:\s*IMQMetadata/);
        assert.match(signature, /imqDelay\?\s*:\s*IMQDelay/);

        // the real arg keeps its JSDoc-derived type (proves standard-decorator +
        // JSDoc reproduces correctly-typed client signatures, no empty types)
        assert.match(signature, /name\s*:\s*string/);
        // a trailing framework arg is detected via its JSDoc type and stripped
        assert.doesNotMatch(signature, /\bdelay\?\s*:\s*IMQDelay/);

        // Cleanup
        await client.destroy();
    });
});
