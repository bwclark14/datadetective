// The results card: shown on screen, and drawn as a picture pupils can save or share.
import { el, highlightSQL } from './ui.js';
import { plural, summaryText } from './results.js';
import { getPref, setPref } from './progress.js';

// ---------- on screen ----------

function cardElement(s) {
  return el('article', { class: 'results-card', 'aria-label': 'Your results card' },
    el('header', { class: 'rc-head' },
      el('span', { class: 'brand-mark' }, 'SELECT'),
      el('span', { class: 'rc-brand' }, 'Data Detective'),
      el('span', { class: 'level-badge' }, `Level ${s.level}`)),
    el('h2', { class: 'rc-title' }, s.questTitle),
    el('p', { class: 'rc-meta' },
      s.name ? el('strong', {}, s.name) : null,
      s.name ? el('br') : null,
      `${s.date}. Case code `, el('code', {}, s.code)),
    el('dl', { class: 'rc-stats' },
      el('div', {}, el('dt', {}, 'Stars'), el('dd', {}, `${s.stars}`, el('span', { class: 'rc-of' }, ` / ${s.maxStars}`))),
      el('div', {}, el('dt', {}, 'Attempts'), el('dd', {}, String(s.attempts))),
      el('div', {}, el('dt', {}, 'Hints used'), el('dd', {}, String(s.hints)))),
    el('ol', { class: 'rc-questions' }, s.questions.map(q => el('li', {},
      el('span', { class: 'rc-num', 'aria-hidden': 'true' }, String(q.number)),
      el('div', { class: 'rc-body' },
        el('p', { class: 'rc-prompt' }, q.prompt),
        el('pre', { class: 'rc-sql', html: highlightSQL(q.answer.replace(/\b(ORDER|GROUP) BY\b/gi, '$1\u00a0BY')) }),
        el('p', { class: 'rc-q-stats' },
          el('span', {}, plural(q.attempts, 'attempt')),
          el('span', {}, plural(q.hints, 'hint')),
          el('span', { class: 'stars', 'aria-label': `${q.stars} of 3 stars` }, '★'.repeat(q.stars), el('span', { class: 'off' }, '★'.repeat(3 - q.stars)))))))));
}

// ---------- as a picture ----------

const C = {
  bg: '#ffffff', ink: '#1b2a38', soft: '#4a5a6b', line: '#cfd8e3', panel: '#f6f8fb',
  tape: '#f2c230', code: '#1b2a38', codeInk: '#e6edf4', kw: '#f2c230', str: '#9be3b3', num: '#ffb38a', fn: '#d3b6ff', star: '#c99a06',
};
const HEAD = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif';
const BODY = '"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';

function wrap(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (ctx.measureText(`${last}…`).width > maxWidth && last.length) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
  }
  return lines;
}

// SQL wraps at spaces, keeping quoted text together where possible.
function wrapCode(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  // Keep two-word keywords together on one line.
  for (const token of text.replace(/\b(ORDER|GROUP) BY\b/gi, '$1\u00a0BY').split(' ')) {
    const test = line ? `${line} ${token}` : token;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = token; }
  }
  if (line) lines.push(line);
  return lines.flatMap(l => {
    if (ctx.measureText(l).width <= maxWidth) return [l];
    const out = [];
    let chunk = '';
    for (const ch of l) {
      if (ctx.measureText(chunk + ch).width > maxWidth) { out.push(chunk); chunk = ch; } else chunk += ch;
    }
    return chunk ? [...out, chunk] : out;
  });
}

