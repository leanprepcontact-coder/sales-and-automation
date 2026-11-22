// Hand-drawn sketch reel scene. Draws rough.js shapes line by line (stroke-dashoffset), then fades them.
// frame(t) is called by render_sketch.py. 1080x1920, no external state.
const W = 1080, H = 1920;
const INK = '#23201b', RED = '#d4402e', ORG = '#ec9a3c', BLU = '#3f78b8', GRN = '#4f9d69', PAPER = '#f3eee2';
const WH = '#f4f8ff', CY = '#7fe8ff', BPC = '#10284a';
const NS = 'http://www.w3.org/2000/svg';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (p) => 1 - Math.pow(1 - p, 2.2);

const svg = document.createElementNS(NS, 'svg');
svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
document.getElementById('stage').appendChild(svg);
const rc = rough.svg(svg);
const mk = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };

// ---------- background: paper, blueprint, grain ----------
const defs = mk('defs'); svg.appendChild(defs);
defs.innerHTML = `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 0.55 0"/></filter>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
svg.appendChild(mk('rect', { width: W, height: H, fill: PAPER }));
const bp = mk('rect', { width: W, height: H, fill: BPC, opacity: 0 }); svg.appendChild(bp);
const bpGrid = mk('g', { opacity: 0 }); svg.appendChild(bpGrid);
for (let x = 0; x <= W; x += 60) bpGrid.appendChild(mk('line', { x1: x, y1: 0, x2: x, y2: H, stroke: '#2a4a7a', 'stroke-width': x % 300 ? 1 : 2, opacity: .55 }));
for (let y = 0; y <= H; y += 60) bpGrid.appendChild(mk('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#2a4a7a', 'stroke-width': y % 300 ? 1 : 2, opacity: .55 }));
const layer = mk('g'); svg.appendChild(layer);
const grain = mk('rect', { width: W, height: H, filter: 'url(#grain)', opacity: .22, 'pointer-events': 'none' }); svg.appendChild(grain);

// ---------- item system ----------
const items = [];
let inited = false;
function add(g, t0, dur, o = {}) {
  layer.appendChild(g);
  const it = { g, t0, dur, tOut: o.tOut, glow: o.glow, paths: [], texts: [] };
  g.querySelectorAll('path').forEach(p => it.paths.push({ el: p }));
  items.push(it); return it;
}
function draw(shapes, t0, dur, o = {}) {
  const g = mk('g'); shapes.forEach(s => g.appendChild(s)); return add(g, t0, dur, o);
}
let clipN = 0;
function text(str, x, y, size, t0, dur, o = {}) {
  const id = 'c' + (clipN++);
  const t = mk('text', { x, y, 'font-size': size, 'font-family': o.font || 'Hand', 'font-weight': o.weight || 700, fill: o.color || INK, 'text-anchor': o.anchor || 'middle', transform: o.rot ? `rotate(${o.rot} ${x} ${y})` : '' });
  t.textContent = str;
  const cp = mk('clipPath', { id }); const cr = mk('rect', { x: 0, y: 0, width: 0, height: H }); cp.appendChild(cr); defs.appendChild(cp);
  const g = mk('g', { 'clip-path': `url(#${id})` }); g.appendChild(t);
  const it = add(g, t0, dur, o); it.isText = true; it.t = t; it.cr = cr; return it;
}
function init() {
  inited = true;
  items.forEach(it => {
    if (it.isText) { const b = it.t.getBBox(); it.bx = b.x - 10; it.bw = b.width + 24; it.cr.setAttribute('x', it.bx); it.cr.setAttribute('y', 0); return; }
    let L = 0;
    it.paths.forEach(p => { p.len = Math.max(1, p.el.getTotalLength()); L += p.len; });
    let acc = 0;
    it.paths.forEach(p => { p.ts = it.t0 + it.dur * (acc / L); p.td = Math.max(0.05, it.dur * (p.len / L)); acc += p.len; p.el.style.strokeDasharray = p.len; });
  });
}
function frame(t) {
  if (!inited) init();
  const bpa = clamp((t - 26.3) / 1.6);
  bp.setAttribute('opacity', bpa); bpGrid.setAttribute('opacity', bpa);
  grain.setAttribute('opacity', .22 - .1 * bpa);
  items.forEach(it => {
    let op = 1;
    if (it.tOut != null && t > it.tOut) op = clamp(1 - (t - it.tOut) / 0.45);
    if (t < it.t0) op = 0;
    it.g.setAttribute('opacity', op);
    if (it.isText) { it.cr.setAttribute('width', it.bw * ease(clamp((t - it.t0) / it.dur))); return; }
    it.paths.forEach(p => {
      const pr = clamp((t - p.ts) / p.td);
      p.el.style.strokeDashoffset = p.len * (1 - ease(pr));
      p.el.style.opacity = pr > 0 ? 1 : 0;
    });
    if (it.glow) it.g.setAttribute('filter', 'url(#glow)');
  });
}

