import type { Line } from './db';

export const fmt = (s: number) => {
  s = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const stamp = (t: number) => {
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, '0')}:${(t - m * 60).toFixed(2).padStart(5, '0')}`;
};
const RE = /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/;

// Plain text -> lines. Keeps old timestamps for unchanged lines; understands pasted LRC.
export function parseText(text: string, old: Line[]): Line[] {
  const rows = text.split('\n').map((x) => x.trim()).filter(Boolean);
  if (rows.some((r) => RE.test(r)))
    return rows.map((r) => {
      const m = r.match(RE);
      return m ? { t: +m[1] * 60 + +m[2], text: m[3] } : { t: null, text: r };
    });
  return rows.map((text, i) => ({ text, t: old[i]?.text === text ? old[i].t : null }));
}

export const toLrc = (lines: Line[]) =>
  lines.map((l) => (l.t == null ? l.text : `[${stamp(l.t)}]${l.text}`)).join('\n');
