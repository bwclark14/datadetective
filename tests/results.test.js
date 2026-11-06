import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainText, tidySQL, buildSummary, summaryText } from '../js/results.js';
import { QUESTS } from '../js/quests/index.js';
import { startQuest } from '../js/quest-engine.js';
import { makeRunner } from './helpers.js';

test('prompts become plain text', () => {
  assert.equal(plainText('Show the <code class="q-field">name</code> &amp; <em>time</em>  of   visits &lt; 3'), 'Show the name & time of visits < 3');
});

test('SQL is tidied onto one line', () => {
  assert.equal(tidySQL("SELECT *\nFROM visitors\nWHERE room = 'Office'"), "SELECT * FROM visitors WHERE room = 'Office'");
});

test('summary totals attempts, hints and stars', () => {
  const quest = QUESTS[0];
  const run = startQuest(quest, 1234, makeRunner());
  const progress = run.questions.map((q, i) => ({ hints: i === 2 ? 2 : 0, attempts: i === 2 ? 3 : 1, stars: i === 2 ? 1 : 3, answer: q.answer, solved: true }));
  const s = buildSummary(quest, run, progress, { name: '  Ava M  ', date: new Date('2026-11-06T12:00:00Z') });
  assert.equal(s.name, 'Ava M');
  assert.equal(s.date, '6 November 2026');
  assert.equal(s.code, run.code);
  assert.equal(s.attempts, run.questions.length + 2);
  assert.equal(s.hints, 2);
  assert.equal(s.stars, (run.questions.length - 1) * 3 + 1);
  assert.equal(s.maxStars, run.questions.length * 3);
  assert.ok(!s.questions[0].prompt.includes('<'));
  const text = summaryText(s);
  assert.match(text, /Completed by Ava M/);
  assert.match(text, /3 attempts, 2 hints/);
  assert.match(text, /1 attempt, 0 hints/);
});

test('name is optional and limited in length', () => {
  const quest = QUESTS[1];
  const run = startQuest(quest, 5, makeRunner());
  const progress = run.questions.map(q => ({ hints: 0, attempts: 1, stars: 3, answer: q.answer, solved: true }));
  assert.equal(buildSummary(quest, run, progress).name, '');
  assert.ok(!summaryText(buildSummary(quest, run, progress)).includes('Completed by'));
  assert.equal(buildSummary(quest, run, progress, { name: 'x'.repeat(80) }).name.length, 40);
});
