// "About this data": a plain-English description of a live data set.
// about = { summary, from, updated, rows, columns: { name: meaning }, note }
import { el } from './ui.js';

export function renderAbout(about, credit, { open = true, panel = false } = {}) {
  const facts = [
    ['Where it comes from', about.from],
    ['How often it changes', about.updated],
    ['Each row is', about.rows],
  ].filter(([, v]) => v);
  return el('details', { class: `about-data${panel ? ' panel' : ''}`, open: open ? true : null },
    el('summary', {}, el('h3', {}, 'About this data')),
    el('p', { class: 'about-summary' }, about.summary),
    el('dl', { class: 'about-facts' }, facts.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
    about.columns ? el('div', {},
      el('h4', {}, 'What the columns mean'),
      el('dl', { class: 'about-columns' }, Object.entries(about.columns).flatMap(([name, meaning]) => [
        el('dt', {}, el('code', {}, name)), el('dd', {}, meaning)]))) : null,
    about.note ? el('p', { class: 'about-note' }, about.note) : null,
    credit ? el('p', { class: 'credit' }, credit) : null);
}
