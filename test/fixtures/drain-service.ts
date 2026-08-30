/*!
 * Drain end-to-end fixture: a service with one slow handler, driven by a real
 * process signal.
 *
 * Run as a child process by `test/IMQService.drain.spec.ts`. Configuration
 * arrives through the environment so one fixture covers every mode:
 *
 * | variable            | meaning                                        |
 * |---------------------|------------------------------------------------|
 * | `IMQ_DRAIN_ENABLE`  | the feature flag under test                    |
 * | `IMQ_DRAIN_TIMEOUT` | the drain budget                               |
 * | `HANDLER_MS`        | how long the handler takes                     |
 * | `HANDLER_THROWS`    | `1` to make the handler reject                 |
 * | `SIGNAL_AFTER_MS`   | when to signal ourselves after dispatch starts |
 * | `SECOND_SIGNAL_MS`  | delay of a second signal, `0` for none         |
 *
 * Progress is reported on stdout, one JSON object per line, which the spec
 * parses. Nothing here talks to a real Redis: the child is started with the
 * same `test/warmup.mjs` module mocks the in-process specs use.
 */
import '../mocks/index.js';
import { IMQService, expose } from '../../index.js';
import { logger } from '../mocks/index.js';

const HANDLER_MS = Number(process.env.HANDLER_MS || 300);
const HANDLER_THROWS = process.env.HANDLER_THROWS === '1';
const SIGNAL_AFTER_MS = Number(process.env.SIGNAL_AFTER_MS || 50);
const SECOND_SIGNAL_MS = Number(process.env.SECOND_SIGNAL_MS || 0);

/**
 * Emits one progress line on stdout.
 *
 * @param {string} event - event name
 * @param {Record<string, unknown>} extra - additional fields
 */
function report(event: string, extra: Record<string, unknown> = {}): void {
    process.stdout.write(
        `${JSON.stringify({ event, at: Date.now(), ...extra })}\n`,
    );
}

class DrainFixtureService extends IMQService {
    /**
     * Sleeps, then answers — or rejects, to prove a failing handler neither
     * stalls a drain nor produces an unhandled rejection.
     *
     * @param {number} ms - milliseconds to sleep
     * @return {Promise<string>}
     */
    @expose()
    public async slow(ms: number): Promise<string> {
        report('handler:start');

        await new Promise(resolve => setTimeout(resolve, ms));

        report('handler:end');

        if (HANDLER_THROWS) {
            throw new Error('handler failed on purpose');
        }

        return 'done';
    }
}

const service: any = new DrainFixtureService({ logger });

await service.start();

// The reply travels back over the writer connection, which `stop()` must leave
// alive — observing it is how the spec proves the reply really was published.
const send = service.imq.send.bind(service.imq);

service.imq.send = async (...args: any[]): Promise<string> => {
    report('reply:sent');

    return send(...args);
};

// Dispatch through the very path a real message takes — the queue's 'message'
// listener, which is where in-flight tracking lives.
service.imq.emit(
    'message',
    { from: 'DrainFixtureCaller', method: 'slow', args: [HANDLER_MS] },
    'fixture-message-id',
);

setTimeout(() => {
    report('signal:sent');
    process.kill(process.pid, 'SIGTERM');

    if (SECOND_SIGNAL_MS > 0) {
        setTimeout(() => {
            report('signal:sent', { second: true });
            process.kill(process.pid, 'SIGTERM');
        }, SECOND_SIGNAL_MS);
    }
}, SIGNAL_AFTER_MS);

// Keep the loop alive independently of the queue, so the process never exits
// for a reason other than the one under test.
setInterval(() => undefined, 1000);
