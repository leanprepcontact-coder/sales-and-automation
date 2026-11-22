// Futuristic holographic HUD reel (hand-sketched lines, glowing). frame(t) called by render_sketch.py --scene hud_scene.js
const W = 1080, H = 1920;
const CY = '#5ef0ff', GD = '#ffc15a', RD = '#ff4d6a', WH = '#eaf9ff', GR = '#46e6a0', BG = '#040b17';
const NS = 'http://www.w3.org/2000/svg';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (p) => 1 - Math.pow(1 - p, 2.2);
const mk = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
const svg = mk('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
document.getElementById('stage').appendChild(svg);
const rc = rough.svg(svg);
const defs = mk('defs'); svg.appendChild(defs);
defs.innerHTML = `
<radialGradient id="bgg" cx="50%" cy="48%" r="75%"><stop offset="0" stop-color="#0b2b4a"/><stop offset=".6" stop-color="#061427"/><stop offset="1" stop-color="#02060d"/></radialGradient>
<radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".65"/></radialGradient>
<linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${CY}" stop-opacity="0"/><stop offset=".5" stop-color="${CY}" stop-opacity=".9"/><stop offset="1" stop-color="${CY}" stop-opacity="0"/></linearGradient>
<pattern id="scan" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="2" fill="#000" opacity=".16"/></pattern>
<filter id="bloom" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3" result="a"/><feGaussianBlur stdDeviation="14" in="SourceGraphic" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 .6  0 0 0 0 .8  0 0 0 0 1  0 0 0 .5 0"/></filter>`;
svg.appendChild(mk('rect', { width: W, height: H, fill: 'url(#bgg)' }));
const cam = mk('g'); svg.appendChild(cam);
// faint hex/grid floor
const grid = mk('g', { opacity: .16 }); cam.appendChild(grid);
for (let x = -60; x <= W + 60; x += 90) grid.appendChild(mk('line', { x1: x, y1: 0, x2: x, y2: H, stroke: CY, 'stroke-width': 1 }));
for (let y = 0; y <= H; y += 90) grid.appendChild(mk('line', { x1: 0, y1: y, x2: W, y2: y, stroke: CY, 'stroke-width': 1 }));
// particles
const parts = []; let rs = 11; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
const pg = mk('g'); cam.appendChild(pg);
for (let i = 0; i < 70; i++) { const c = mk('circle', { r: 1.5 + rnd() * 3, fill: i % 5 ? CY : GD, opacity: .5 }); pg.appendChild(c); parts.push({ c, x: rnd() * W, y: rnd() * H, v: 14 + rnd() * 40, ph: rnd() * 6 }); }
const layer = mk('g', { filter: 'url(#bloom)' }); cam.appendChild(layer);
svg.appendChild(mk('rect', { width: W, height: H, fill: 'url(#scan)', 'pointer-events': 'none' }));
svg.appendChild(mk('rect', { width: W, height: H, fill: 'url(#vig)', 'pointer-events': 'none' }));
const grain = mk('rect', { width: W, height: H, filter: 'url(#grain)', opacity: .1 }); svg.appendChild(grain);
const flash = mk('rect', { width: W, height: H, fill: WH, opacity: 0 }); svg.appendChild(flash);

// ---------- items ----------
const items = []; let inited = false, clipN = 0;
function add(g, t0, dur, o = {}) {
  layer.appendChild(g);
  const it = { g, t0, dur, tOut: o.tOut, fx: o.fx, live: o.live, fi: o.fi || 0.35, paths: [], isText: false };
  if (!o.live) g.querySelectorAll('path').forEach(p => it.paths.push({ el: p }));
  items.push(it); return it;
}
function draw(shapes, t0, dur, o = {}) { const g = mk('g'); shapes.forEach(s => g.appendChild(s)); if (o.tf) g.setAttribute('transform', o.tf); return add(g, t0, dur, o); }
function live(nodes, t0, o = {}) { const g = mk('g'); nodes.forEach(s => g.appendChild(s)); if (o.tf) g.setAttribute('transform', o.tf); return add(g, t0, 0, Object.assign({ live: true }, o)); }
function text(str, x, y, size, t0, dur, o = {}) {
  const id = 'c' + (clipN++);
  const font = o.font || 'Hand';
  const t = mk('text', { x, y, 'font-size': size, 'font-family': font, 'font-weight': o.weight || (font === 'Hand' ? 700 : 400), fill: o.color || WH, 'text-anchor': o.anchor || 'middle', 'letter-spacing': o.ls || 0 });
  t.textContent = str;
  const cp = mk('clipPath', { id }); const cr = mk('rect', { x: 0, y: 0, width: 0, height: H }); cp.appendChild(cr); defs.appendChild(cp);
  const g = mk('g', { 'clip-path': `url(#${id})` }); g.appendChild(t);
  const it = add(g, t0, dur, o); it.isText = true; it.t = t; it.cr = cr; return it;
}
function init() {
  inited = true;
  items.forEach(it => {
    if (it.isText) { const b = it.t.getBBox(); it.bx = b.x - 10; it.bw = b.width + 24; it.cr.setAttribute('x', it.bx); return; }
    if (it.live) return;
    let L = 0; it.paths.forEach(p => { p.len = Math.max(1, p.el.getTotalLength()); L += p.len; });
    let acc = 0;
    it.paths.forEach(p => { p.ts = it.t0 + it.dur * (acc / L); p.td = Math.max(0.05, it.dur * (p.len / L)); acc += p.len; p.el.style.strokeDasharray = p.len; });
  });
}
function frame(t) {
  if (!inited) init();
  const s = 1 + 0.04 * t / 36.5;
  cam.setAttribute('transform', `translate(540 960) scale(${s}) translate(-540 -960)`);
  grid.setAttribute('transform', `translate(0 ${(t * 18) % 90})`);
  parts.forEach(p => { const y = ((p.y - t * p.v) % H + H) % H; p.c.setAttribute('cx', p.x + Math.sin(t + p.ph) * 12); p.c.setAttribute('cy', y); p.c.setAttribute('opacity', .25 + .35 * Math.abs(Math.sin(t * .8 + p.ph))); });
  // scene-change flashes
  let fl = 0; [3.7, 9.3, 15.3, 22.7, 29.2, 33.0].forEach(k => { const d = t - k; if (d >= 0 && d < .35) fl = Math.max(fl, .35 * (1 - d / .35)); });
  flash.setAttribute('opacity', fl);
  items.forEach(it => {
    let op = 1;
    if (t < it.t0) op = 0; else if (it.live) op = clamp((t - it.t0) / it.fi);
    if (it.tOut != null && t > it.tOut) op = Math.min(op, clamp(1 - (t - it.tOut) / 0.4));
    it.g.setAttribute('opacity', op);
    if (op > 0 && it.fx) it.fx(t, it.g, op);
    if (it.isText) { it.cr.setAttribute('width', it.bw * ease(clamp((t - it.t0) / Math.max(.05, it.dur)))); return; }
    it.paths.forEach(p => {
      const pr = clamp((t - p.ts) / p.td);
      p.el.style.strokeDashoffset = p.len * (1 - ease(pr)); p.el.style.opacity = pr > 0 ? 1 : 0;
    });
  });
}

// ---------- shape helpers ----------
let seed = 21;
const o = (x = {}) => Object.assign({ stroke: CY, strokeWidth: 3.6, roughness: 1.05, bowing: .8, seed: seed++ }, x);
const P = (d, x = {}) => rc.path(d, o(x));
const E = (cx, cy, w, h, x = {}) => rc.ellipse(cx, cy, w, h, o(x));
const R = (x0, y0, w, h, x = {}) => rc.rectangle(x0, y0, w, h, o(x));
const LN = (x1, y1, x2, y2, x = {}) => rc.line(x1, y1, x2, y2, o(x));
const hatch = (c, gap = 14, w = 2.6) => ({ fill: c, fillStyle: 'hachure', hachureGap: gap, fillWeight: w, hachureAngle: -50 });
const CYF = 'rgba(94,240,255,.55)', CYF2 = 'rgba(94,240,255,.3)';
const rot = (a, cx, cy) => `rotate(${a} ${cx} ${cy})`;
const mono = (str, x, y, size, color, anchor = 'middle', ls = 3) => { const t = mk('text', { x, y, 'font-size': size, 'font-family': 'Mono', fill: color, 'text-anchor': anchor, 'letter-spacing': ls }); t.textContent = str; return t; };

// ---------- HUD frame (always on) ----------
const brk = [];
[[70, 250, 1, 1], [1010, 250, -1, 1], [70, 1530, 1, -1], [1010, 1530, -1, -1]].forEach(([x, y, sx, sy]) => brk.push(P(`M ${x} ${y + sy * 70} L ${x} ${y} L ${x + sx * 70} ${y}`, { stroke: GD, strokeWidth: 4 })));
draw(brk, 0.2, 0.8);
live([mono('LEAD // ADAPTIVE ENGINE', 100, 292, 28, GD, 'start')], 0.5);
live([mono('ONLINE', 980, 292, 28, GR, 'end')], 0.7, { fx: (t, g) => g.firstChild.setAttribute('opacity', .6 + .4 * Math.abs(Math.sin(t * 3))) });
live([mono('NOTES · TESTS · YOU', 100, 1500, 26, CYF, 'start')], 0.9);
const timer = mono('T+00:00', 980, 1500, 26, CYF, 'end'); live([timer], 0.9, { fx: (t) => { timer.textContent = `T+00:${String(Math.floor(t)).padStart(2, '0')}`; } });

// ---------- S0 boot + hook (0 - 3.7) ----------
const ringsAt = (cx, cy, rs, dim) => { const a = []; rs.forEach((r, i) => a.push(E(cx, cy, r * 2, r * 2, { strokeWidth: 3 - i * .3, stroke: dim ? (i === 1 ? 'rgba(255,193,90,.28)' : 'rgba(94,240,255,.26)') : (i === 1 ? GD : CY) }))); for (let k = 0; k < 36; k++) { const an = k * 10 * Math.PI / 180, r1 = rs[rs.length - 1] + 14, r2 = r1 + (k % 3 ? 10 : 24); a.push(LN(cx + r1 * Math.cos(an), cy + r1 * Math.sin(an), cx + r2 * Math.cos(an), cy + r2 * Math.sin(an), { strokeWidth: 2.4 })); } return a; };
draw(ringsAt(540, 1080, [90, 150, 215]), 0.3, 1.6, { tOut: 3.7, fx: (t, g) => g.setAttribute('transform', rot(t * 40, 540, 1080)) });
text('What if your notes', 540, 560, 112, 0.9, 1.2, { tOut: 3.7 });
text('knew you?', 540, 700, 132, 2.0, 1.0, { color: CY, tOut: 3.7 });

// ---------- S1 notes + reader (3.8 - 9.2) ----------
text('Your notes.', 540, 420, 118, 3.9, 0.9, { tOut: 9.2 });
const pageTf = 'skewY(-5)';
draw([R(300, 540, 480, 520, hatch(CYF2, 22)), LN(340, 600, 740, 600, { stroke: GD, strokeWidth: 5 })].concat(
  Array.from({ length: 10 }, (_, i) => LN(340, 660 + i * 36, 340 + (i % 4 === 3 ? 250 : 400), 660 + i * 36 + (i % 2 ? 2 : -2), { strokeWidth: 2.6 }))), 4.0, 1.6, { tOut: 9.2, tf: pageTf });
text('NOTES', 540, 508, 32, 4.1, .5, { font: 'Mono', color: GD, ls: 8, tOut: 9.2 });
live([rc.rectangle(330, 733, 420, 30, { fill: 'rgba(255,193,90,.45)', fillStyle: 'solid', stroke: GD, strokeWidth: 2.4, seed: 5 }), rc.rectangle(330, 949, 300, 30, { fill: 'rgba(255,193,90,.45)', fillStyle: 'solid', stroke: GD, strokeWidth: 2.4, seed: 6 })], 6.1, { tOut: 9.2, tf: pageTf, fx: (t, g) => g.setAttribute('opacity', .55 + .45 * Math.abs(Math.sin(t * 5))) });
live([mk('rect', { x: 290, y: 0, width: 500, height: 26, fill: 'url(#beam)' })], 4.7, { tOut: 6.6, fx: (t, g) => g.setAttribute('transform', `translate(0 ${520 + 520 * clamp((t - 4.7) / 1.8)})`) });
// reader (holo sketch student), small, in front of the page
const stTf = 'translate(540 1260) scale(.74) translate(-540 -1260)';
const holoBody = (cx, cy) => [E(cx, cy, 132, 150, { strokeWidth: 4.4 }), P(`M ${cx - 118} ${cy + 340} L ${cx - 116} ${cy + 214} C ${cx - 112} ${cy + 156}, ${cx - 64} ${cy + 140}, ${cx} ${cy + 136} C ${cx + 64} ${cy + 140}, ${cx + 112} ${cy + 156}, ${cx + 116} ${cy + 214} L ${cx + 118} ${cy + 340}`, Object.assign({ strokeWidth: 4.4 }, hatch(CYF, 13))), LN(cx - 20, cy + 70, cx - 22, cy + 138, { strokeWidth: 4 }), LN(cx + 20, cy + 70, cx + 22, cy + 138, { strokeWidth: 4 }),
  P(`M ${cx - 64} ${cy - 24} L ${cx - 48} ${cy - 86} L ${cx - 24} ${cy - 52} L ${cx - 2} ${cy - 94} L ${cx + 22} ${cy - 54} L ${cx + 44} ${cy - 88} L ${cx + 64} ${cy - 24}`, { strokeWidth: 4, stroke: GD })];
draw(holoBody(540, 1260), 4.0, 1.6, { tOut: 15.1, tf: stTf });
draw([E(516, 1256, 9, 9, { fill: WH, fillStyle: 'solid', strokeWidth: 2 }), E(564, 1256, 9, 9, { fill: WH, fillStyle: 'solid', strokeWidth: 2 }), LN(524, 1296, 556, 1296, { strokeWidth: 3.4 })], 5.6, .5, { tOut: 11.5, tf: stTf });

// ---------- S2 tests (9.4 - 15.1) ----------
text('Your tests.', 540, 420, 118, 9.5, 0.9, { tOut: 15.1 });
const fan = [-40, -24, -8, 8, 24, 40], PV = [540, 1420];
fan.forEach((a, i) => {
  draw([R(465, 720, 150, 230, { fill: '#08203a', fillStyle: 'solid', strokeWidth: 3.6 }), LN(490, 770, 590, 770, { strokeWidth: 2.4 }), LN(490, 796, 560, 796, { strokeWidth: 2.4 })]
    .concat([0, 1, 2, 3].map(k => E(500, 840 + k * 26, 11, 11, { strokeWidth: 2.2 })), [0, 1, 2, 3].map(k => LN(520, 840 + k * 26, 590 - k * 8, 840 + k * 26, { strokeWidth: 2 }))), 9.6 + i * 0.22, 0.55, { tOut: 15.1, tf: rot(a, PV[0], PV[1]) });
});
const cardPos = (a) => { const r = a * Math.PI / 180; return [PV[0] + 585 * Math.sin(r), PV[1] - 585 * Math.cos(r)]; };
[[1, 12.0], [4, 12.8]].forEach(([i, ts]) => {
  const a = fan[i], [px, py] = cardPos(a);
  live([R(465, 720, 150, 230, { stroke: RD, strokeWidth: 5, fill: 'rgba(255,77,106,.35)', fillStyle: 'solid' })], ts, { tOut: 15.1, tf: rot(a, PV[0], PV[1]), fx: (t, g) => g.setAttribute('opacity', .6 + .4 * Math.abs(Math.sin(t * 7))) });
  live([mk('circle', { cx: px, cy: py, r: 10, fill: 'none', stroke: RD, 'stroke-width': 4 })], ts, { tOut: 15.1, fx: (t, g) => { const ph = ((t - ts) % 1.1) / 1.1; g.firstChild.setAttribute('r', 20 + 120 * ph); g.firstChild.setAttribute('opacity', 1 - ph); } });
});
draw([E(516, 1256, 9, 9, { fill: WH, fillStyle: 'solid', strokeWidth: 2 }), E(564, 1256, 9, 9, { fill: WH, fillStyle: 'solid', strokeWidth: 2 }), LN(498, 1228, 530, 1236, { strokeWidth: 3.4 }), LN(582, 1236, 550, 1228, { strokeWidth: 3.4 }), P('M 524 1306 q 16 -14 32 0', { strokeWidth: 3.4 })], 11.6, .5, { tOut: 15.1, tf: stTf });
text('2 MISTAKES DETECTED', 540, 1075, 40, 12.9, 0.8, { font: 'Mono', color: RD, ls: 5, tOut: 15.1 });

// ---------- S3 mistakes -> engine (15.4 - 22.6) ----------
text('Your mistakes,', 540, 410, 104, 15.5, 0.9, { tOut: 22.6 });
text('decoded.', 540, 530, 120, 16.4, 0.8, { color: CY, tOut: 22.6 });
const CX = 540, CYY = 1020;
draw(ringsAt(CX, CYY, [70, 125, 185]), 15.6, 1.8, { tOut: 22.6, fx: (t, g) => g.setAttribute('transform', rot(-t * 55, CX, CYY)) });
draw([E(CX, CYY, 70, 70, { fill: 'rgba(255,193,90,.7)', fillStyle: 'solid', stroke: GD, strokeWidth: 4 })], 16.4, .6, { tOut: 22.6 });
live([mk('circle', { cx: CX, cy: CYY, r: 40, fill: 'none', stroke: GD, 'stroke-width': 3 })], 16.6, { tOut: 22.6, fx: (t, g) => { const ph = (t % 1.6) / 1.6; g.firstChild.setAttribute('r', 40 + 150 * ph); g.firstChild.setAttribute('opacity', .8 * (1 - ph)); } });
text('LEAD ENGINE', 540, 1290, 34, 16.8, .8, { font: 'Mono', color: GD, ls: 8, tOut: 22.6 });
const inCurves = [['M 270 680 C 270 840, 430 900, 480 990', 16.9], ['M 810 680 C 810 840, 650 900, 600 990', 17.2]];
inCurves.forEach(([d, ts], i) => {
  draw([R(210 + i * 540, 620, 120, 56, { stroke: RD, strokeWidth: 3.6 }), P(d, { stroke: RD, strokeWidth: 4 })], ts, 1.0, { tOut: 22.6 });
  text(i ? 'Q5' : 'Q2', 270 + i * 540, 660, 34, ts + .2, .4, { font: 'Mono', color: RD, tOut: 22.6 });
});
[['CONCEPT GAP', 1370, 18.2], ['RECALL SLIP', 1440, 19.3]].forEach(([s, y, ts]) => {
  draw([R(330, y - 40, 420, 56, { stroke: GD, strokeWidth: 3.2 })], ts, .6, { tOut: 22.6 });
  text(s, 540, y, 34, ts + .1, .6, { font: 'Mono', color: WH, ls: 5, tOut: 22.6 });
});

// ---------- S4 loop (22.8 - 29.0) ----------
text('One loop.', 540, 420, 124, 22.9, 0.9, { tOut: 29.0 });
const LX = 540, LY = 1000, LR = 320;
const node = (s, x, y, ts, col) => { draw([R(x - 130, y - 44, 260, 88, { stroke: col, strokeWidth: 4, ...hatch(col === GD ? 'rgba(255,193,90,.3)' : CYF2, 20) })], ts, .7, { tOut: 29.0 }); text(s, x, y + 12, 34, ts + .15, .6, { font: 'Disp', weight: 700, color: WH, ls: 2, tOut: 29.0 }); };
node('NOTES', LX, LY - LR, 23.3, CY); node('TESTS', LX + LR, LY, 23.7, CY); node('MISTAKES', LX, LY + LR, 24.1, RD); node('NEXT TEST', LX - LR, LY, 24.5, GD);
const arc = (a0, a1) => { const p = (a) => [LX + LR * Math.cos(a * Math.PI / 180), LY + LR * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M ${x0} ${y0} A ${LR} ${LR} 0 0 1 ${x1} ${y1}`; };
[[-62, -28, 24.0], [28, 62, 24.5], [118, 152, 25.0], [208, 242, 25.5]].forEach(([a, b, ts], i) => draw([P(arc(a, b), { stroke: GD, strokeWidth: 4 })], ts, .6, { tOut: 29.0 }));
text('It learns you.', 540, 1030, 92, 25.8, 1.0, { color: CY, tOut: 29.0 });
live([mk('circle', { r: 14, fill: GD })], 26.2, { tOut: 29.0, fx: (t, g) => { const a = (t * 120 - 90) * Math.PI / 180; g.firstChild.setAttribute('cx', LX + LR * Math.cos(a)); g.firstChild.setAttribute('cy', LY + LR * Math.sin(a)); } });

// ---------- S5 map (29.3 - 32.8) ----------
text('Your strengths.', 540, 410, 100, 29.4, 0.8, { tOut: 32.8 });
text('Your gaps. Mapped.', 540, 530, 100, 30.1, 0.9, { color: CY, tOut: 32.8 });
const cc = [GR, GD, RD, GR, GD, GR, GR, RD, GD, GR, RD, GD, GR, GR, GD, GR, GD, RD, GR, GR], cells = [];
for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) cells.push(R(180 + c * 185, 640 + r * 140, 165, 118, { stroke: CY, strokeWidth: 3, ...hatch(cc[r * 4 + c], 10, 3) }));
draw(cells, 29.5, 2.2, { tOut: 32.8 });
live([mk('rect', { x: 150, y: 0, width: 780, height: 24, fill: 'url(#beam)' })], 30.2, { tOut: 32.8, fx: (t, g) => g.setAttribute('transform', `translate(0 ${620 + 720 * clamp((t - 30.2) / 2.0)})`) });

// ---------- S6 end card (33.0 - 36.5) ----------
draw(ringsAt(540, 960, [430, 520, 610], true), 33.0, 1.5, { fx: (t, g) => g.setAttribute('transform', rot(t * 12, 540, 960)), tOut: 99 });
text('LEAD Prelims 2027', 540, 800, 126, 33.1, 1.0);
text('Notes. Tests.', 540, 950, 96, 34.0, 0.7, { color: CY });
text('One loop that learns you.', 540, 1060, 84, 34.5, 1.0);
text('leanprep.in/lead-prelims', 540, 1210, 52, 35.1, 0.9, { font: 'Mono', color: GD, ls: 2 });
draw([LN(250, 1240, 830, 1240, { stroke: GD, strokeWidth: 3.6 })], 35.5, .5);
text('Mains next.', 540, 1330, 66, 35.9, 0.6, { color: CY });
