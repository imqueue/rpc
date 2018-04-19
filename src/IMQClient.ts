/*!
 * IMQClient implementation
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
import IMQ, {
    IMessageQueue,
    IMQOptions,
    DEFAULT_IMQ_OPTIONS,
    ILogger
} from 'imq';
import { IMQServiceOptions, pid } from '.';

export abstract class IMQClient {

    public options: IMQOptions = DEFAULT_IMQ_OPTIONS;
    private imq: IMessageQueue;
    private name: string;
    private serviceName: string;
    private logger: ILogger;

    public constructor(options?: Partial<IMQOptions>) {
        if (this.constructor.name === 'IMQClient') {
            throw new TypeError('IMQClient class is abstract and can not' +
                'be instantiated directly!');
        }

        if (options) {
            this.options = Object.assign(this.options, options);
        }

        this.logger = this.options.logger || console;

        this.name = `${this.constructor.name}-${pid(this.constructor.name)}`;
        this.serviceName = this.constructor.name.replace(/Client$/, '');
        this.imq = IMQ.create(this.name, this.options);
    }

    protected async sendRequest<T>(...args: any[]): Promise<T> {
        return new Promise<T>((resolve, reject) => {

        });
    }

    public async start() {

    }

    public async stop() {

    }

    public async destroy() {

    }

}
