// Small DOM helpers shared by the pages.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MAX_SHOWN = 500;

export function renderResult(container, result, { caption } = {}) {
  container.replaceChildren();
  if (!result) return;
  if (result.error) {
    container.append(el('div', { class: 'notice bad', role: 'alert' }, result.error));
    return;
  }
  const { columns, rows } = result;
  const meta = el('p', { class: 'result-meta' },
    `${rows.length} row${rows.length === 1 ? '' : 's'}${rows.length > MAX_SHOWN ? ` — showing the first ${MAX_SHOWN}` : ''}`);
  if (caption) meta.prepend(`${caption}: `);
  if (!columns.length) {
    container.append(el('p', { class: 'result-meta' }, 'No results.'));
    return;
  }
  const table = el('table', { class: 'data' },
    el('thead', {}, el('tr', {}, columns.map(c => el('th', { scope: 'col' }, c)))),
    el('tbody', {}, rows.slice(0, MAX_SHOWN).map(r => el('tr', {}, r.map(cell => {
      if (cell === null || cell === undefined) return el('td', { class: 'null' }, 'empty');
      const isNum = typeof cell === 'number';
      return el('td', { class: isNum ? 'num' : null }, isNum ? formatNumber(cell) : cell);
    })))));
  container.append(meta, el('div', { class: 'results-wrap', tabindex: '0', 'aria-label': 'Query results' }, table));
}

export function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

export function highlightSQL(sql) {
  const kw = /\b(SELECT|FROM|WHERE|GROUP|ORDER|BY|LIMIT|AND|OR|NOT|LIKE|ASC|DESC|DISTINCT|AS|JOIN|ON|HAVING|IN|IS|NULL|BETWEEN|TRUE|FALSE)\b/gi;
  const fn = /\b(COUNT|MIN|MAX|AVG|SUM)\b/gi;
  let out = '';
  const re = /('(?:[^']|'')*'?)|(-?\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|([\s\S])/g;
  let m;
  while ((m = re.exec(sql))) {
    if (m[1] !== undefined) out += `<span class="s">${escapeHtml(m[1])}</span>`;
    else if (m[2] !== undefined) out += `<span class="n">${m[2]}</span>`;
    else if (m[3] !== undefined) {
      kw.lastIndex = 0; fn.lastIndex = 0;
      if (fn.test(m[3])) out += `<span class="f">${m[3]}</span>`;
      else if (kw.test(m[3])) out += `<span class="k">${m[3]}</span>`;
      else out += escapeHtml(m[3]);
    } else out += escapeHtml(m[4]);
  }
  return out;
}

export function params() { return new URLSearchParams(location.search); }

export function topbar(current) {
  const link = (href, label, id) => el('a', { href, 'aria-current': current === id ? 'page' : null }, label);
  return el('header', { class: 'topbar' },
    el('a', { class: 'brand', href: 'index.html' }, el('span', { class: 'brand-mark' }, 'SELECT'), 'Data Detective'),
    el('span', { class: 'spacer' }),
    el('nav', { 'aria-label': 'Main' }, link('index.html', 'Quests', 'home'), link('mydata.html', 'My data', 'mydata')));
}

export function fatal(container, message) {
  container.replaceChildren(el('div', { class: 'panel' },
    el('h2', {}, 'Something stopped the page loading'),
    el('p', {}, message),
    el('button', { class: 'btn', onclick: () => location.reload() }, 'Try again')));
}
