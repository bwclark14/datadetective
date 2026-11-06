// Stars per quest, kept in this browser only. Works (without saving) if storage is blocked.
const KEY = 'dd.progress.v1';

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
}

export function getProgress(questId) {
  return read()[questId] || { best: 0, completed: 0 };
}

export function recordFinish(questId, stars, maxStars) {
  const data = read();
  const prev = data[questId] || { best: 0, completed: 0 };
  data[questId] = { best: Math.max(prev.best, stars), max: maxStars, completed: prev.completed + 1 };
  write(data);
  return data[questId];
}

export function getPref(name, fallback) {
  try { return localStorage.getItem(`dd.pref.${name}`) ?? fallback; } catch { return fallback; }
}
export function setPref(name, value) {
  try { localStorage.setItem(`dd.pref.${name}`, value); } catch { /* ignore */ }
}