// ---------- shape helpers ----------
let seed = 7;
const o = (x = {}) => Object.assign({ stroke: INK, strokeWidth: 4.2, roughness: 1.7, bowing: 1.3, seed: seed++ }, x);
const P = (d, x = {}) => rc.path(d, o(x));
const E = (cx, cy, w, h, x = {}) => rc.ellipse(cx, cy, w, h, o(x));
const R = (x0, y0, w, h, x = {}) => rc.rectangle(x0, y0, w, h, o(x));
const LN = (x1, y1, x2, y2, x = {}) => rc.line(x1, y1, x2, y2, o(x));
const hatch = (c, gap = 11) => ({ fill: c, fillStyle: 'hachure', hachureGap: gap, fillWeight: 3.2, hachureAngle: -48 });

// scribble lines that stand for text on a page
function lines(x, y, w, n, gap, x0 = {}) {
  const a = [];
  for (let i = 0; i < n; i++) a.push(LN(x, y + i * gap, x + w * (i % 3 === 2 ? .62 : 1) , y + i * gap + (i % 2 ? 2 : -2), Object.assign({ strokeWidth: 3, roughness: 2.2 }, x0)));
  return a;
}
// open book seen from the front, centred on cx, top edge at y
function book(cx, y, w = 330, x0 = {}) {
  const h = w * 0.52, hw = w / 2;
  const a = [
    P(`M ${cx - hw} ${y + 14} L ${cx} ${y} L ${cx + hw} ${y + 14} L ${cx + hw} ${y + h} L ${cx} ${y + h - 14} L ${cx - hw} ${y + h} Z`, Object.assign(hatch('#e9d9b4', 14), x0)),
    LN(cx, y, cx, y + h - 14, Object.assign({ strokeWidth: 4 }, x0)),
  ];
  for (let i = 0; i < 4; i++) { a.push(LN(cx - hw + 28, y + 40 + i * 30, cx - 28, y + 32 + i * 30 + 0, Object.assign({ strokeWidth: 2.6 }, x0))); a.push(LN(cx + 28, y + 32 + i * 30, cx + hw - 28, y + 40 + i * 30, Object.assign({ strokeWidth: 2.6 }, x0))); }
  return a;
}
// student: head centred at (cx,cy)
function body(cx, cy, shirt, hair) {
  const a = [
    E(cx, cy, 132, 150),
    P(`M ${cx - 118} ${cy + 340} L ${cx - 116} ${cy + 214} C ${cx - 112} ${cy + 156}, ${cx - 64} ${cy + 140}, ${cx} ${cy + 136} C ${cx + 64} ${cy + 140}, ${cx + 112} ${cy + 156}, ${cx + 116} ${cy + 214} L ${cx + 118} ${cy + 340}`, hatch(shirt, 12)),
    LN(cx - 20, cy + 70, cx - 22, cy + 138), LN(cx + 20, cy + 70, cx + 22, cy + 138),
    P(`M ${cx - 104} ${cy + 220} C ${cx - 150} ${cy + 280}, ${cx - 130} ${cy + 330}, ${cx - 84} ${cy + 372}`),
    P(`M ${cx + 104} ${cy + 220} C ${cx + 150} ${cy + 280}, ${cx + 130} ${cy + 330}, ${cx + 84} ${cy + 372}`),
  ];
  if (hair === 'long') a.push(P(`M ${cx - 68} ${cy + 6} C ${cx - 88} ${cy - 100}, ${cx + 88} ${cy - 100}, ${cx + 68} ${cy + 6}`, hatch(INK, 8)), P(`M ${cx - 68} ${cy + 6} C ${cx - 102} ${cy + 70}, ${cx - 92} ${cy + 125}, ${cx - 62} ${cy + 140}`), P(`M ${cx + 68} ${cy + 6} C ${cx + 102} ${cy + 70}, ${cx + 92} ${cy + 125}, ${cx + 62} ${cy + 140}`));
  else a.push(P(`M ${cx - 64} ${cy - 24} L ${cx - 48} ${cy - 86} L ${cx - 24} ${cy - 52} L ${cx - 2} ${cy - 94} L ${cx + 22} ${cy - 54} L ${cx + 44} ${cy - 88} L ${cx + 64} ${cy - 24}`, hatch(INK, 8)));
  return a;
}
const faceHappy = (cx, cy) => [P(`M ${cx - 38} ${cy - 6} q 14 -12 28 0`, { strokeWidth: 3.6 }), P(`M ${cx + 10} ${cy - 6} q 14 -12 28 0`, { strokeWidth: 3.6 }), P(`M ${cx - 24} ${cy + 32} q 24 24 48 0`, { strokeWidth: 3.6 })];
const faceNeutral = (cx, cy) => [E(cx - 24, cy - 4, 9, 9, { fill: INK, fillStyle: 'solid', strokeWidth: 2 }), E(cx + 24, cy - 4, 9, 9, { fill: INK, fillStyle: 'solid', strokeWidth: 2 }), LN(cx - 16, cy + 36, cx + 16, cy + 36, { strokeWidth: 3.6 })];
const faceConfused = (cx, cy) => [E(cx - 24, cy - 2, 9, 9, { fill: INK, fillStyle: 'solid', strokeWidth: 2 }), E(cx + 24, cy - 2, 9, 9, { fill: INK, fillStyle: 'solid', strokeWidth: 2 }), LN(cx - 40, cy - 28, cx - 10, cy - 20, { strokeWidth: 3.6 }), LN(cx + 40, cy - 20, cx + 10, cy - 28, { strokeWidth: 3.6 }), P(`M ${cx - 20} ${cy + 42} q 20 -16 40 0`, { strokeWidth: 3.6 })];

