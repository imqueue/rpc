/*!
 * IMQCache implementation
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
import { ICache } from './cache';

export class IMQCache {

    private static adapters: { [name: string]: ICache } = {};

    public static register(adapter: ICache | string) {
        const self = IMQCache;

        if (typeof adapter === 'string') {
            adapter = <ICache>new (require(
                `${__dirname}/cache/${adapter}.js`
            )[adapter])();
        }

        if (!self.adapters[adapter.name]) {
            self.adapters[adapter.name] = adapter;
        }
    }

    public static async init() {
        const self = IMQCache;
        const promises: any[] = [];

        for (let name of Object.keys(self.adapters)) {
            promises.push(self.adapters[name].init());
        }

        return await Promise.all(promises);
    }

    public static get(name: string): ICache {
        return IMQCache.adapters[name];
    }

}
