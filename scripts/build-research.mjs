#!/usr/bin/env node
/**
 * build-research.mjs
 *
 * Extracts lightweight per-topic research records and a compact index
 * from the 23.5 MB data/teaching-research.json file for web performance.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT_DIR, 'data');
const OUT_DIR = resolve(DATA_DIR, 'research');
const INDEX_FILE = resolve(DATA_DIR, 'research-index.json');

console.log('Loading dataset files...');
const researchRaw = readFileSync(resolve(DATA_DIR, 'teaching-research.json'), 'utf8');
const research = JSON.parse(researchRaw);
const topics = JSON.parse(readFileSync(resolve(DATA_DIR, 'topics.json'), 'utf8'));

const validTopicIds = new Set(topics.topics.map(t => t.id));

if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true, force: true });
}
mkdirSync(OUT_DIR, { recursive: true });

const topicIds = [];
let writtenCount = 0;

for (const record of research.records) {
  if (!validTopicIds.has(record.topicId)) {
    throw new Error(`Record has unknown topicId: ${record.topicId}`);
  }

  topicIds.push(record.topicId);

  const shortRecord = {
    topicId: record.topicId,
    summary: record.learn?.summary || record.pedagogy?.summary || '',
    misconceptions: Array.isArray(record.pedagogy?.commonMisconceptions)
      ? record.pedagogy.commonMisconceptions
      : [],
    activities: Array.isArray(record.learn?.activities)
      ? record.learn.activities.map(a => ({
          title: a.title || 'Activity',
          steps: Array.isArray(a.learnerActions) ? a.learnerActions : [],
          insight: a.intendedInsight || ''
        }))
      : [],
    checkQuestion: record.assess?.diagnosticPrompt || null,
    checkAnswer: record.assess?.correctAnswer || null
  };

  const filePath = resolve(OUT_DIR, `${record.topicId}.json`);
  writeFileSync(filePath, JSON.stringify(shortRecord), 'utf8');
  writtenCount++;
}

const indexData = {
  version: research.version || 'v1',
  recordCount: writtenCount,
  topicIds
};

writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf8');

console.log(`✓ Successfully generated ${writtenCount} per-topic research records in data/research/`);
console.log(`✓ Created index file ${INDEX_FILE} (${(Buffer.byteLength(JSON.stringify(indexData)) / 1024).toFixed(1)} KB)`);