// ================= TIMELINE (36.5 s) =================
// Beat 1+2: hook, two students (0.3 - 11)
text('Same book.', 540, 360, 150, 0.3, 0.9);
text('She got it in 1 go.', 540, 520, 118, 1.7, 1.3);
text('He needed 3.', 540, 660, 118, 3.4, 1.0);
const ax = 290, bx = 790, cy = 1010;
draw(body(ax, cy, ORG, 'long'), 0.6, 1.6, { tOut: 11 });
draw(body(bx, cy, BLU, 'spiky'), 0.9, 1.6, { tOut: 11 });
draw(book(ax, cy + 372, 300), 2.0, 1.0, { tOut: 11 });
draw(book(bx, cy + 372, 300), 2.2, 1.0, { tOut: 11 });
draw(faceNeutral(ax, cy), 2.6, 0.5, { tOut: 6.4 });
draw(faceNeutral(bx, cy), 2.8, 0.5, { tOut: 6.4 });
draw(faceHappy(ax, cy), 6.6, 0.5, { tOut: 11 });
draw(faceConfused(bx, cy), 6.6, 0.5, { tOut: 11 });
// A: lightbulb
draw([E(ax + 20, cy - 200, 70, 78, { stroke: INK, ...hatch('#ffd84a', 7) }), LN(ax + 6, cy - 156, ax + 34, cy - 156), LN(ax + 10, cy - 142, ax + 30, cy - 142),
  LN(ax + 20, cy - 262, ax + 20, cy - 286), LN(ax - 28, cy - 244, ax - 46, cy - 262), LN(ax + 68, cy - 244, ax + 86, cy - 262), LN(ax - 40, cy - 200, ax - 62, cy - 200), LN(ax + 80, cy - 200, ax + 102, cy - 200)], 7.0, 0.9, { tOut: 11 });
// B: question marks + scribble
text('?', bx - 60, cy - 130, 110, 7.0, 0.3, { color: RED, tOut: 11, rot: -14 });
text('?', bx + 40, cy - 170, 140, 7.3, 0.3, { color: RED, tOut: 11, rot: 10 });
draw([P(`M ${bx - 120} ${cy - 120} c 30 -50 90 -30 70 20 c -15 30 -60 20 -48 -10 c 8 -20 40 -12 30 5`, { stroke: RED, strokeWidth: 3.4 })], 7.6, 0.7, { tOut: 11 });
// hooks fade with the students
items.slice(0, 3).forEach(it => it.tOut = 11);

// Beat 3: reveal (11.4 - 16.2)
text("It's not you.", 540, 640, 150, 11.4, 1.0, { tOut: 16.2 });
text('The book was written', 540, 830, 92, 12.7, 1.3, { tOut: 16.2, weight: 500 });
text('for one kind of reader.', 540, 940, 92, 13.4, 1.4, { tOut: 16.2, weight: 500 });
draw(book(540, 1130, 520), 12.4, 1.8, { tOut: 16.2 });
draw([P('M 330 1080 C 300 1000, 340 960, 330 910', { stroke: RED, strokeWidth: 4 }), P('M 730 1080 C 760 1000, 720 960, 735 910', { stroke: RED, strokeWidth: 4 })], 14.6, 0.8, { tOut: 16.2 });

