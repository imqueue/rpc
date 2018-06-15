# I Message Queue RPC (@imqueue/rpc)

[![Build Status](https://travis-ci.org/imqueue/rpc.svg?branch=master)](https://travis-ci.org/imqueue/rpc)
[![codebeat badge](https://codebeat.co/badges/77983b75-d869-4ba5-9526-5f1dea6f7294)](https://codebeat.co/projects/github-com-imqueue-rpc-master)
[![Coverage Status](https://coveralls.io/repos/github/imqueue/rpc/badge.svg?branch=master)](https://coveralls.io/github/imqueue/rpc?branch=master)
[![David](https://img.shields.io/david/imqueue/rpc.svg)](https://david-dm.org/imqueue/rpc)
[![David](https://img.shields.io/david/dev/imqueue/rpc.svg)](https://david-dm.org/imqueue/rpc?type=dev)
[![Known Vulnerabilities](https://snyk.io/test/github/imqueue/rpc/badge.svg?targetFile=package.json)](https://snyk.io/test/github/imqueue/rpc?targetFile=package.json)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](https://rawgit.com/imqueue/rpc/master/LICENSE)

RPC-like client-service implementation over messaging queue. This module
provides base set of abstract classes and decorators to build services and 
clients for them.

## Why?

To provide fast and reliable way of communication between backend services.

IMQ-RPC provides a simple and reliable solution, using which developer can focus
exactly on business logic implementation and be assured the services 
inter-communication is handled properly, performs fast and is scalable enough
to handle any load.

## Installation

~~~bash
npm i --save @imqueue/rpc
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
import { IMQService, expose } from '@imqueue/rpc';

class Hello extends IMQService {

    /**
     * Says hello using given name
     *
     * @param {string} [name] - name to use withing hello message
     * @returns {string} - hello string
     */
    @expose()
    public hello(name?: string): string {
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
import { IMQClient, IMQDelay, remote } from '@imqueue/rpc';

class HelloClient extends IMQClient {

    /**
     * Says hello using given name
     *
     * @param {string} name
     * @returns {Promise<string>}
     */
    @remote()
    public async hello(name?: string, delay?: IMQDelay): Promise<string> {
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
import { IMQClient } from '@imqueue/rpc';

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
import { IMQClient } from '@imqueue/rpc';

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
a first build then re-used each new build to make it work consistently.

## License

[ISC](https://github.com/imqueue/rpc/blob/master/LICENSE)
