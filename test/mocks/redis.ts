/*!
 * IMQ Unit Test Mocks: redis
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
import { mock } from 'node:test';
import { moduleMockOptions } from './moduleMock.js';
import { EventEmitter } from 'node:events';
import { createHash, type Hash } from 'node:crypto';

function sha1(str: string) {
    let sha: Hash = createHash('sha1');
    sha.update(str);
    return sha.digest('hex');
}

/**
 * @implements {Redis}
 */
export class RedisClientMock extends EventEmitter {
    private static __queues__: any = {};
    private static __clientList: any = {};
    private __rt: any;
    private static __keys: any = {};
    private static __scripts: any = {};
    private __name: string = '';
    // total number of mock connections constructed (used by race tests)
    public static __constructed: number = 0;
    public connected: boolean = true;
    public status = 'ready';

    constructor(options: any = {}) {
        super();
        RedisClientMock.__constructed++;
        setTimeout(() => {
            this.emit('ready', this);
        });

        if (options.connectionName) {
            this.__name = options.connectionName;
            RedisClientMock.__clientList[options.connectionName] = true;
        }
    }

    public async connect(): Promise<void> {
        this.connected = true;
        this.status = 'ready';
    }

    public end() {
        this.disconnectMock();
    }

    public async quit(): Promise<void> {
        this.disconnectMock();
    }

    // Stops the blocking-pop polling loop: with the connection gone no
    // timer may be rescheduled, so a finished test process can exit
    // instead of being kept alive by an orphaned polling timeout.
    private disconnectMock(): void {
        this.connected = false;

        if (this.__rt) {
            clearTimeout(this.__rt);
            this.__rt = undefined;
        }
    }

    public async set(...args: any[]): Promise<boolean> {
        let [key, val, units, expire, nx] = args;

        if (
            (units === 'NX' || nx === 'NX') &&
            RedisClientMock.__keys[key] !== undefined
        ) {
            const cb = args.pop();
            typeof cb === 'function' && cb(null, 0);
            return true;
        }

        RedisClientMock.__keys[key] = val;

        if (typeof units === 'string' && typeof expire === 'number') {
            if (units === 'EX') {
                expire *= 1000;
            }
            setTimeout(() => {
                delete RedisClientMock.__keys[key];
            }, expire);
        }

        const cb = args.pop();
        typeof cb === 'function' && cb(null, 1);
        return true;
    }

    public async get(...args: any[]): Promise<string> {
        const [key] = args;
        const val = RedisClientMock.__keys[key];
        const cb = args.pop();
        typeof cb === 'function' && cb(null, val);
        return val;
    }

    public setnx(...args: any[]): number {
        const self = RedisClientMock;
        const key = args.shift();
        let result = 0;
        if (/:watch:lock$/.test(key)) {
            if (typeof self.__keys[key] === 'undefined') {
                self.__keys[key] = args.shift();
                result = 1;
            }
        }

        this.cbExecute(args.pop(), null, result);

        return result;
    }

    public lpush(key: string, value: any, cb?: any): number {
        const self = RedisClientMock;
        if (!self.__queues__[key]) {
            self.__queues__[key] = [];
        }
        self.__queues__[key].push(value);
        this.cbExecute(cb, null, 1);
        return 1;
    }

    public async brpop(...args: any[]): Promise<string[]> {
        const [key, timeout, cb] = args;
        const q = RedisClientMock.__queues__[key] || [];
        if (!q.length) {
            this.__rt && clearTimeout(this.__rt);

            if (!this.connected) {
                // disconnected: stay pending forever without scheduling a
                // timer, so the event loop is free to drain
                return new Promise(() => undefined);
            }

            return new Promise(resolve => {
                this.__rt = setTimeout(
                    () => resolve(this.brpop(key, timeout, cb)),
                    timeout || 100,
                );
            });
        } else {
            const result = [key, q.shift()];

            this.cbExecute(cb, null, [key, q.shift()]);

            return result;
        }
    }

