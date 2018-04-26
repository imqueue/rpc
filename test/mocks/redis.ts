/*!
 * IMQ Unit Test Mocks: redis
 *
 * Copyright (c) 2018, Mykhailo Stadnyk <mikhus@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */
import * as mock from 'mock-require';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { IMulti, IRedisClient } from 'imq';

function sha1(str: string) {
    let sha: crypto.Hash = crypto.createHash('sha1');
    sha.update(str);
    return sha.digest('hex');
}

/**
 * @implements {IRedisClient}
 */
export class RedisClientMock extends EventEmitter {
    private static __queues__: any = {};
    private static __clientList: any = {};
    private __rt: any;
    private static __keys: any = {};
    private __name: string = '';
    // noinspection JSUnusedGlobalSymbols
    public connected: boolean = true;
    public ready: boolean = true;

    constructor() {
        super();
        setTimeout(() => {
            this.emit('ready', this);
        });
    }

    // noinspection JSUnusedGlobalSymbols
    public end() {}
    // noinspection JSUnusedGlobalSymbols
    public quit() {}

    // noinspection JSUnusedGlobalSymbols,JSMethodCanBeStatic
    public async set(...args: any[]): Promise<boolean> {
        const [key, val] = args;
        RedisClientMock.__keys[key] = val;
        const cb = args.pop();
        typeof cb === 'function' && cb(null, 1);
        return true;
    }

    // noinspection JSUnusedGlobalSymbols,JSMethodCanBeStatic
    public async get(...args: any[]): Promise<string> {
        const [key] = args;
        const val = RedisClientMock.__keys[key];
        const cb = args.pop();
        typeof cb === 'function' && cb(null, val);
        return val;
    }

    // noinspection JSUnusedGlobalSymbols,JSMethodCanBeStatic
    public async setnx(...args: any[]): Promise<boolean> {
        const self = RedisClientMock;
        const key = args.shift();
        let result = 0;
        if (/:watch:lock$/.test(key)) {
            if (typeof self.__keys[key] === 'undefined') {
                self.__keys[key] = args.shift();
                result = 1;
            }
        }
        const cb = args.pop();
        typeof cb === 'function' && cb(null, result);
        return true;
    }

    // noinspection JSUnusedGlobalSymbols,JSMethodCanBeStatic
    public async del(...args: any[]): Promise<boolean> {
        const self = RedisClientMock;
        const cb = args.pop();
        let count = 0;
        for (let key of args) {
            if (self.__keys[key] !== undefined) {
                delete self.__keys[key];
                count++;
            }
            if (self.__queues__[key] !== undefined) {
                delete self.__queues__[key];
                count++;
            }
        }
        typeof cb === 'function' && cb(null, count);
        return true;
    }

    // noinspection JSUnusedGlobalSymbols
    public unref(): boolean {
        delete RedisClientMock.__clientList[this.__name];
        if (this.__rt) {
            clearTimeout(this.__rt);
            delete this.__rt;
        }
        return true;
    }

}

/**
 * @implements {IMulti}
 */
export class RedisMultiMock extends EventEmitter {}

mock('redis', {
    createClient() { return new RedisClientMock() },
    RedisClient: RedisClientMock,
    Multi: RedisMultiMock
});

export * from 'redis';
