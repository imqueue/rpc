# I Message Queue RPC (@imqueue/rpc)

[![Build Status](https://img.shields.io/github/actions/workflow/status/imqueue/rpc/build.yml)](https://github.com/imqueue/rpc/actions/workflows/build.yml)
[![npm version](https://img.shields.io/npm/v/@imqueue/rpc)](https://www.npmjs.com/package/@imqueue/rpc)
[![License](https://img.shields.io/badge/license-GPL-blue.svg)](https://github.com/imqueue/rpc/blob/master/LICENSE)

RPC-like client-service implementation over messaging queue. This module
provides base set of abstract classes and decorators to build services and 
clients for them.

**Documentation:** full guides, tutorial and API reference at
[imqueue.org](https://imqueue.org/). Commercial licensing & support for
closed-source products at [imqueue.com](https://imqueue.com/). Related packages:
[@imqueue/core](https://github.com/imqueue/core) (the message queue this builds
on) and [@imqueue/cli](https://github.com/imqueue/cli) (scaffolding & client
generation).

**Using an AI assistant?** Point it at [imqueue.org/llms.txt](https://imqueue.org/llms.txt)
for a machine-readable index of the docs, or see [AGENTS.md](./AGENTS.md). Current
version, licence and Node floor for every package:
[imqueue.org/status.json](https://imqueue.org/status.json).

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

## Complex Types

To expose complex (object) types as service method arguments or return values,
annotate the class with `@classType()` and its fields with `@property()`:

~~~typescript
import { classType, property, expose, IMQService } from '@imqueue/rpc';

@classType()
class Address {
    @property('string')
    country: string;

    @property('string', true)
    zipCode?: string; // optional
}

@classType()
class User {
    @property('string')
    firstName: string;

    @property('Array<Address>', true)
    addresses?: Address[];
}

class UserService extends IMQService {
    /**
     * Persists the given user
     *
     * @param {User} user - user to save
     * @returns {Promise<boolean>}
     */
    @expose()
    public async save(user: User): Promise<boolean> {
        // User and Address are now exposed to generated clients
        return true;
    }
}
~~~

The `@classType()` class decorator is **required** on every class that uses
`@property()` — without it the type will not be registered and will not appear
in generated clients. (Indexed types use `@indexed()`, which registers `@property`
fields as well.)

## Requirements

This package uses **standard (TC39) decorators**. Consuming projects must set,
in their `tsconfig.json`:

~~~json
{
  "compilerOptions": {
    "experimentalDecorators": false,
    "removeComments": false,
    "lib": ["es2023", "esnext.decorators"]
  }
}
~~~

Because standard decorators provide no runtime type reflection (there is no
`emitDecoratorMetadata`), the RPC layer derives argument and return types from
**JSDoc**. Therefore **every exposed method must be documented with JSDoc**
`@param`/`@returns` tags carrying the types (as shown in the examples above),
and `removeComments` must remain `false` so those comments survive compilation.
Undocumented parameters fall back to `any` in generated clients.

## Encrypting the method cache

`RedisCache` opens its own connection to Redis, separate from the queue's, and
it takes the same `tls` option:

```typescript
import { IMQCache, RedisCache } from '@imqueue/rpc';
import { readFileSync } from 'node:fs';

IMQCache.register(RedisCache, {
    prefix: 'my-service',
    tls: { ca: readFileSync('/etc/redis-tls/ca.crt') },
});
```

With `tls` unset the `IMQ_REDIS_TLS*` environment variables are consulted — the
same ones `@imqueue/core` reads — so one setting encrypts a service's queues
and its method cache together. Pass `false` to decline that fallback.

Two things to know about the connection itself. It is opened **once per
process** and shared by every `RedisCache` instance, so the first
initialization decides its transport; a later one asking for something
different is warned rather than silently given what already exists. And `conn`
still lets a service hand the cache a connection it already has — a running
queue's writer, for example — in which case the cache inherits whatever
transport that connection was opened with.

## Graceful shutdown

By default a service signalled mid-request abandons it: the signal handler
starts `destroy()` without awaiting it and force-exits after
`IMQ_SHUTDOWN_TIMEOUT`, so the handler never finishes, no reply is published,
and the caller waits on a promise that never settles.

Opt into draining and `SIGTERM`/`SIGINT` instead stop consuming, wait for the
requests already in flight, then tear down and exit `0`:

~~~bash
IMQ_DRAIN_ENABLE=1
~~~

| variable | option | default | meaning |
|---|---|---|---|
| `IMQ_DRAIN_ENABLE` | `drain` | `0` | run a drain on `SIGTERM`/`SIGINT` |
| `IMQ_DRAIN_TIMEOUT` | `drainTimeout` | `4000` | drain budget, milliseconds |

~~~typescript
const service = new UserService({ drain: true, drainTimeout: 4000 });
~~~

Both are read numerically, like the rest of the `IMQ_*` family — and a
non-numeric value throws at construction rather than silently reading as *off*.
Every `@expose()`d method is tracked automatically; there is nothing to wrap.

The 4000 ms default sits inside the `imq stop` CLI's five-second
`SIGTERM`-to-`SIGKILL` window, which is tighter than Kubernetes'
30-second `terminationGracePeriodSeconds` — raise it for a cluster deployment if
your handlers need longer.

Two things to know. Enabling the drain forces `handleSignals: false` on the
service's queue, because the queue layer's own handler exits without waiting;
and the drain takes over the signal handlers this framework registered — by
exact function reference, so handlers installed by other libraries are
untouched. A second signal during a drain exits immediately.

Delivery remains **at-least-once** either way. A drain narrows the window in
which in-flight work is lost; `SIGKILL`, an OOM kill or a lost node still take
it, so handlers must stay idempotent.

## Notes

For image containers builds assign machine UUID in `/etc/machine-id` and 
`/var/lib/dbus/machine-id` respectively. UUID should be assigned once on
a first build then re-used each new build to make it work consistently.

## License

This project is licensed under the GNU General Public License v3.0.
See the [LICENSE](LICENSE)
