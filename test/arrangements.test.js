import {test} from 'node:test';
import {strict as assert} from 'node:assert';

import {parseArrangements, saveArrangement, removeArrangement, serializeArrangements, toMonitorsXml} from '../screens@rloutrel.github.com/arrangements.js';

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

test('saveArrangement keeps connector and scale for re-applying', () => {
    const withConnector = {...SCREEN, connector: 'DP-1', scale: 2.0};
    const list = saveArrangement([], 'Desk', [withConnector]);
    assert.deepEqual(list[0].screens[0], {
        x: 0, y: 0, isPrimary: true,
        connector: 'DP-1', width: 1920, height: 1080, scale: 2.0,
    });
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

test('toMonitorsXml renders a GDM monitors.xml with spec and mode', () => {
    const screen = {
        x: 0, y: 0, scale: 1, isPrimary: true,
        spec: {connector: 'DP-1', vendor: 'DEL', product: 'DELL U2419H', serial: '7PKXTS2'},
        mode: {width: 1920, height: 1080, rate: 59.997},
    };
    const list = saveArrangement([], 'Desk', [screen]);
    const xml = toMonitorsXml(list[0]);
    assert.match(xml, /^<monitors version="2">/);
    assert.match(xml, /<connector>DP-1<\/connector>/);
    assert.match(xml, /<vendor>DEL<\/vendor>/);
    assert.match(xml, /<primary>yes<\/primary>/);
    assert.match(xml, /<width>1920<\/width>/);
    assert.match(xml, /<rate>59\.997<\/rate>/);
});

test('toMonitorsXml escapes XML special characters and skips spec-less screens', () => {
    const withSpec = {
        x: 0, y: 0, isPrimary: true,
        spec: {connector: 'HDMI-1', vendor: 'A&B', product: '<X>', serial: ''},
        mode: {width: 1280, height: 720, rate: 60},
    };
    const list = saveArrangement([], 'Desk', [SCREEN, withSpec]);
    const xml = toMonitorsXml(list[0]);
    assert.match(xml, /<vendor>A&amp;B<\/vendor>/);
    assert.match(xml, /<product>&lt;X&gt;<\/product>/);
    assert.equal(xml.match(/<logicalmonitor>/g).length, 1); // spec-less screen skipped
    assert.throws(() => toMonitorsXml({name: 'Old', screens: [SCREEN]}));
});
