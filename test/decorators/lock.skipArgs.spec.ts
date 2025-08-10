import '../mocks';
import { expect } from 'chai';
import { lock } from '../..';

class SkipArgsClass {
    public calls: number = 0;

    @lock({ skipArgs: [1] })
    public async sum(a: number, b: number) {
        this.calls++;
        // delay to ensure overlapping calls and proper lock queuing
        await new Promise(res => setTimeout(res, 20));
        return a + (b || 0);
    }
}

describe('decorators/lock() with skipArgs', () => {
    beforeEach(() => {
        // Ensure locks are enabled for this test regardless of other tests
        delete process.env['DISABLE_LOCKS'];
    });

    it('should ignore specified args when building lock signature', async () => {
        const obj = new SkipArgsClass();
        const results = await Promise.all([
            obj.sum(1, 10),
            obj.sum(1, 20),
            obj.sum(1, 30),
        ]);
        // Since b (index 1) is skipped in signature, all concurrent calls share one lock
        const uniq = [...new Set(results)];
        expect(uniq.length).to.equal(1);
        // Original method body should be executed only once
        expect(obj.calls).to.equal(1);
    });
});
