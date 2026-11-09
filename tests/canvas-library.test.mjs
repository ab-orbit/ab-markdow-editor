import { test } from 'node:test';
import assert from 'node:assert/strict';
import { libraryItemType, sortedCanvasLibrary, nextLibraryRecents, recentLibraryItems, LIBRARY_TYPES } from '../src/lib/markdown/canvasLibrary.ts';

const item = (id, types = ['rectangle']) => ({ id, status: 'unpublished', created: 1, elements: types.map(type => ({ type, isDeleted: false })) });

test('canvas collections have known types and imported symbols use their live elements', () => {
  for (const [id, type] of [
    ['scriba:youritjang/software-architecture:0', 'architecture'],
    ['scriba:rohanp/system-design:1', 'architecture'],
    ['scriba:dbssticky/data-viz:1', 'charts'],
    ['scriba:intradeus/algorithms-and-data-structures-arrays-matrices-trees:1', 'algorithms'],
    ['scriba:ferminrp/awesome-icons:1', 'icons'],
    ['scriba:xxxdeveloper/icons:1', 'icons'],
    ['scriba:ferminrp/post-it:1', 'notes'],
  ]) assert.equal(libraryItemType(item(id)), type);
  for (const [types, type] of [[['image', 'rectangle'], 'images'], [['text'], 'text'], [['freedraw'], 'freehand'], [['rectangle', 'arrow'], 'diagrams'], [['line'], 'diagrams'], [['rectangle', 'text'], 'shapes']]) assert.equal(libraryItemType(item('imported', types)), type);
  assert.equal(libraryItemType({ ...item('deleted'), elements: [{ type: 'arrow', isDeleted: true }, { type: 'text', isDeleted: false }] }), 'text');
});

test('canvas sorting preserves item data and relative order inside each type', () => {
  const items = [item('shape-1'), item('icon'), item('text', ['text']), item('shape-2'), item('scriba:rohanp/system-design:2')];
  const result = sortedCanvasLibrary(items);
  assert.deepEqual(result.map(entry => entry.id), ['scriba:rohanp/system-design:2', 'text', 'shape-1', 'icon', 'shape-2']);
  for (const entry of result) assert.equal(entry, items.find(original => original.id === entry.id));
  assert.deepEqual(sortedCanvasLibrary(result), result);
  assert.deepEqual(result.map(libraryItemType).map(type => LIBRARY_TYPES.indexOf(type)), [0, 7, 9, 9, 9]);
});

test('the recent library contains eleven distinct symbols and repeated use moves a symbol to the top', () => {
  const ids = Array.from({ length: 15 }, (_, index) => `symbol-${index}`);
  const recent = nextLibraryRecents(ids, ['symbol-12', 'symbol-12', 'new-symbol']);
  assert.equal(recent.length, 11);
  assert.equal(new Set(recent).size, 11);
  assert.deepEqual(recent.slice(0, 4), ['symbol-12', 'new-symbol', 'symbol-0', 'symbol-1']);
  assert.deepEqual(nextLibraryRecents({ corrupted: true }, ['a']), ['a']);
  assert.deepEqual(nextLibraryRecents([null, 1, '', 'a', 'a'], ['b']), ['b', 'a']);
});

test('recent symbols reference current items and deleted symbols never reappear', () => {
  const items = [item('a'), item('b')];
  assert.deepEqual(recentLibraryItems(items, ['deleted', 'b', 'a', 'b']), [items[1], items[0]]);
  assert.deepEqual(recentLibraryItems([], ['a']), []);
});
