// Studio reel frame renderer (voiceless, beat-synced). window.frame(t) draws a 1080x1920 SVG.
// CFG = {tag, subject, bpm, scenes:[{kind,t0,t1,...}], total, drop, fps}
const W = 1080, H = 1920;
const B = 60 / (CFG.bpm || 120);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const outE = x => { x = clamp(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
const back = x => { x = clamp(x); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rnd = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const COL = { bg: '#070B14', orange: '#FF7A1A', cream: '#FFF4E6', teal: '#22D3EE', green: '#22C55E', red: '#EF4444', dim: '#8693AE', gold: '#F5C542', violet: '#A78BFA' };
const ACC = [COL.orange, COL.teal, COL.violet, COL.gold];
const EV = new Map();
function ev(type, t) { EV.set(type + '@' + t.toFixed(3), { type, t }); }
window.events = () => [...EV.values()].sort((a, b) => a.t - b.t);

const cv = document.createElement('canvas').getContext('2d');
const tw = (s, size, wt = 700) => { cv.font = `${wt} ${size}px Sans`; return cv.measureText(s).width; };
let DEFS = [], UID = 0, CUR = { t0: 0, lt: 0 };

function parseWords(text) {
  let on = false; const out = [];
  for (const raw of String(text).split(/\s+/).filter(Boolean)) {
    const st = raw.startsWith('*'), en = raw.endsWith('*') && raw.length > 1;
    if (st) on = true;
    out.push({ w: raw.replace(/\*/g, ''), hl: on });
    if (en) on = false;
  }
  return out;
}
function layout(text, size, maxW, wt = 700) {
  const sp = tw(' ', size, wt), lines = []; let cur = [], w = 0;
  for (const o of parseWords(text)) {
    const ww = tw(o.w, size, wt);
    if (cur.length && w + sp + ww > maxW) { lines.push({ ws: cur, w }); cur = []; w = 0; }
    w += (cur.length ? sp : 0) + ww; cur.push({ ...o, ww });
  }
  if (cur.length) lines.push({ ws: cur, w });
  return { lines, sp };
}
function T(txt, x, y, size, o = {}) {
  const { wt = 700, fill = COL.cream, anchor = 'middle', ls = 0, op = 1, tr = '' } = o;
  return `<text x="${x}" y="${y}" font-family="Sans, Noto Color Emoji" font-size="${size}" font-weight="${wt}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}"${tr ? ` transform="${tr}"` : ''}>${esc(txt)}</text>`;
}
// kinetic text: masked word-by-word rise, optional highlight underline
function block(text, o) {
  const { cx = W / 2, y, size, maxW = 920, wt = 700, lead = 1.2, start = 0, stag = .1, dur = .5, fill = COL.cream, hl = COL.orange, every = 1, evType = 'pop', ul = true } = o;
  const L = layout(text, size, maxW, wt); let s = '', k = 0;
  L.lines.forEach((ln, li) => {
    const by = y + li * size * lead; let x = cx - ln.w / 2;
    ln.ws.forEach(wd => {
      const st = start + k * stag, p = clamp((CUR.lt - st) / dur);
      if (k % every === 0) ev(evType, CUR.t0 + st);
      if (p > 0) {
        const id = 'cw' + (UID++);
        DEFS.push(`<clipPath id="${id}"><rect x="${x - 14}" y="${by - size * 1.02}" width="${wd.ww + 28}" height="${size * 1.42}"/></clipPath>`);
        const ty = (1 - back(p)) * size * 1.05;
        s += `<g clip-path="url(#${id})">${T(wd.w, x, by + ty, size, { wt, fill: wd.hl ? hl : fill, anchor: 'start' })}</g>`;
        if (wd.hl && ul) { const up = ease((CUR.lt - st - .25) / .4); s += `<rect x="${x}" y="${by + size * .14}" width="${wd.ww * up}" height="${Math.max(5, size * .08)}" rx="3" fill="${hl}"/>`; }
      }
      x += wd.ww + L.sp; k++;
    });
  });
  return { svg: s, h: L.lines.length * size * lead, lines: L.lines.length };
}
function fitSize(text, maxSize, minSize, maxW, maxLines, wt = 700) {
  let size = maxSize;
  for (; size > minSize; size -= 2) if (layout(text, size, maxW, wt).lines.length <= maxLines) break;
  return size;
}
function card(x, y, w, h, letter, text, o = {}) {
  const { win = false, alpha = 1, sc = 1, dx = 0, chk = 0, accent = COL.orange } = o;
  let size = 46, lines;
  for (; size >= 30; size -= 2) { lines = layout(text, size, w - 200, 600).lines; if (lines.length === 1 || size <= 34) break; }
  const lh = size * 1.15, y0 = y + h / 2 - (lines.length - 1) * lh / 2 + size * .35;
  let s = `<g opacity="${alpha}" transform="translate(${x + w / 2 + dx},${y + h / 2}) scale(${sc}) translate(${-(x + w / 2)},${-(y + h / 2)})">`;
  if (win) s += `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" rx="34" fill="none" stroke="${COL.green}" stroke-width="3" opacity=".35"/>`;
  s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${win ? 'rgba(34,197,94,.16)' : 'rgba(255,255,255,.06)'}" stroke="${win ? COL.green : 'rgba(255,255,255,.26)'}" stroke-width="${win ? 6 : 3}"/>`;
  s += `<circle cx="${x + 62}" cy="${y + h / 2}" r="34" fill="${win ? COL.green : 'rgba(255,255,255,.14)'}"/>` + T(letter, x + 62, y + h / 2 + 13, 38, { fill: win ? '#04210F' : COL.cream });
  lines.forEach((ln, i) => { s += T(ln.ws.map(a => a.w).join(' '), x + 124, y0 + i * lh, size, { wt: 600, anchor: 'start', fill: COL.cream }); });
  if (chk > 0) {
    const cx = x + w - 62, cy = y + h / 2;
    s += `<circle cx="${cx}" cy="${cy}" r="${34 * back(chk)}" fill="${COL.green}"/><path d="M ${cx - 16} ${cy + 1} L ${cx - 4} ${cy + 14} L ${cx + 18} ${cy - 12}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1 - clamp((chk - .4) / .6)}" fill="none" stroke="#04210F" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return s + '</g>';
}
function pill(x, y, w, h, txt, size, fill, tcol, sc = 1, op = 1) {
  return `<g opacity="${op}" transform="translate(${x},${y}) scale(${sc})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}"/>${T(txt, 0, size * .35, size, { fill: tcol })}</g>`;
}
function chips(sc, lt, acc) {
  if (!sc.chips) return '';
  const size = 30, gap = 18, ws = sc.chips.map(c => tw(c.length > 15 ? c.slice(0, 14) + '…' : c, size, 600) + 48);
  let x = W / 2 - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1)) / 2, s = '';
  sc.chips.forEach((c, i) => {
    const t = c.length > 15 ? c.slice(0, 14) + '…' : c, on = i === sc.focus, past = i < sc.focus;
    const p = outE((lt - .02 * i) / .4);
    s += `<g opacity="${(on ? 1 : past ? .38 : .6) * p}"><rect x="${x}" y="262" width="${ws[i]}" height="64" rx="32" fill="${on ? acc : 'rgba(255,255,255,.07)'}" stroke="${on ? acc : 'rgba(255,255,255,.3)'}" stroke-width="2.5"/>${T(t, x + ws[i] / 2, 303, size, { wt: 600, fill: on ? '#0A0F1C' : COL.cream })}</g>`;
    x += ws[i] + gap;
  });
  return s;
}

// ---------- backgrounds, camera, hud ----------
const accentOf = sc => sc.accent || (sc.kind === 'point' ? ACC[(sc.focus || 0) % 4] : sc.kind === 'answer' ? COL.green : sc.kind === 'rewind' ? COL.teal : sc.kind === 'hook' ? '#FFFFFF' : COL.orange);
function bg(sc, lt) {
  const acc = accentOf(sc), abs = sc.t0 + lt, gid = 'gl' + (UID++);
  DEFS.push(`<radialGradient id="${gid}" cx=".5" cy=".36" r=".8"><stop offset="0" stop-color="${acc}" stop-opacity=".30"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></radialGradient>`);
  let s = `<rect width="${W}" height="${H}" fill="${COL.bg}"/><rect width="${W}" height="${H}" fill="url(#${gid})"/>`;
  for (let i = -9; i <= 9; i++) s += `<line x1="${540 + i * 36}" y1="1180" x2="${540 + i * 230}" y2="${H + 40}" stroke="${acc}" stroke-opacity=".10" stroke-width="2"/>`;
  for (let k = 0; k < 10; k++) { const u = ((k + abs * .4) % 10) / 10, y = 1180 + (H - 1180 + 60) * u * u; s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${acc}" stroke-opacity="${.04 + .16 * u}" stroke-width="2"/>`; }
  for (let i = 0; i < 14; i++) {
    const x = rnd(i) * W + Math.sin(abs * .15 + i) * 40, y = H + 100 - ((abs * (14 + rnd(i + 3) * 18) + rnd(i + 9) * H) % (H + 200)), r = 24 + rnd(i + 5) * 70;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 ? acc : '#fff'}" fill-opacity="${.04 + rnd(i + 2) * .06}"/>`;
  }
  return s;
}
function cam(sc, lt, inner) {
  const dur = sc.t1 - sc.t0, abs = sc.t0 + lt, bp = (abs / B) % 1;
  let s = 1 + .07 * ease(lt / dur) + (abs >= CFG.drop ? .014 * Math.exp(-bp * 7) : 0);
  const shake = 16 * Math.exp(-lt * 12), f = Math.floor(lt * 60);
  const dx = shake * (rnd(f + 1) - .5) * 2 + 3 * Math.sin(abs * 1.3), dy = shake * (rnd(f + 7) - .5) * 2 + 3 * Math.cos(abs * 1.1);
  return `<g transform="translate(${W / 2 + dx},${H / 2 + dy}) rotate(${.5 * Math.sin(abs * .6)}) scale(${s}) translate(${-W / 2},${-H / 2})">${inner}</g>`;
}
function hud(t) {
  const p = clamp(t / CFG.total);
  return T(CFG.tag || 'LEAD PRELIMS 2027', 90, 150, 26, { wt: 700, fill: COL.orange, anchor: 'start', ls: 5 }) +
    T((CFG.subject || '').toUpperCase(), 990, 150, 26, { wt: 600, fill: COL.dim, anchor: 'end', ls: 5 }) +
    `<rect x="90" y="184" width="900" height="4" rx="2" fill="rgba(255,255,255,.12)"/><rect x="90" y="184" width="${900 * p}" height="4" rx="2" fill="${COL.orange}"/>`;
}

// ---------- scenes ----------
function sHook(sc, lt) {
  const dur = sc.t1 - sc.t0; let s = '';
  s += T('PRELIMS 2027 · ' + (CFG.subject || '').toUpperCase(), W / 2, 372, 32, { wt: 600, fill: COL.dim, ls: 7, op: outE((lt - .1) / .6) });
  const C = 2 * Math.PI * 78, rem = clamp(1 - lt / dur), n = Math.ceil(10 * rem);
  s += `<g opacity="${outE(lt / .5)}"><circle cx="540" cy="500" r="78" fill="none" stroke="#1B2438" stroke-width="10"/><circle cx="540" cy="500" r="78" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C * rem} ${C}" transform="rotate(-90 540 500)"/>${T(String(n), 540, 524, 70, { wt: 700 })}</g>`;
  const size = fitSize(sc.stem, 70, 44, 900, 5), b = block(sc.stem, { y: 700, size, maxW: 900, start: .4, stag: .09, every: 3, evType: 'tick' });
  s += b.svg;
  const cy0 = Math.max(700 + b.h + 40, 1000);
  (sc.options || []).forEach((o, k) => {
    const st = 3.0 + k * B, p = clamp((lt - st) / .45); ev('pop', sc.t0 + st);
    if (p > 0) s += card(90, cy0 + k * 150, 900, 128, 'ABCD'[k], o, { alpha: clamp(p * 3), dx: (1 - back(p)) * 140 });
  });
  const late = clamp((lt - (dur - .8)) / .8);
  if (late > 0) s += `<rect width="${W}" height="${H}" fill="#000" opacity="${.35 * late}"/>`;
  return s;
}
function sRewind(sc, lt) {
  const dur = sc.t1 - sc.t0, u = ease(lt / dur); let s = '';
  const v = (1 - u) * (CFG.rewindFrom || 6), mm = Math.floor(v / 60), ss = Math.floor(v % 60), ff = Math.floor((v % 1) * 30);
  const tc = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  const cx = 540, cy = 620, r = 220;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="6"/>`;
  for (let i = 0; i < 60; i++) { const a = i * 6 * Math.PI / 180, l = i % 5 ? 14 : 30; s += `<line x1="${cx + Math.sin(a) * (r - l)}" y1="${cy - Math.cos(a) * (r - l)}" x2="${cx + Math.sin(a) * r}" y2="${cy - Math.cos(a) * r}" stroke="${COL.teal}" stroke-width="${i % 5 ? 3 : 6}" opacity="${i % 5 ? .5 : 1}"/>`; }
  const ang = -(lt * 900 + 360 * u * 2);
  s += `<path d="M ${cx} ${cy} L ${cx + Math.sin(ang * Math.PI / 180) * r * .9} ${cy - Math.cos(ang * Math.PI / 180) * r * .9}" stroke="${COL.cream}" stroke-width="10" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="14" fill="${COL.teal}"/>`;
  for (let i = 0; i < 8; i++) { const a = (ang + 12 + i * 10) * Math.PI / 180; s += `<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(a) * r * .9}" y2="${cy - Math.cos(a) * r * .9}" stroke="${COL.teal}" stroke-width="3" opacity="${.22 - i * .025}"/>`; }
  const cell = 86; [...tc].forEach((ch, i) => { s += T(ch, 540 + (i - 3.5) * cell, 1000, 120, { wt: 600, fill: COL.cream, op: .95 }); });
  const gx = 9 * (rnd(Math.floor(lt * 30)) - .5) * 2;
  const word = (sc.title || 'REWIND');
  s += T(word, 540 - 10 + gx, 1230, 140, { fill: COL.red, ls: 16, op: .8 }) + T(word, 540 + 10 - gx, 1230, 140, { fill: COL.teal, ls: 16, op: .8 }) + T(word, 540, 1230, 140, { fill: '#fff', ls: 16 });
  for (const sx of [-1, 1]) for (let j = 0; j < 2; j++) { const x = 540 + sx * (400 - j * 44), q = (Math.sin(lt * 14 + j) + 1) / 2; s += `<polygon points="${x + 24},1350 ${x - 24},1380 ${x + 24},1410" fill="${COL.teal}" opacity="${.35 + .6 * q}"/>`; }
  if (sc.sub) s += T(sc.sub, 540, 1330, 44, { wt: 500, fill: COL.dim, op: outE((lt - .5) / .5) });
  for (let y = 0; y < H; y += 6) s += `<rect x="0" y="${y}" width="${W}" height="2" fill="#000" opacity=".16"/>`;
  return s;
}
function viz(sc, lt, acc, cy) {
  const x0 = 140, Wd = 800, h = 72, r = h / 2; let s = '';
  const a = sc.anim || 'none', t1 = lt - .55;
  const seg = (len, fill) => { let q = `<rect x="${x0}" y="${cy - h / 2}" width="${Math.max(0, len)}" height="${h}" rx="${r}" fill="${fill}"/>`; for (let i = 1; i < 10; i++) { const x = x0 + i * 80; if (x < x0 + len - 10) q += `<rect x="${x - 2}" y="${cy - h / 2 + 10}" width="4" height="${h - 20}" fill="rgba(0,0,0,.22)"/>`; } return q; };
  const pop = outE(lt / .4);
  s += `<g opacity="${pop}">`;
  s += `<rect x="${x0 - 6}" y="${cy - h / 2 - 6}" width="${Wd + 12}" height="${h + 12}" rx="${r + 6}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="3" stroke-dasharray="14 12"/>`;
  if (a === 'shorten') {
    const p = ease(t1 / .7), len = Wd * (1 - .5 * p);
    s += seg(len, acc);
    if (p > 0) s += `<g opacity="${1 - p}" transform="translate(0,${p * 90})"><rect x="${x0 + len}" y="${cy - h / 2}" width="${Wd - len}" height="${h}" rx="${r}" fill="${acc}" opacity=".5"/></g>` + T('✂️', x0 + len, cy + 70 - 20 * p, 70, { op: clamp(p * 4) });
  } else if (a === 'morph') {
    const p = ease(t1 / .7), col = p < .5 ? acc : COL.teal;
    s += seg(Wd, col);
    const sid = 'st' + (UID++); DEFS.push(`<pattern id="${sid}" width="36" height="36" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="36" fill="rgba(255,255,255,.28)"/></pattern>`);
    s += `<rect x="${x0}" y="${cy - h / 2}" width="${Wd}" height="${h}" rx="${r}" fill="url(#${sid})" opacity="${p}"/>` + T('🔄', 540, cy - 70 + 10 * (1 - p), 64, { op: p });
  } else if (a === 'erase') {
    const p = ease(t1 / .8), ex = x0 + Wd * p;
    const cid = 'ce' + (UID++); DEFS.push(`<clipPath id="${cid}"><rect x="${ex}" y="${cy - h}" width="${Math.max(0, x0 + Wd + 10 - ex)}" height="${h * 2}"/></clipPath>`);
    s += `<g clip-path="url(#${cid})">${seg(Wd, acc)}</g>`;
    s += `<rect x="${ex - 3}" y="${cy - h / 2 - 14}" width="6" height="${h + 28}" rx="3" fill="#fff" opacity="${p > 0 && p < 1 ? 1 : 0}"/>`;
    for (let i = 0; i < 16; i++) { const px = x0 + (i / 16) * Wd * p, up = clamp((p - i / 16) * 3); s += `<rect x="${px}" y="${cy - 8 - up * (60 + rnd(i) * 90)}" width="8" height="8" fill="${acc}" opacity="${(1 - up) * (p > i / 16 ? 1 : 0)}"/>`; }
  } else if (a === 'pause') {
    const p = clamp(t1 / .8), stop = .55, q = Math.min(p, 1) * stop, len = Wd * q;
    s += `<rect x="${x0}" y="${cy - h / 2}" width="${Wd}" height="${h}" rx="${r}" fill="rgba(255,255,255,.08)"/>` + seg(len, acc);
    s += `<rect x="${x0 + len - 4}" y="${cy - h / 2 - 20}" width="8" height="${h + 40}" rx="4" fill="#fff"/>`;
    const pp = outE((t1 - .8) / .3); s += `<g opacity="${pp}" transform="translate(${x0 + len + 80},${cy}) scale(${.8 + .2 * pp})"><rect x="-26" y="-34" width="20" height="68" rx="5" fill="#fff"/><rect x="6" y="-34" width="20" height="68" rx="5" fill="#fff"/></g>`;
  } else if (sc.icon) {
    s = `<g opacity="${pop}">` + T(sc.icon, 540, cy + 60, 200, { op: 1, tr: `translate(0,${(1 - back(lt / .6)) * 80})` });
  }
  return s + '</g>';
}
function sPoint(sc, lt) {
  const acc = accentOf(sc); let s = chips(sc, lt, acc);
  const size = fitSize(sc.label, 150, 64, 900, 1), p = clamp((lt - .08) / .5);
  const id = 'cw' + (UID++); DEFS.push(`<clipPath id="${id}"><rect x="0" y="470" width="${W}" height="${size * 1.4}"/></clipPath>`);
  ev('hit', sc.t0 + .08);
  s += `<g clip-path="url(#${id})">` + T(sc.label, 540, 470 + size * 1.02 + (1 - back(p)) * size * 1.1, size, { fill: COL.cream }) + `</g>`;
  s += `<rect x="${540 - 90}" y="${470 + size * 1.22}" width="${180 * ease((lt - .3) / .4)}" height="8" rx="4" fill="${acc}" transform="translate(${90 * (1 - ease((lt - .3) / .4))},0)"/>`;
  const vy = 930;
  if (sc.anim && sc.anim !== 'none' || sc.icon) s += viz(sc, lt, acc, vy);
  if (sc.mark) {
    const q = clamp((lt - 1.0) / .5), good = sc.mark === 'check', col = good ? COL.green : COL.red; ev('hit', sc.t0 + 1.0);
    if (q > 0) {
      const R = 96 * back(q);
      s += `<circle cx="540" cy="${vy}" r="${R}" fill="${col}"/>` + (good
        ? `<path d="M 500 ${vy + 4} L 530 ${vy + 34} L 584 ${vy - 28}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1 - clamp((q - .4) / .6)}" fill="none" stroke="#04210F" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<path d="M 504 ${vy - 36} L 576 ${vy + 36} M 576 ${vy - 36} L 504 ${vy + 36}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${1 - clamp((q - .4) / .6)}" fill="none" stroke="#2A0606" stroke-width="18" stroke-linecap="round"/>`);
    }
  }
  if (sc.tag) { const q = clamp((lt - 1.5) / .4); ev('pop', sc.t0 + 1.5); if (q > 0) s += pill(540, 1090, Math.min(900, tw(sc.tag, 40, 700) + 90), 84, sc.tag, 40, acc, '#0A0F1C', .6 + .4 * back(q), clamp(q * 3)); }
  const mean = block(sc.meaning || '', { y: 1250, size: fitSize(sc.meaning || '', 62, 44, 900, 3), maxW: 900, start: 1.0, stag: B / 2, hl: acc });
  return s + mean.svg;
}
function sRule(sc, lt) {
  let s = T((sc.kicker || 'REMEMBER').toUpperCase(), 540, 400, 38, { wt: 700, fill: COL.orange, ls: 10, op: outE(lt / .4) });
  s += `<rect x="${540 - 60 * ease(lt / .5)}" y="428" width="${120 * ease(lt / .5)}" height="5" rx="2.5" fill="${COL.orange}"/>`;
  const L = sc.lines || [], gap = L.length > 1 ? 420 : 0, y0 = L.length > 1 ? 740 : 900;
  L.forEach((ln, k) => {
    const st = .4 + k * 4 * B, y = y0 + k * gap, hgt = ease((lt - st) / .5);
    s += `<rect x="70" y="${y - 100}" width="10" height="${290 * hgt}" rx="5" fill="${ACC[k % 4]}"/>`;
    const b1 = block(ln[0], { y, size: fitSize(ln[0], 110, 60, 860, 1), maxW: 900, start: st, stag: .1, fill: COL.cream, hl: ACC[k % 4], ul: false });
    const b2 = block(ln[1], { y: y + 130, size: fitSize(ln[1], 70, 46, 900, 2), maxW: 900, start: st + B, stag: .14, fill: COL.dim, hl: ACC[k % 4] });
    s += b1.svg + b2.svg;
  });
  return s;
}
function sAnswer(sc, lt) {
  let s = T('ANSWER', 540, 330, 40, { wt: 700, fill: COL.green, ls: 12, op: outE(lt / .4) });
  const st = block(sc.stem || '', { y: 410, size: fitSize(sc.stem || '', 42, 32, 900, 3), maxW: 900, start: .05, stag: .02, fill: COL.dim, evType: 'tick', every: 99, ul: false });
  s += st.svg;
  const y0 = 600, win = sc.correct, wp = clamp((lt - B) / .5); ev('hit', sc.t0 + B);
  (sc.options || []).forEach((o, k) => {
    const isW = k === win, pop = clamp((lt - .1 - k * .06) / .35);
    s += card(90, y0 + k * 166, 900, 142, 'ABCD'[k], o, {
      win: isW && wp > 0, alpha: clamp(pop * 3) * (isW ? 1 : 1 - .68 * ease(wp)), sc: isW ? 1 + .04 * back(wp) : 1 - .03 * ease(wp), chk: isW ? clamp((lt - B - .2) / .5) : 0, dx: (1 - back(pop)) * 100
    });
  });
  const sp = clamp((lt - 3 * B) / .25); ev('stamp', sc.t0 + 3 * B);
  if (sp > 0) { const k = 1 + 2.2 * (1 - sp); s += `<g opacity="${clamp(sp * 4)}" transform="translate(540,1400) rotate(-6) scale(${k})"><rect x="-300" y="-84" width="600" height="168" rx="22" fill="rgba(7,11,20,.7)" stroke="${COL.green}" stroke-width="10"/>${T('CORRECT', 0, 36, 112, { fill: COL.green, ls: 8 })}</g>`; }
  s += block(sc.why || '', { y: 1580, size: fitSize(sc.why || '', 48, 36, 900, 2), maxW: 900, start: 4.5 * B, stag: .1, hl: COL.green }).svg;
  return s;
}
function sCta(sc, lt) {
  let s = ''; const p = back(clamp((lt - .1) / .6));
  s += `<g transform="translate(540,520) scale(${p})" opacity="${clamp(lt * 4)}"><rect x="-300" y="-92" width="600" height="184" rx="36" fill="${COL.cream}"/><image href="logo.png" x="-250" y="-64" width="500" height="127.4"/></g>`;
  s += block(sc.big || 'Daily Prelims quiz + notes', { y: 840, size: fitSize(sc.big || '', 100, 56, 900, 3), maxW: 900, start: .6, stag: .12, hl: COL.orange }).svg;
  if (sc.sub) s += block(sc.sub, { y: 1130, size: 46, maxW: 900, start: 1.5, stag: .08, fill: COL.dim, ul: false }).svg;
  const q = clamp((lt - 2.0) / .5); ev('hit', sc.t0 + 2.0);
  if (q > 0) s += pill(540, 1300, Math.min(940, tw(sc.url || 'leanprep.in/lead-prelims', 52, 700) + 120), 130, sc.url || 'leanprep.in/lead-prelims', 52, COL.orange, '#0A0F1C', (.7 + .3 * back(q)) * (1 + .018 * Math.sin(lt * 7)), clamp(q * 3));
  return s;
}
const SCENE = { hook: sHook, rewind: sRewind, point: sPoint, rule: sRule, answer: sAnswer, cta: sCta };

// ---------- compose ----------
const satOf = (sc, lt) => sc.kind === 'hook' ? 0 : sc.kind === 'rewind' ? ease(lt / (sc.t1 - sc.t0)) : 1;
function layer(sc, lt, dx, blur) {
  CUR = { t0: sc.t0, lt };
  const sat = satOf(sc, lt), body = bg(sc, lt) + cam(sc, lt, `<g transform="translate(0,${({point:150,rule:150,cta:130})[sc.kind]||0})">${SCENE[sc.kind](sc, lt)}</g>`);
  let g = body;
  if (sat < .995) { const id = 'sat' + (UID++); DEFS.push(`<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="${sat.toFixed(3)}"/></filter>`); g = `<g filter="url(#${id})">${g}</g>`; }
  if (blur > .5) { const id = 'bl' + (UID++); DEFS.push(`<filter id="${id}" x="-20%" y="-5%" width="140%" height="110%"><feGaussianBlur stdDeviation="${blur.toFixed(1)} 0"/></filter>`); g = `<g filter="url(#${id})">${g}</g>`; }
  return `<g transform="translate(${dx},0)">${g}</g>`;
}
window.frame = function (t, dry) {
  DEFS = []; UID = 0;
  const S = CFG.scenes; let i = S.findIndex(s => t >= s.t0 && t < s.t1); if (i < 0) i = S.length - 1;
  const sc = S[i], lt = t - sc.t0, TR = .26; let body = '', ca = 0;
  if (i > 0 && lt < TR) {
    const p = ease(lt / TR), prev = S[i - 1], sw = Math.sin(Math.PI * p);
    body = layer(prev, prev.t1 - prev.t0 - .001, -p * 1300, 70 * sw) + layer(sc, lt, (1 - p) * 1300, 70 * sw);
    ca = 18 * sw;
  } else body = layer(sc, lt, 0, 0);
  let svg = ca > .5 ? `<g filter="url(#ca)">${body}</g>` : body;
  if (ca > .5) DEFS.push(`<filter id="ca" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/><feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/><feOffset in="r" dx="${ca.toFixed(1)}" result="ro"/><feOffset in="b" dx="${(-ca).toFixed(1)}" result="bo"/><feBlend in="ro" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bo" mode="screen"/></filter>`);
  svg += hud(t);
  DEFS.push(`<radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>`);
  svg += `<rect width="${W}" height="${H}" fill="url(#vg)"/>`;
  let flash = i > 0 ? (sc.kind === 'point' && sc.t0 === CFG.drop ? .8 : .32) * Math.exp(-lt * 11) : 0;
  if (sc.kind === 'rewind') flash = Math.max(flash, .9 * clamp((lt - (sc.t1 - sc.t0 - .22)) / .22));
  if (flash > .01) svg += `<rect width="${W}" height="${H}" fill="#fff" opacity="${flash.toFixed(3)}"/>`;
  if (!dry) document.getElementById('stage').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS.join('')}</defs>${svg}</svg>`;
};
