# I Message Queue RPC (imq-rpc)

RPC-like client-service implementation over messaging queue. This module
provides base set of abstract classes and decorators to build services and 
clients for them.

## Installation

~~~bash
npm i --save imq-rpc
~~~

## Usage

For next examples it is expected redis server is running on `localhost:6379`.

### 1. Building Service

When building service doc-blocks for exposed service methods are mandatory.
First of all it guarantees good level of documentation. From other hand
it provides better types information for building service clients and complex
types usages.

File `service.ts`:

~~~typescript
import { IMQService, expose } from 'imq-rpc';

class Hello extends IMQService {

    /**
     * Says hello using given name
     *
     * @param {string} [name] - name to use withing hello message
     * @returns {string} - hello string
     */
    @expose()
    public async hello(name?: string): Promise<string> {
        return `Hello, ${name}!`;
    }

}

(async () => {
    const service = new Hello();
    await service.start();
})();
~~~

### 2. Building Client

File: `client.ts`:

~~~typescript
import { IMQClient, remote } from 'imq-rpc';

class HelloClient extends IMQClient {

    @remote()
    public async hello(name?: string): Promise<string> {
        return await this.remoteCall<string>(...arguments);
    }

}

(async () => {
    try {
        const client = new HelloClient();
        await client.start();

        // client is now ready for use

        console.log(await client.hello('IMQ'));
    }

    catch (err) {
        console.error(err);
    }
})();
~~~

## Notes

For image containers builds assign machine UUID in `/etc/machine-id` and 
`/var/lib/dbus/machine-id` respectively. UUID should be assigned once on
a first build then re-used each ne build to make it work consistently.

## License

[ISC](https://github.com/imqueue/imq-rpc/blob/master/LICENSE)