// Beat 4: mistakes -> next test (16.6 - 22.4)
text('Your wrong answers', 300, 500, 70, 16.6, 0.9, { tOut: 22.4 });
draw([R(110, 560, 380, 560, hatch('#fffaf0', 30))].concat(lines(150, 640, 300, 9, 52)), 16.8, 1.4, { tOut: 22.4 });
draw([E(300, 692, 330, 54, { stroke: RED, strokeWidth: 5 }), E(280, 848, 340, 54, { stroke: RED, strokeWidth: 5 }), E(310, 1004, 320, 54, { stroke: RED, strokeWidth: 5 })], 18.0, 1.2, { tOut: 22.4 });
draw([P('M 470 700 C 560 700, 560 800, 650 820', { stroke: RED, strokeWidth: 5 }), P('M 470 860 C 560 860, 580 880, 650 880', { stroke: RED, strokeWidth: 5 }), P('M 470 1010 C 560 1010, 570 950, 650 930', { stroke: RED, strokeWidth: 5 }), P('M 620 800 L 656 822 L 618 846', { stroke: RED, strokeWidth: 5 })], 19.3, 1.0, { tOut: 22.4 });
text('Your next test', 800, 660, 70, 19.6, 0.9, { tOut: 22.4 });
draw([R(640, 720, 340, 480, { ...hatch('#fffaf0', 30), stroke: INK })].concat(lines(675, 800, 270, 7, 52), [E(810, 870, 250, 46, { stroke: GRN, strokeWidth: 4 }), E(800, 974, 250, 46, { stroke: GRN, strokeWidth: 4 }), E(800, 1078, 250, 46, { stroke: GRN, strokeWidth: 4 })]), 20.0, 1.6, { tOut: 22.4 });
text('Your mistakes become', 540, 1400, 96, 20.6, 1.1, { tOut: 22.4 });
text('your next test.', 540, 1500, 96, 21.2, 0.9, { tOut: 22.4 });

// Beat 5: two staircases (22.8 - 26.6)
function stairs(x0, n, c) {
  const a = [], sw = n === 4 ? 100 : 120, sh = 90;
  for (let i = 0; i < n; i++) a.push(R(x0 + i * sw, 1180 - (i + 1) * sh, sw, (i + 1) * sh, i === n - 1 ? hatch(c, 10) : hatch(c, 22)));
  return a;
}
text('Her next test', 290, 560, 78, 22.8, 0.8, { tOut: 26.6 });
text('His next test', 790, 560, 78, 22.8, 0.8, { tOut: 26.6 });
draw(stairs(100, 3, ORG), 23.0, 1.4, { tOut: 26.6 });
draw(stairs(580, 4, BLU), 23.3, 1.6, { tOut: 26.6 });
text('starts higher', 290, 1275, 56, 24.4, 0.7, { tOut: 26.6, font: 'Hand2', weight: 400 });
text('starts with a bridge', 770, 1275, 56, 24.8, 0.8, { tOut: 26.6, font: 'Hand2', weight: 400 });
const fig = (x, top) => [E(x, top - 52, 40, 40, { fill: INK, fillStyle: 'solid' }), LN(x, top - 32, x, top - 4), LN(x, top - 24, x - 22, top - 2), LN(x, top - 24, x + 22, top - 2)];
draw(fig(280, 1000), 24.6, 0.6, { tOut: 26.6 });
draw(fig(630, 1090), 24.9, 0.6, { tOut: 26.6 });
text('Same goal. Different path.', 540, 1480, 92, 25.0, 1.1, { tOut: 26.6 });

// Beat 6: blueprint map (27.4 - 32.4)
const cols = 4, rows = 5, cw = 190, ch = 150, gx = 160, gy = 380;
const cellCols = [GRN, ORG, RED, GRN, ORG, GRN, GRN, RED, ORG, GRN, RED, ORG, GRN, GRN, ORG, GRN, ORG, RED, GRN, GRN];
const cells = [];
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push(R(gx + c * cw, gy + r * ch, cw - 14, ch - 14, { stroke: CY, strokeWidth: 3.4, roughness: 1.3, ...hatch(cellCols[r * cols + c], 9) }));
draw(cells, 27.4, 2.6, { tOut: 32.6, glow: true });
text('Every mistake', 540, 1290, 100, 29.6, 0.9, { color: WH, tOut: 32.6 });
text('maps your next test.', 540, 1400, 100, 30.3, 1.0, { color: CY, tOut: 32.6 });

// Beat 7: end card (33.0 - 36.5)
text('LEAD Prelims 2027', 540, 700, 128, 33.0, 1.0, { color: WH });
text('Tests that start', 540, 860, 96, 34.0, 0.9, { color: WH, weight: 500 });
text('from your mistakes.', 540, 960, 96, 34.5, 1.0, { color: CY, weight: 500 });
draw([LN(250, 1120, 830, 1120, { stroke: CY, strokeWidth: 4 })], 35.2, 0.5, { glow: true });
text('leanprep.in/lead-prelims', 540, 1085, 62, 35.0, 0.9, { color: WH, font: 'Hand2', weight: 400 });
text('Mains next.', 540, 1240, 70, 35.8, 0.7, { color: CY });
