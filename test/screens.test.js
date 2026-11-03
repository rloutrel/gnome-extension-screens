import {test} from 'node:test';
import {strict as assert} from 'node:assert';

import {toScreenDescriptors, formatScreenLabel} from '../screens@rloutrel.github.com/screens.js';

const identity = s => s;

test('toScreenDescriptors maps geometries and marks the primary screen', () => {
    const screens = toScreenDescriptors([
        {x: 0, y: 0, width: 1920, height: 1080},
        {x: 1920, y: 0, width: 2560, height: 1440},
    ], 1);

    assert.equal(screens.length, 2);
    assert.deepEqual(screens[0],
        {index: 0, isPrimary: false, x: 0, y: 0, width: 1920, height: 1080});
    assert.deepEqual(screens[1],
        {index: 1, isPrimary: true, x: 1920, y: 0, width: 2560, height: 1440});
});

test('formatScreenLabel includes resolution and position when enabled', () => {
    const screen = {index: 0, isPrimary: true, x: 0, y: 0, width: 1920, height: 1080};
    assert.equal(formatScreenLabel(screen, true, identity),
        'Display 1 (primary) — 1920×1080 @ 0,0');
});

test('formatScreenLabel omits resolution when disabled', () => {
    const screen = {index: 1, isPrimary: false, x: 1920, y: 0, width: 2560, height: 1440};
    assert.equal(formatScreenLabel(screen, false, identity), 'Display 2');
});