function drawSQLLine(ctx, line, x, y) {
  const re = /('(?:[^']|'')*'?)|(-?\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
  const kw = /^(SELECT|FROM|WHERE|GROUP|ORDER|BY|LIMIT|AND|OR|NOT|LIKE|ASC|DESC|DISTINCT|AS|TRUE|FALSE|NULL|IS)$/i;
  const fn = /^(COUNT|MIN|MAX|AVG|SUM)$/i;
  let m, cx = x;
  while ((m = re.exec(line))) {
    const piece = m[0];
    ctx.fillStyle = m[1] ? C.str : m[2] ? C.num : m[3] && fn.test(piece) ? C.fn : m[3] && kw.test(piece) ? C.kw : C.codeInk;
    ctx.fillText(piece, cx, y);
    cx += ctx.measureText(piece).width;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws the card. Runs twice: once to measure the height, once to paint. */
function paint(ctx, s, W, draw) {
  const P = 64, inner = W - P * 2;
  let y = P;
  const text = (str, x, yy, font, color) => { if (draw) { ctx.font = font; ctx.fillStyle = color; ctx.fillText(str, x, yy); } };

  // Brand
  ctx.font = `600 26px ${MONO}`;
  const tapeW = ctx.measureText('SELECT').width + 28;
  if (draw) { ctx.fillStyle = C.tape; roundRect(ctx, P, y, tapeW, 44, 4); ctx.fill(); }
  text('SELECT', P + 14, y + 31, `600 26px ${MONO}`, C.ink);
  text('Data Detective', P + tapeW + 16, y + 32, `800 30px ${HEAD}`, C.ink);
  ctx.font = `600 24px ${MONO}`;
  const lvl = `Level ${s.level}`;
  const lvlW = ctx.measureText(lvl).width + 24;
  if (draw) { ctx.fillStyle = C.tape; roundRect(ctx, W - P - lvlW, y + 4, lvlW, 36, 4); ctx.fill(); }
  text(lvl, W - P - lvlW + 12, y + 30, `600 24px ${MONO}`, C.ink);
  y += 44 + 48;

  // Title and who/when
  ctx.font = `800 60px ${HEAD}`;
  for (const l of wrap(ctx, s.questTitle, inner, 2)) { text(l, P, y + 48, `800 60px ${HEAD}`, C.ink); y += 68; }
  y += 8;
  if (s.name) { text(s.name, P, y + 30, `700 32px ${BODY}`, C.ink); y += 46; }
  text(`${s.date}. Case code ${s.code}`, P, y + 26, `400 26px ${BODY}`, C.soft);
  y += 26 + 36;

  // Totals
  const boxW = (inner - 32) / 3, boxH = 124;
  [['Stars', `${s.stars} / ${s.maxStars}`], ['Attempts', String(s.attempts)], ['Hints used', String(s.hints)]].forEach(([label, value], i) => {
    const x = P + i * (boxW + 16);
    if (draw) { ctx.fillStyle = C.panel; roundRect(ctx, x, y, boxW, boxH, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke(); }
    text(label, x + 22, y + 40, `700 24px ${BODY}`, C.soft);
    text(value, x + 22, y + 98, `800 48px ${HEAD}`, i === 0 ? C.star : C.ink);
  });
  y += boxH + 40;

  // Questions
  const numW = 52, bodyX = P + numW + 18, bodyW = W - P - bodyX;
  for (const q of s.questions) {
    if (draw) {
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(P + numW / 2, y + numW / 2, numW / 2, 0, Math.PI * 2); ctx.fill();
      ctx.font = `700 24px ${BODY}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.fillText(String(q.number), P + numW / 2, y + numW / 2 + 9);
      ctx.textAlign = 'left';
    }
    ctx.font = `400 26px ${BODY}`;
    const promptLines = wrap(ctx, q.prompt, bodyW, 3);
    let qy = y + 4;
    for (const l of promptLines) { text(l, bodyX, qy + 24, `400 26px ${BODY}`, C.ink); qy += 36; }
    qy += 10;
    ctx.font = `500 24px ${MONO}`;
    const codeLines = wrapCode(ctx, q.answer, bodyW - 40);
    const codeH = codeLines.length * 36 + 28;
    if (draw) {
      ctx.fillStyle = C.code; roundRect(ctx, bodyX, qy, bodyW, codeH, 10); ctx.fill();
      ctx.font = `500 24px ${MONO}`;
      codeLines.forEach((l, i) => drawSQLLine(ctx, l, bodyX + 20, qy + 40 + i * 36));
    }
    qy += codeH + 14;
    const stats = `${plural(q.attempts, 'attempt')}    ${plural(q.hints, 'hint')}`;
    text(stats, bodyX, qy + 24, `700 24px ${BODY}`, C.soft);
    if (draw) {
      ctx.font = `400 28px ${BODY}`; ctx.textAlign = 'right';
      ctx.fillStyle = C.star; ctx.fillText('★'.repeat(q.stars), W - P - ctx.measureText('★'.repeat(3 - q.stars)).width, qy + 26);
      ctx.fillStyle = C.line; ctx.fillText('★'.repeat(3 - q.stars), W - P, qy + 26);
      ctx.textAlign = 'left';
    }
    y = qy + 24 + 36;
    if (draw && q !== s.questions[s.questions.length - 1]) { ctx.fillStyle = C.line; ctx.fillRect(bodyX, y - 18, bodyW, 2); }
    y += 12;
  }
  y += 8;
  text('Made with Data Detective', P, y + 20, `400 22px ${BODY}`, C.soft);
  return y + 20 + P;
}

export async function drawCardImage(s, W = 1080) {
  try {
    await Promise.all([
      document.fonts.load(`800 60px "Bricolage Grotesque"`),
      document.fonts.load(`400 26px "Atkinson Hyperlegible"`),
      document.fonts.load(`700 26px "Atkinson Hyperlegible"`),
      document.fonts.load(`500 24px "IBM Plex Mono"`),
      document.fonts.load(`600 24px "IBM Plex Mono"`),
    ]);
  } catch { /* fall back to system fonts */ }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const H = Math.ceil(paint(ctx, s, W, false));
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.tape;
  ctx.fillRect(0, 0, W, 12);
  paint(ctx, s, W, true);
  return canvas;
}

const toBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

export function fileName(s) {
  const who = s.name ? `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-` : '';
  return `data-detective-${who}${s.code.toLowerCase()}.png`;
}

// ---------- the whole section ----------

/** Results card with a name box and Save / Share / Copy buttons. `build(name)` makes the summary. */
export function renderResultsSection(build) {
  let summary = build(getPref('name', ''));
  const status = el('p', { class: 'rc-status', role: 'status' });
  const holder = el('div', {}, cardElement(summary));
  const nameInput = el('input', {
    id: 'rc-name', type: 'text', maxlength: '40', autocomplete: 'off', value: summary.name,
    placeholder: 'e.g. Ava M', 'aria-describedby': 'rc-name-help',
  });
  nameInput.addEventListener('input', () => {
    summary = build(nameInput.value);
    holder.replaceChildren(cardElement(summary));
    setPref('name', summary.name);
  });

  const say = msg => { status.textContent = msg; };

  async function save() {
    say('Making your picture…');
    const blob = await toBlob(await drawCardImage(summary));
    const a = el('a', { href: URL.createObjectURL(blob), download: fileName(summary) });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    say('Saved. Look in your downloads.');
  }

  async function share() {
    try {
      const blob = await toBlob(await drawCardImage(summary));
      const file = new File([blob], fileName(summary), { type: 'image/png' });
      const data = { title: `Data Detective: ${summary.questTitle}`, text: summaryText(summary) };
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ ...data, files: [file] });
      else if (navigator.share) await navigator.share(data);
      else { await copy(); return; }
      say('Shared.');
    } catch (e) {
      if (e?.name !== 'AbortError') say('Sharing didn\'t work here. Try Save picture or Copy as text instead.');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summaryText(summary));
      say('Copied. Paste it into Teams, an email or your notes.');
    } catch {
      say('Copying isn\'t allowed here. Try Save picture instead.');
    }
  }

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  return el('section', { class: 'results-section', 'aria-label': 'Share your results' },
    el('div', { class: 'rc-name' },
      el('label', { for: 'rc-name' }, 'Your name on the card (optional)'),
      nameInput,
      el('p', { class: 'muted', id: 'rc-name-help' }, 'Only shown on your card. It\'s remembered on this device, not sent anywhere.')),
    holder,
    el('div', { class: 'rc-actions' },
      canShare ? el('button', { class: 'btn btn-primary', type: 'button', onclick: share }, 'Share') : null,
      el('button', { class: `btn${canShare ? '' : ' btn-primary'}`, type: 'button', onclick: save }, 'Save picture'),
      el('button', { class: 'btn', type: 'button', onclick: copy }, 'Copy as text')),
    status);
}
