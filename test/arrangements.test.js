import {test} from 'node:test';
import {strict as assert} from 'node:assert';

import {parseArrangements, saveArrangement, removeArrangement, serializeArrangements} from '../screens@rloutrel.github.com/arrangements.js';

const SCREEN = {index: 0, isPrimary: true, x: 0, y: 0, width: 1920, height: 1080};

test('parseArrangements returns [] for invalid JSON', () => {
    assert.deepEqual(parseArrangements('not json'), []);
    assert.deepEqual(parseArrangements('{"a":1}'), []);
    assert.deepEqual(parseArrangements(''), []);
});

test('parseArrangements drops invalid entries and keeps valid ones', () => {
    const json = JSON.stringify([
        {name: 'Desk', screens: [{x: 0, y: 0, width: 1920, height: 1080, isPrimary: true}]},
        {name: '', screens: []},
        {screens: []},
        {name: 'Broken', screens: [{x: 0, y: 0, width: -1, height: 1080}]},
    ]);
    const parsed = parseArrangements(json);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].name, 'Desk');
});

test('saveArrangement adds a new named arrangement', () => {
    const list = saveArrangement([], 'Desk', [SCREEN]);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, 'Desk');
    assert.deepEqual(list[0].screens,
        [{x: 0, y: 0, width: 1920, height: 1080, isPrimary: true}]);
});

test('saveArrangement replaces an existing arrangement with the same name', () => {
    const other = {index: 1, isPrimary: false, x: 1920, y: 0, width: 2560, height: 1440};
    let list = saveArrangement([], 'Desk', [SCREEN]);
    list = saveArrangement(list, 'Desk', [SCREEN, other]);
    assert.equal(list.length, 1);
    assert.equal(list[0].screens.length, 2);
});

test('saveArrangement rejects empty names and invalid geometry', () => {
    assert.throws(() => saveArrangement([], '   ', [SCREEN]));
    assert.throws(() => saveArrangement([], 'Desk', [{x: 0, y: 0, width: 0, height: 1080}]));
});

test('removeArrangement deletes by name only', () => {
    let list = saveArrangement([], 'Desk', [SCREEN]);
    list = saveArrangement(list, 'External', [SCREEN]);
    list = removeArrangement(list, 'Desk');
    assert.deepEqual(list.map(a => a.name), ['External']);
});

test('serialize/parse round-trips', () => {
    const list = saveArrangement([], 'Desk', [SCREEN]);
    assert.deepEqual(parseArrangements(serializeArrangements(list)), list);
});
