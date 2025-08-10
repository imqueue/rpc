/*!
 * IMQMetadata Unit Tests
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
import './mocks';
import { expect } from 'chai';
import { IMQMetadata } from '..';

describe('IMQMetadata', () => {
    it('should be a class', () => {
        expect(typeof IMQMetadata).to.equal('function');
    });

    it('should copy provided metadata props to instance index', () => {
        const data = { a: 1, b: 'x', c: { y: true } } as any;
        const m = new IMQMetadata(data);
        // direct property access
        expect((m as any).a).to.equal(1);
        expect((m as any).b).to.equal('x');
        expect((m as any).c).to.deep.equal({ y: true });
        // index signature behavior
        const keys = Object.keys(m);
        expect(keys.sort()).to.deep.equal(['a','b','c']);
    });
});
