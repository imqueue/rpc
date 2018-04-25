# I Message Queue RPC (imq-rpc)

[![Build Status](https://travis-ci.org/imqueue/imq-rpc.svg?branch=master)](https://travis-ci.org/imqueue/imq-rpc) [![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://rawgit.com/imqueue/imq-rpc/master/LICENSE)

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

There are 3 ways of building service clients:

  1. **Writing/updating clients manually.**
     In this case you will be fully responsible for maintaining clients
     code but will have an ability to extend client code as you wish.
  1. **Generating/updating clients automatically using IMQClient.create() 
     at runtime.**
     This will give an ability do not care about the need to keep client
     code up-to-date with the service changes. Each time client started it
     will re-generate its interface and will reflect all changes made on
     service side. BTW, this method has disadvantages in code development
     and maintenance (especially from TypeScript usage perspective) which
     are directly related to dynamic module creation, compilation and loading.
     There will be problems using service complex types interfaces in 
     TypeScript. From perspective of JavaScript usage it is OK.
  1. **Generating/updating pre-compiled clients automatically using 
     IMQClient.create()**
     This will require additional actions on client side to update its codebase
     each time the service changed its interfaces. BTW it gives an advantage
     of full support of all typing features on TypeScript side and provides
     automated way to manage clients up-to-date state.

File: `client.ts` (manually written client example):

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

Using dynamically built clients (for the same service described above):

~~~typescript
import { IMQClient } from 'imq-rpc';

(async () => {
    try {
        const hello: any = await IMQClient.create('Hello');
        const client = new hello.HelloClient();

        await client.start();

        console.log(await client.hello('IMQ'));

        await client.destroy();
    }

    catch (err) {
        console.error(err);
    }
})();
~~~

In this case above, `IMQClient.create()` will automatically generate client
code, compiles it to JS, loads and returns compiled module. As far as it 
happens at runtime there is no possibility to refer type information
properly, but there is no need to take care if the client up-to-date with
the service code base. Each time client created it will be re-generated.

BTW, `IMQClient.create()` supports a source code generation without a module
loading as well: 

~~~typescript
import { IMQClient } from 'imq-rpc';

(async () => {
    await IMQClient.create('Hello', {
        path: './clients',
        compile: false
    });
})();
~~~

In this case client code will be generated and written to a corresponding
file `./clients/Hello.ts` under specified path. Then it can be compiled and
imported within your project build process, and referred in your code
as expected:

~~~typescript
import { hello } from './clients/Hello';

(async () => {
    const client = new hello.HelloClient();
    await client.start();
    console.log(client.hello('IMQ'));
})();
~~~

In this case all complex types defined within service implementation
will be available under imported namespace of the client.

## Notes

For image containers builds assign machine UUID in `/etc/machine-id` and 
`/var/lib/dbus/machine-id` respectively. UUID should be assigned once on
a first build then re-used each ne build to make it work consistently.

## License

[ISC](https://github.com/imqueue/imq-rpc/blob/master/LICENSE)