    public async brpoplpush(
        from: string,
        to: string,
        timeout: number,
        cb?: Function,
    ): Promise<string> {
        const fromQ = (RedisClientMock.__queues__[from] =
            RedisClientMock.__queues__[from] || []);
        const toQ = (RedisClientMock.__queues__[to] =
            RedisClientMock.__queues__[to] || []);
        if (!fromQ.length) {
            this.__rt && clearTimeout(this.__rt);

            if (!this.connected) {
                // see brpop(): no rescheduling after disconnect
                return new Promise(() => undefined);
            }

            return new Promise(resolve => {
                this.__rt = setTimeout(
                    () => resolve(this.brpoplpush(from, to, timeout, cb)),
                    timeout || 100,
                );
            });
        } else {
            toQ.push(fromQ.shift());
            cb && cb(null, '1');

            return '1';
        }
    }

    public lrange(
        key: string,
        start: number,
        stop: number,
        cb?: Function,
    ): boolean {
        const q = (RedisClientMock.__queues__[key] =
            RedisClientMock.__queues__[key] || []);
        const result = q.splice(start, stop);
        this.cbExecute(cb, null, result);
        return result;
    }

    public scan(...args: any[]): (string | string[])[] {
        const cb = args.pop();
        const qs = RedisClientMock.__queues__;
        const found: string[] = [];
        for (let q of Object.keys(qs)) {
            if (q.match(/worker/)) {
                found.push(q);
            }
        }
        const result = ['0', found];
        this.cbExecute(cb, null, result);
        return result;
    }

    public script(...args: any[]): unknown {
        const cmd = args.shift();
        const scriptOrHash = args.shift();
        const cb = args.pop();
        const isCb = typeof cb === 'function';

        if (cmd === 'LOAD') {
            const hash = sha1(scriptOrHash);
            RedisClientMock.__scripts[hash] = scriptOrHash;
            isCb && cb(null, hash);
            return hash;
        }
        if (cmd === 'EXISTS') {
            const hash = RedisClientMock.__scripts[scriptOrHash] !== undefined;

            isCb && cb(null, hash);

            return [Number(hash)];
        }

        return [0];
    }

    public client(...args: any[]): string | boolean {
        const self = RedisClientMock;
        const cmd = args.shift();
        const cb = args.pop();
        const name = args.shift();

        if (cmd === 'LIST') {
            const result = Object.keys(self.__clientList)
                .map((name: string, id: number) => `id=${id} name=${name}`)
                .join('\n');

            this.cbExecute(cb, null, result);
            return result;
        } else if (cmd === 'SETNAME') {
            this.__name = name;
            self.__clientList[name] = true;
        }

        this.cbExecute(cb, null, true);
        return true;
    }

    public exists(...args: any[]): boolean {
        const key = args.shift();
        const result = RedisClientMock.__keys[key] !== undefined;
        this.cbExecute(args.pop(), null, result);
        return result;
    }

    public async psubscribe(...args: any[]): Promise<number> {
        this.cbExecute(args.pop(), null, 1);
        return 1;
    }

    public evalsha(...args: any[]): boolean {
        this.cbExecute(args.pop());
        return true;
    }

    public async del(...args: any[]): Promise<number> {
        const self = RedisClientMock;
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
        this.cbExecute(args.pop(), count);
        return count;
    }

    public zadd(...args: any[]): boolean {
        const [key, score, value, cb] = args;
        const timeout = score - Date.now();
        setTimeout(() => {
            const toKey = key.split(/:/).slice(0, 2).join(':');
            this.lpush(toKey, value);
        }, timeout);
        this.cbExecute(cb);
        return true;
    }

    public disconnect(): boolean {
        delete RedisClientMock.__clientList[this.__name];
        if (this.__rt) {
            clearTimeout(this.__rt);
            delete this.__rt;
        }
        return true;
    }

    public async config(): Promise<boolean> {
        return true;
    }

    private cbExecute(cb: any, ...args: any[]): void {
        if (typeof cb === 'function') {
            cb(...args);
        }
    }
}

const Redis = RedisClientMock;

// The mock must serve both worlds: ESM sources bind the named `Redis`
// export directly, while CommonJS-style consumers read properties off the
// default (`module.exports`) object — so both shapes are registered.
mock.module(
    'ioredis',
    moduleMockOptions({
        default: { __esModule: true, Redis, default: Redis },
        Redis,
    }),
);

// @ts-ignore
export * from 'ioredis';

export { Redis };

export default Redis;
