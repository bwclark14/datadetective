// The end-of-quest results: what a pupil answered, how many tries and hints each question took.

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Question prompts are HTML; the card needs plain text. */
export function plainText(html) {
  return String(html)
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m])
    .replace(/\s+/g, ' ')
    .trim();
}

/** One-line SQL for the card: collapse the line breaks Blocks mode adds. */
export function tidySQL(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim();
}

/**
 * @param quest     the quest module
 * @param run       from startQuest
 * @param progress  [{ hints, attempts, answer, stars, solved }] per question
 * @param opts      { name, date }
 */
export function buildSummary(quest, run, progress, { name = '', date = new Date() } = {}) {
  const questions = run.questions.map((q, i) => ({
    number: i + 1,
    prompt: plainText(q.prompt),
    answer: tidySQL(progress[i].answer),
    attempts: progress[i].attempts,
    hints: progress[i].hints,
    stars: progress[i].stars,
  }));
  return {
    questTitle: quest.title,
    level: quest.level,
    code: run.code,
    name: String(name || '').trim().slice(0, 40),
    date: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    stars: questions.reduce((s, q) => s + q.stars, 0),
    maxStars: questions.length * 3,
    attempts: questions.reduce((s, q) => s + q.attempts, 0),
    hints: questions.reduce((s, q) => s + q.hints, 0),
    questions,
  };
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Plain-text version for copying into Teams, email or a jotter. */
export function summaryText(s) {
  const lines = [
    `Data Detective: ${s.questTitle} (level ${s.level})`,
    s.name ? `Completed by ${s.name}` : null,
    `${s.date}. Case code ${s.code}`,
    `${s.stars} of ${s.maxStars} stars, ${plural(s.attempts, 'attempt')}, ${plural(s.hints, 'hint')}`,
    '',
    ...s.questions.flatMap(q => [
      `${q.number}. ${q.prompt}`,
      `   ${q.answer}`,
      `   ${plural(q.attempts, 'attempt')}, ${plural(q.hints, 'hint')}`,
    ]),
  ];
  return lines.filter(l => l !== null).join('\n');
}
