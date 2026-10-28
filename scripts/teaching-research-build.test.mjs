import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT_DIR, 'data');

test('research-index.json has valid structure and 1,051 topic IDs', () => {
  const indexPath = resolve(DATA_DIR, 'research-index.json');
  assert.ok(existsSync(indexPath), 'data/research-index.json must exist');

  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  assert.equal(index.version, 'v1');
  assert.equal(index.recordCount, 1051);
  assert.equal(Array.isArray(index.topicIds), true);
  assert.equal(index.topicIds.length, 1051);
});

test('per-topic research JSON files exist and have required fields', () => {
  const indexPath = resolve(DATA_DIR, 'research-index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));

  // Test sample of records
  const sampleIds = [index.topicIds[0], index.topicIds[500], index.topicIds[1050]];
  for (const id of sampleIds) {
    const filePath = resolve(DATA_DIR, 'research', `${id}.json`);
    assert.ok(existsSync(filePath), `data/research/${id}.json must exist`);

    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(data.topicId, id);
    assert.equal(typeof data.summary, 'string');
    assert.equal(Array.isArray(data.misconceptions), true);
    assert.equal(Array.isArray(data.activities), true);
  }
});
