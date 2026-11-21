// Cinematic 2D short film renderer: "Four powers, one pen" (Article 72). No voiceover.
// window.frame(t) draws one 1080x1920 SVG. CFG = {shots:[{id,t0,t1}], total}
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const outE = x => { x = clamp(x); return 1 - Math.pow(1 - x, 3); };
const inE = x => { x = clamp(x); return x * x * x; };
const rnd = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(t)))).join(',')})`; };
const rgba = (h, a) => { const x = hex(h); return `rgba(${x[0]},${x[1]},${x[2]},${a})`; };

let DEFS = [], UID = 0;
function lg(x1, y1, x2, y2, stops) {
  const id = 'g' + (UID++);
  DEFS.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] == null ? 1 : s[2]}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
}
function rg(cx, cy, r, stops) {
  const id = 'g' + (UID++);
  DEFS.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] == null ? 1 : s[2]}"/>`).join('')}</radialGradient>`);
  return `url(#${id})`;
}
const STATIC_DEFS = `
<filter id="b3" filterUnits="userSpaceOnUse" x="-300" y="-300" width="1700" height="2500"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="b8" filterUnits="userSpaceOnUse" x="-300" y="-300" width="1700" height="2500"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="b16" filterUnits="userSpaceOnUse" x="-300" y="-300" width="1700" height="2500"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="b40" filterUnits="userSpaceOnUse" x="-400" y="-400" width="1900" height="2700"><feGaussianBlur stdDeviation="40"/></filter>
<filter id="rough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
<filter id="ink" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".05 .9" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3"/></filter>
<pattern id="bricks" width="150" height="70" patternUnits="userSpaceOnUse"><rect width="150" height="70" fill="none"/><path d="M0 .5H150M0 35.5H150M0 0V35M75 35V70" stroke="#000" stroke-opacity=".55" stroke-width="2" fill="none"/></pattern>
<pattern id="wood" width="1080" height="46" patternUnits="userSpaceOnUse"><path d="M0 12C300 8 700 18 1080 11M0 30C300 34 700 26 1080 31" stroke="#000" stroke-opacity=".28" stroke-width="2" fill="none"/></pattern>
`;

// ---------- small building blocks ----------
function dust(lt, o) {
  const { n = 50, x0 = 0, x1 = W, y0 = 0, y1 = H, seed = 1, col = '#cfe0ff', freeze = 1e9, rise = 10, size = 3, alpha = .6 } = o;
  const tt = Math.min(lt, freeze); let s = '';
  for (let i = 0; i < n; i++) {
    const k = seed * 100 + i, r1 = rnd(k), r2 = rnd(k + .5), r3 = rnd(k + .9);
    const x = x0 + ((r1 * (x1 - x0) + Math.sin(tt * (.3 + r3) + k) * 24 + tt * (r3 - .5) * 14) % (x1 - x0) + (x1 - x0)) % (x1 - x0);
    const y = y0 + ((r2 * (y1 - y0) - tt * rise * (.4 + r3)) % (y1 - y0) + (y1 - y0)) % (y1 - y0);
    const tw = .5 + .5 * Math.sin(tt * (1 + r3 * 2) + k * 3);
    const rr = size * (.5 + r3 * 1.4);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rr.toFixed(1)}" fill="${col}" opacity="${(alpha * tw * (.3 + r3 * .7)).toFixed(2)}"/>`;
  }
  return `<g filter="url(#b3)">${s}</g>`;
}
function clockFace(cx, cy, r, h, m, sec, o = {}) {
  const { face = '#0c1420', ring = '#05080e', hand = '#d9e3f2', sc = '#ff4d3d', ticks = '#7e8ca3' } = o;
  let s = `<circle cx="${cx}" cy="${cy}" r="${r + 10}" fill="${ring}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}"/>`;
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, l = i % 3 ? .08 : .15;
    s += `<line x1="${cx + Math.sin(a) * r * .86}" y1="${cy - Math.cos(a) * r * .86}" x2="${cx + Math.sin(a) * r * (.86 - l)}" y2="${cy - Math.cos(a) * r * (.86 - l)}" stroke="${ticks}" stroke-width="${i % 3 ? 3 : 5}" stroke-linecap="round"/>`;
  }
  const ha = ((h % 12) + m / 60) * 30, ma = (m + sec / 60) * 6, sa = sec * 6;
  const hd = (a, l, w, c) => `<line x1="${cx - Math.sin(a * Math.PI / 180) * r * .1}" y1="${cy + Math.cos(a * Math.PI / 180) * r * .1}" x2="${cx + Math.sin(a * Math.PI / 180) * r * l}" y2="${cy - Math.cos(a * Math.PI / 180) * r * l}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  s += hd(ha, .5, 7, hand) + hd(ma, .76, 5, hand) + hd(sa, .82, 2.5, sc) + `<circle cx="${cx}" cy="${cy}" r="6" fill="${sc}"/>`;
  return s;
}
// word-by-word caption in screen space
function caption(text, lt, a, b, y, size, o = {}) {
  const { italic = false, col = '#FFF4E6', x = W / 2, anchor = 'middle', fam = 'Serif', sw = 0 } = o;
  const words = text.split(' ');
  const op = clamp((lt - a) / .35) * clamp((b - lt) / .35);
  if (op <= 0) return '';
  const font = `font-family:'${fam}';font-size:${size}px;${italic ? 'font-style:italic;' : ''}`;
  // approximate layout using canvas measure
  const cvx = caption.cv || (caption.cv = document.createElement('canvas').getContext('2d'));
  cvx.font = `${italic ? 'italic ' : ''}${size}px '${fam}'`;
  const sp = cvx.measureText(' ').width, ws = words.map(w => cvx.measureText(w).width);
  const tot = ws.reduce((p, c) => p + c, 0) + sp * (words.length - 1);
  let cx = anchor === 'middle' ? x - tot / 2 : x, s = '';
  words.forEach((w, i) => {
    const wp = clamp((lt - a - i * .13) / .4), e = outE(wp);
    s += `<text x="${cx.toFixed(1)}" y="${(y + (1 - e) * 22).toFixed(1)}" style="${font}" fill="${col}" opacity="${(e * op).toFixed(2)}">${esc(w)}</text>`;
    cx += ws[i] + sp;
  });
  return `<g style="paint-order:stroke" stroke="rgba(0,0,0,.55)" stroke-width="${sw}">${s}</g>`;
}
// folded manila file / paper
function paperShadow(x, y, w, h, rot) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-w / 2 + 14}" y="${-h / 2 + 30}" width="${w}" height="${h}" rx="6" fill="#000" opacity=".55" filter="url(#b16)"/></g>`;
}
function paperBody(w, h, lit) {
  const f = lg(-w / 2, -h / 2, w / 2, h / 2, [[0, lit.a], [1, lit.b]]);
  return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="5" fill="${f}"/><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="3" fill="#fff" opacity=".35"/>`;
}
// printed order content (local coords centred on 0,0; paper 600x800)
function orderLines(o = {}) {
  const { ink = '#2b2620', fade = 1 } = o; let s = '';
  s += `<text x="0" y="-320" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:21px;letter-spacing:5px" fill="${ink}">SESSIONS COURT · ORDER</text>`;
  s += `<rect x="-230" y="-296" width="460" height="3" fill="${ink}" opacity=".75"/>`;
  s += `<text x="-230" y="-250" style="font-family:'Sans';font-weight:600;font-size:23px" fill="${ink}">State  v.  ${esc(o.who || 'Arjun Rao')}</text>`;
  const L = [420, 380, 440, 300, 410, 350, 270];
  L.forEach((l, i) => { s += `<rect x="-230" y="${-200 + i * 36}" width="${l}" height="11" rx="3" fill="${ink}" opacity="${.22 * fade}"/>`; });
  return s;
}

// ---------- characters ----------
function manShapes(col, headUp, breath) {
  const b = 1 + .012 * breath;
  const arm = `<line x1="30" y1="-150" x2="-62" y2="-62" stroke="${col}" stroke-width="30" stroke-linecap="round"/><circle cx="-72" cy="-50" r="19" fill="${col}"/>`;
  const torso = `<path transform="scale(1 ${b})" d="M -15,-185 C 20,-206 72,-202 82,-170 C 102,-110 122,-50 114,0 L 30,0 C 20,-60 -5,-120 -15,-185 Z" fill="${col}"/>`;
  const legs = `<line x1="76" y1="-24" x2="-82" y2="-30" stroke="${col}" stroke-width="54" stroke-linecap="round"/><line x1="-82" y1="-30" x2="-98" y2="150" stroke="${col}" stroke-width="42" stroke-linecap="round"/><ellipse cx="-124" cy="166" rx="48" ry="17" fill="${col}"/>`;
  const head = `<g transform="rotate(${(headUp * 26).toFixed(1)} -10 -190)"><line x1="-8" y1="-186" x2="-30" y2="-216" stroke="${col}" stroke-width="30" stroke-linecap="round"/><circle cx="-46" cy="-228" r="41" fill="${col}"/></g>`;
  return legs + torso + arm + head;
}
function deskPerson(col, breath) {
  const b = 1 + .006 * breath;
  return `<g transform="translate(0 ${(-1 + b) * 600})"><path d="M 150,420 C 150,300 250,250 330,235 L 330,200 C 300,190 290,150 290,110 C 290,40 330,0 390,0 C 450,0 490,40 490,110 C 490,150 480,190 450,200 L 450,235 C 530,250 630,300 630,420 L 630,640 L 150,640 Z" fill="${col}"/></g>`;
}

// ---------- shots ----------
function shotCell(lt, d, o = {}) {
  const dawn = o.dawn == null ? 0 : (typeof o.dawn === 'function' ? o.dawn(lt) : o.dawn);
  const headUp = o.headUp ? o.headUp(lt) : 0;
  const c = (a, b) => mixc(a, b, dawn);
  const light = c('#a7c8ff', '#ffb25c'), lightHex = dawn > .5 ? '#ffb25c' : '#a7c8ff';
  let s = '';
  s += `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, c('#0b1628', '#3a2113')], [.7, c('#060b14', '#1a0e08')], [1, c('#02040a', '#0b0604')]])}"/>`;
  s += `<rect width="${W}" height="1340" fill="url(#bricks)" opacity=".16"/>`;
  s += `<ellipse cx="810" cy="400" rx="360" ry="420" fill="${rg(810, 400, 380, [[0, light, .55], [1, light, 0]])}" filter="url(#b40)"/>`;
  s += `<polygon points="690,530 930,530 520,1560 -90,1560" fill="${lg(810, 530, 300, 1500, [[0, light, .46 + .04 * Math.sin(lt * 2.1)], [1, light, 0]])}" filter="url(#b16)"/>`;
  s += `<rect x="690" y="230" width="240" height="300" fill="${c('#d6e6ff', '#ffd9a6')}"/>`;
  for (let i = 0; i < 5; i++) s += `<rect x="${704 + i * 52}" y="230" width="14" height="300" fill="#04070c"/>`;
  s += `<rect x="690" y="372" width="240" height="12" fill="#04070c"/><rect x="684" y="224" width="252" height="312" fill="none" stroke="#04070c" stroke-width="14"/>`;
  s += `<rect y="1330" width="${W}" height="${H - 1330}" fill="${lg(0, 1330, 0, H, [[0, c('#0a111c', '#241309')], [1, c('#02040a', '#080403')]])}"/><rect y="1326" width="${W}" height="8" fill="#000" opacity=".5"/>`;
  s += `<ellipse cx="330" cy="1610" rx="360" ry="86" fill="${light}" opacity="${.12 + .02 * Math.sin(lt * 2)}" filter="url(#b40)"/>`;
  // wall clock + tallies
  const hh = dawn > .5 ? 6 : 11, mm = dawn > .5 ? 0 : 40;
  s += `<g opacity=".95">${clockFace(200, 520, 78, hh, mm, Math.floor(lt) % 60, { face: c('#0d1522', '#1f150d'), hand: c('#cfd9ea', '#f2dcc0') })}</g>`;
  for (let g = 0; g < 3; g++) {
    const gx = 90 + g * 74, gy = 760;
    for (let k = 0; k < 4; k++) s += `<line x1="${gx + k * 11}" y1="${gy}" x2="${gx + k * 11}" y2="${gy + 52}" stroke="${c('#7686a2', '#b99a76')}" stroke-width="3" opacity=".55" stroke-linecap="round"/>`;
    s += `<line x1="${gx - 5}" y1="${gy + 40}" x2="${gx + 44}" y2="${gy + 12}" stroke="${c('#7686a2', '#b99a76')}" stroke-width="3" opacity=".55" stroke-linecap="round"/>`;
  }
  // cot
  const dark = c('#04060b', '#0b0705');
  s += `<ellipse cx="420" cy="1470" rx="380" ry="34" fill="#000" opacity=".5" filter="url(#b8)"/>`;
  s += `<rect x="70" y="1255" width="690" height="34" rx="6" fill="${dark}"/><rect x="100" y="1289" width="24" height="176" fill="${dark}"/><rect x="706" y="1289" width="24" height="176" fill="${dark}"/>`;
  const br = Math.sin(lt * 1.5);
  s += `<g transform="translate(${438} ${1252}) scale(1.38)" opacity=".9">${manShapes(c('#8fb4ff', '#ffc27d'), headUp, br)}</g>`;
  s += `<g transform="translate(${430} ${1255}) scale(1.38)">${manShapes(dark, headUp, br)}</g>`;
  s += dust(lt, { n: 60, x0: 0, x1: 960, y0: 520, y1: 1520, seed: 3, col: light, size: 2.6, alpha: .8, rise: 7 });
  const z = o.zoom ? o.zoom(lt, d) : lerp(1, 1.14, ease(lt / d));
  return { svg: s, cam: { z, cx: 470, cy: 1180, fx: 540, fy: 1100 } };
}

function shotPetition(lt, d) {
  let s = '';
  s += `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, '#1a110a'], [1, '#07040a']])}"/>`;
  s += `<rect width="${W}" height="${H}" fill="url(#wood)" opacity=".55"/>`;
  s += `<ellipse cx="260" cy="260" rx="760" ry="900" fill="${rg(260, 260, 800, [[0, '#ffb25c', .55], [1, '#ffb25c', 0]])}" filter="url(#b40)"/>`;
  const slide = ease((lt - 3.35) / .6);
  const px = 540 - slide * 1250, py = 940 + slide * 160, rot = -2.5 - slide * 14;
  s += paperShadow(px, py, 640, 860, rot);
  const lines = ['MERCY PETITION', '', 'To,', 'The President of India', '', 'Under Article 72,', 'I seek mercy.'];
  const all = lines.join('\n'), cps = 26, t0 = .5;
  const n = Math.floor(clamp((lt - t0) * cps, 0, all.length));
  const shown = all.slice(0, n).split('\n');
  let txt = '';
  shown.forEach((ln, i) => {
    const sz = i === 0 ? 40 : 34;
    txt += `<text x="-250" y="${-300 + i * 60}" xml:space="preserve" style="font-family:'DejaVu Sans Mono';font-weight:${i === 0 ? 700 : 400};font-size:${sz}px" fill="#2a2118">${esc(ln)}${(i === shown.length - 1 && n < all.length) ? '<tspan fill="#2a2118" opacity=".7">▌</tspan>' : ''}</text>`;
  });
  const sig = clamp((lt - 3.0) / .4);
  const stamp = clamp((lt - 3.05) / .12), sSc = lerp(2.0, 1, outE(stamp)), sOp = stamp > 0 ? 1 : 0;
  const shake = lt > 3.05 && lt < 3.3 ? (rnd(Math.floor(lt * 60)) - .5) * 14 * (1 - (lt - 3.05) / .25) : 0;
  s += `<g transform="translate(${(px + shake).toFixed(1)} ${(py + shake * .6).toFixed(1)}) rotate(${rot.toFixed(2)})">${paperBody(640, 860, { a: '#f2e9d3', b: '#d9ccb0' })}${txt}
  <text x="40" y="150" style="font-family:'Serif';font-style:italic;font-size:52px" fill="#1d2a4d" opacity="${sig}">Arjun Rao</text>
  <g opacity="${sOp}" transform="translate(110 250) rotate(-13) scale(${sSc})" filter="url(#ink)"><rect x="-150" y="-48" width="300" height="96" rx="8" fill="none" stroke="#c0281d" stroke-width="7"/><text x="0" y="22" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:56px;letter-spacing:4px" fill="#c0281d">RECEIVED</text></g></g>`;
  s += `<ellipse cx="540" cy="1100" rx="700" ry="1000" fill="${rg(540, 1100, 1000, [[.55, '#000', 0], [1, '#000', .55]])}"/>`;
  s += dust(lt, { n: 40, seed: 7, col: '#ffcf8f', size: 2.4, alpha: .7, rise: 6 });
  return { svg: s, cam: { z: lerp(1.0, 1.08, ease(lt / d)), cx: 540, cy: 900, fx: 540, fy: 940 } };
}

function shotDesk(lt, d) {
  let s = '';
  s += `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, '#0c1830'], [.55, '#081019'], [1, '#05070c']])}"/>`;
  for (let i = 0; i < 6; i++) s += `<rect x="${30 + i * 190}" y="60" width="150" height="1120" fill="#000" opacity="${i % 2 ? .13 : .06}"/>`;
  s += `<ellipse cx="810" cy="420" rx="340" ry="520" fill="${rg(810, 420, 420, [[0, '#9fc4ff', .5], [1, '#9fc4ff', 0]])}" filter="url(#b40)"/>`;
  s += `<rect x="660" y="140" width="300" height="640" fill="#bcd7ff" opacity=".92"/><rect x="654" y="134" width="312" height="652" fill="none" stroke="#04070c" stroke-width="16"/><rect x="805" y="140" width="14" height="640" fill="#04070c"/><rect x="660" y="330" width="300" height="12" fill="#04070c"/><rect x="660" y="540" width="300" height="12" fill="#04070c"/>`;
  s += `<polygon points="660,780 960,780 760,1330 260,1330" fill="${lg(810, 780, 520, 1330, [[0, '#9fc4ff', .26], [1, '#9fc4ff', 0]])}" filter="url(#b16)"/>`;
  const sec = lt + 9.2; // keep ticking in sync with global time
  s += clockFace(200, 430, 100, 11, 58, Math.floor(sec) % 60, {});
  // president
  const br = Math.sin(lt * 1.3);
  s += `<g transform="translate(162 660)" opacity=".8">${''}</g>`;
  s += `<g transform="translate(168 640)"><rect x="170" y="-10" width="460" height="650" rx="90" fill="#07101c"/></g>`;
  s += `<g transform="translate(176 628)" opacity=".85">${deskPerson('#9cc2ff', br)}</g>`;
  s += `<g transform="translate(158 632)" opacity=".7">${deskPerson('#ffb25c', br)}</g>`;
  s += `<g transform="translate(168 640)">${deskPerson('#03060a', br)}</g>`;
  // desk
  s += `<rect y="1240" width="${W}" height="${H - 1240}" fill="${lg(0, 1240, 0, H, [[0, '#2a1a10'], [1, '#0a0605']])}"/><rect y="1240" width="${W}" height="${H - 1240}" fill="url(#wood)" opacity=".7"/>`;
  s += `<rect y="1236" width="${W}" height="8" fill="#ffb25c" opacity=".6"/>`;
  s += `<polygon points="110,1190 200,1190 560,1750 -260,1750" fill="${lg(155, 1190, 300, 1750, [[0, '#ffb25c', .55], [1, '#ffb25c', 0]])}" filter="url(#b16)"/>`;
  s += `<ellipse cx="300" cy="1580" rx="420" ry="190" fill="${rg(300, 1580, 440, [[0, '#ffb25c', .5], [1, '#ffb25c', 0]])}" filter="url(#b16)"/>`;
  s += `<rect x="143" y="1205" width="24" height="40" fill="#000"/><ellipse cx="155" cy="1245" rx="60" ry="14" fill="#000"/><path d="M 95,1190 L 215,1190 L 190,1110 L 120,1110 Z" fill="#c07a1a"/><rect x="105" y="1186" width="100" height="10" fill="#ffd9a0"/>`;
  // four files
  [-16, -6, 6, 16].forEach((a, i) => {
    s += `<g transform="translate(600 1620) rotate(${a} 0 280)"><rect x="-160" y="-240" width="320" height="440" rx="8" fill="#000" opacity=".5" filter="url(#b8)" transform="translate(10 16)"/><rect x="-160" y="-240" width="320" height="440" rx="8" fill="${['#b58f55', '#c4a066', '#ad8650', '#caa972'][i]}"/><rect x="-160" y="-240" width="320" height="6" fill="#fff" opacity=".25"/><rect x="${-120 + i * 52}" y="-262" width="80" height="26" rx="6" fill="${['#9c3b2f', '#b0782a', '#4b7a52', '#4670a3'][i]}"/><text x="${-80 + i * 52}" y="-242" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:20px" fill="#fff4e0">${i + 1}</text></g>`;
  });
  // hand + pen hovering
  const hov = Math.sin(lt * 3.1) * 6, tx = Math.sin(lt * 9) * 1.5;
  const penx = 640 + hov, peny = 1470 + Math.cos(lt * 2.4) * 8;
  s += `<line x1="930" y1="1270" x2="${penx + 70}" y2="${peny - 70}" stroke="#04070b" stroke-width="64" stroke-linecap="round"/><ellipse cx="${penx + 54 + tx}" cy="${peny - 54}" rx="46" ry="34" fill="#04070b" transform="rotate(-38 ${penx + 54} ${peny - 54})"/><line x1="${penx + 60}" y1="${peny - 60}" x2="${penx}" y2="${peny}" stroke="#f0d27a" stroke-width="14" stroke-linecap="round"/><line x1="${penx + 8}" y1="${peny - 8}" x2="${penx - 2}" y2="${peny + 2}" stroke="#222" stroke-width="12" stroke-linecap="round"/>`;
  s += dust(lt, { n: 50, seed: 11, col: '#ffd7a0', size: 2.4, alpha: .6, rise: 5, y0: 300, y1: 1500 });
  const beat = Math.max(0, Math.sin(lt * Math.PI * 2 * 1.1)) ** 6;
  return { vig: .5 + .2 * beat, svg: s, cam: { z: lerp(1.0, 1.34, ease(lt / d)), cx: lerp(540, 600, ease(lt / d)), cy: lerp(1100, 1470, ease(lt / d)), fx: 540, fy: lerp(960, 1000, ease(lt / d)) }, over: caption(['One night.', 'Four powers.', 'One pen.'][lt < 1.55 ? 0 : lt < 2.7 ? 1 : 2], lt - (lt < 1.55 ? 0 : lt < 2.7 ? 1.55 : 2.7), .1, lt < 1.55 ? 1.5 : lt < 2.7 ? 1.1 : 1.5, 1080, 118, { italic: true, sw: 12 }) };
}

// common "file on the desk" stage for the four powers
function deskStage(lt, tone, extra) {
  let s = '';
  s += `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, tone.bgT], [1, tone.bgB]])}"/><rect width="${W}" height="${H}" fill="url(#wood)" opacity=".5"/>`;
  s += `<ellipse cx="300" cy="300" rx="900" ry="1000" fill="${rg(300, 300, 900, [[0, tone.lamp, tone.la || .5], [1, tone.lamp, 0]])}" filter="url(#b40)"/>`;
  return s;
}
function titleBlock(idx, name, sub, lt, subAt, col) {
  let s = `<text x="540" y="238" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:26px;letter-spacing:8px" fill="${col}" opacity="${clamp(lt / .3) * .9}">${idx} / 4</text>`;
  s += caption(name, lt, .15, 99, 372, 148, { col: '#FFF4E6', sw: 8 });
  s += caption(sub, lt, subAt, 99, 1470, 58, { italic: true, col: '#FFF4E6', sw: 6 });
  return s;
}

function shotReprieve(lt, d) {
  const frz = 2.75, tone = { bgT: '#10192b', bgB: '#05070c', lamp: lt > frz ? '#9fd6ff' : '#ffb25c' };
  let s = deskStage(lt, tone);
  const f = lt > frz;
  // stopwatch
  const cx = 540, cy = 690, R = 190, remain = Math.max(1.2, 6 - Math.min(lt, frz) * 1.8);
  s += `<circle cx="${cx}" cy="${cy}" r="${R + 22}" fill="#05080e"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="#0b1220"/><circle cx="${cx}" cy="${cy}" r="${R - 26}" fill="none" stroke="#1c2a44" stroke-width="12"/>`;
  const frac = clamp(remain / 6);
  s += `<circle cx="${cx}" cy="${cy}" r="${R - 26}" fill="none" stroke="${f ? '#9fd6ff' : '#ff6a3d'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * (R - 26) * frac).toFixed(1)} 9999" transform="rotate(-90 ${cx} ${cy})"/>`;
  s += `<text x="${cx}" y="${cy + 24}" text-anchor="middle" style="font-family:'DejaVu Sans Mono';font-weight:700;font-size:78px" fill="${f ? '#d6efff' : '#ffd9c2'}">00:0${Math.floor(remain)}</text>`;
  s += `<text x="${cx}" y="${cy - 82}" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:20px;letter-spacing:6px" fill="#7e8ca3">DAWN</text>`;
  s += `<rect x="${cx - 18}" y="${cy - R - 54}" width="36" height="34" rx="6" fill="#05080e"/>`;
  // order paper
  const py = 1210, rot = -1.5;
  s += paperShadow(540, py, 560, 640, rot);
  s += `<g transform="translate(540 ${py}) rotate(${rot})">${paperBody(560, 640, { a: '#efe6d0', b: '#d3c6aa' })}<g transform="scale(.85) translate(0 40)">${orderLines({ who: 'File 1' })}</g>
  <text x="-215" y="165" style="font-family:'Sans';font-weight:700;font-size:20px;letter-spacing:4px" fill="#5b5346">SENTENCE</text><text x="-215" y="228" style="font-family:'Sans';font-weight:700;font-size:70px" fill="#b4261c">DEATH</text></g>`;
  // stay stamp
  const st = clamp((lt - 3.1) / .12);
  if (st > 0) s += `<g transform="translate(560 1250) rotate(-10) scale(${lerp(2, 1, outE(st))})" filter="url(#ink)"><rect x="-190" y="-58" width="380" height="116" rx="8" fill="rgba(10,30,60,.0)" stroke="#2c6fb7" stroke-width="8"/><text x="0" y="26" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:74px;letter-spacing:6px" fill="#2c6fb7">STAYED</text></g>`;
  if (lt > frz && lt < frz + .25) s += `<rect width="${W}" height="${H}" fill="#cfeaff" opacity="${(1 - (lt - frz) / .25) * .55}"/>`;
  s += dust(lt, { n: 55, seed: 21, col: f ? '#bfe6ff' : '#ffd7a0', size: 2.6, alpha: .7, rise: 8, freeze: frz });
  return { svg: s, cam: { z: lerp(1.0, 1.1, ease(lt / d)), cx: 540, cy: 1000, fx: 540, fy: 1000 - (f ? 0 : 0) }, over: titleBlock(1, 'REPRIEVE', 'Stays the sentence for a time.', lt, 3.35, '#ffcf9a') };
}

function shotCommute(lt, d) {
  const sw = ease((lt - 2.2) / .8); // 0 red -> 1 cold
  const tone = { bgT: mixc('#2a0d0a', '#0c1a2e', sw), bgB: '#05070c', lamp: sw > .5 ? '#9fc4ff' : '#ff6a3d' };
  let s = deskStage(lt, tone);
  const py = 1010, rot = -1.2;
  s += paperShadow(540, py, 600, 800, rot);
  s += `<g transform="translate(540 ${py}) rotate(${rot})">${paperBody(600, 800, { a: '#f0e7d2', b: '#d2c5a9' })}${orderLines({ who: 'Arjun Rao' })}
  <text x="-230" y="130" style="font-family:'Sans';font-weight:700;font-size:21px;letter-spacing:5px" fill="#5b5346">SENTENCE</text>`;
  const dOp = 1 - clamp((lt - 2.0) / .5), nOp = clamp((lt - 2.3) / .8);
  s += `<text x="-230" y="225" style="font-family:'Sans';font-weight:700;font-size:112px" fill="#b4261c" opacity="${dOp.toFixed(2)}" ${lt > 2.0 ? 'filter="url(#b3)"' : ''}>DEATH</text>`;
  const sk = clamp((lt - 1.0) / .7);
  if (sk > 0 && dOp > 0) s += `<line x1="-250" y1="190" x2="${(-250 + 470 * sk).toFixed(1)}" y2="${(190 - 14 * sk).toFixed(1)}" stroke="#7a1810" stroke-width="12" stroke-linecap="round" opacity="${dOp}" filter="url(#ink)"/>`;
  s += `<text x="-230" y="190" style="font-family:'Sans';font-weight:700;font-size:64px" fill="#14304f" opacity="${nOp.toFixed(2)}">LIFE</text><text x="-230" y="270" style="font-family:'Sans';font-weight:700;font-size:56px" fill="#14304f" opacity="${nOp.toFixed(2)}">IMPRISONMENT</text></g>`;
  // pen
  if (sk > 0 && sk < 1) { const px = 540 - 250 + 470 * sk + 26, py2 = 1010 + 190 - 400 - 14 * sk + 400; s += `<g transform="translate(${px} ${py2 - 30}) rotate(-35)"><rect x="-6" y="-120" width="14" height="120" rx="6" fill="#e7c35d"/><rect x="-6" y="-120" width="14" height="30" rx="6" fill="#111"/></g>`; }
  // cell-bar shadows fall across paper as the tone turns cold
  if (sw > 0) for (let i = 0; i < 6; i++) s += `<rect x="${60 + i * 180}" y="0" width="46" height="${H}" fill="#000" opacity="${.38 * sw}" filter="url(#b16)" transform="skewX(-6)"/>`;
  s += dust(lt, { n: 55, seed: 31, col: sw > .5 ? '#bcd6ff' : '#ffb089', size: 2.6, alpha: .7, rise: 8 });
  return { svg: s, cam: { z: lerp(1.0, 1.12, ease(lt / d)), cx: 540, cy: 1010, fx: 540, fy: 1010 }, over: titleBlock(2, 'COMMUTATION', 'Death becomes imprisonment: the kind changes.', lt, 3.3, sw > .5 ? '#a9c8ff' : '#ff9d7a') };
}

function shotRemit(lt, d) {
  const tone = { bgT: '#0f1d17', bgB: '#05070a', lamp: '#ffd27a' };
  let s = deskStage(lt, tone);
  const py = 1030, rot = -1.4;
  s += paperShadow(540, py, 600, 780, rot);
  const cut = clamp((lt - 1.7) / .9), flipA = clamp((lt - 2.3) / .25);
  s += `<g transform="translate(540 ${py}) rotate(${rot})">${paperBody(600, 780, { a: '#f0e8d3', b: '#d4c8ac' })}${orderLines({ who: 'File 3', fade: .8 })}
  <text x="-230" y="75" style="font-family:'Sans';font-weight:700;font-size:21px;letter-spacing:5px" fill="#5b5346">SENTENCE</text>
  <text x="-230" y="165" style="font-family:'Sans';font-weight:700;font-size:92px" fill="#26231d" opacity="${(1 - flipA).toFixed(2)}">2 YEARS</text>
  <text x="-230" y="165" style="font-family:'Sans';font-weight:700;font-size:92px" fill="#26231d" opacity="${flipA.toFixed(2)}">1 YEAR</text>
  <text x="-230" y="232" style="font-family:'Sans';font-weight:700;font-size:34px;letter-spacing:1px" fill="#9a6b00">RIGOROUS IMPRISONMENT</text>`;
  // 24 month blocks
  for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) {
    const k = r * 12 + i, bx = -230 + i * 39, by = 275 + r * 62;
    if (r === 1) {
      const t0 = 1.7 + i * .035; const gone = clamp((lt - t0) / .5);
      if (gone >= 1) continue;
      s += `<rect x="${bx}" y="${(by - gone * 120 * (rnd(k) + .4)).toFixed(1)}" width="32" height="46" rx="5" fill="#d99a14" opacity="${(1 - gone).toFixed(2)}" transform="rotate(${(gone * (rnd(k) - .5) * 90).toFixed(1)} ${bx + 16} ${by + 26})"/>`;
    } else s += `<rect x="${bx}" y="${by}" width="32" height="46" rx="5" fill="#d99a14"/>`;
  }
  s += `<text x="-230" y="378" style="font-family:'Sans';font-weight:600;font-size:17px;letter-spacing:3px" fill="#6f6755">24 MONTHS → ${cut > .95 ? '12' : '24'} MONTHS</text></g>`;
  // sparks
  for (let i = 0; i < 40; i++) { const t0 = 1.7 + (i % 12) * .035, g = clamp((lt - t0) / 1.2); if (g > 0 && g < 1) s += `<circle cx="${540 - 230 + (i % 12) * 39 + 16 + (rnd(i) - .5) * 80 * g}" cy="${py + 275 + 62 - 400 + 23 - g * 260 * (rnd(i + 3) + .3)}" r="${3 * (1 - g) + 1}" fill="#ffd27a" opacity="${(1 - g)}" filter="url(#b3)"/>`; }
  s += dust(lt, { n: 55, seed: 41, col: '#ffe7a8', size: 2.6, alpha: .7, rise: 8 });
  return { svg: s, cam: { z: lerp(1.0, 1.12, ease(lt / d)), cx: 540, cy: 1030, fx: 540, fy: 1030 }, over: titleBlock(3, 'REMISSION', 'Same kind. Shorter length.', lt, 3.2, '#ffe39a') };
}

function shotPardon(lt, d) {
  const w = ease((lt - 1.3) / 1.3);
  const tone = { bgT: mixc('#111827', '#2a2a30', w), bgB: '#05070a', lamp: '#fff1d6', la: .5 + .3 * w };
  let s = deskStage(lt, tone);
  const py = 1030, rot = -1.2;
  s += paperShadow(540, py, 600, 780, rot);
  const wipeY = lerp(-420, 420, w);
  s += `<defs><clipPath id="keep"><rect x="-320" y="${wipeY}" width="640" height="900"/></clipPath></defs>`;
  s += `<g transform="translate(540 ${py}) rotate(${rot})">${paperBody(600, 780, { a: '#f2ead6', b: '#d6cab0' })}<g clip-path="url(#keep)">${orderLines({ who: 'File 4' })}
  <text x="-230" y="75" style="font-family:'Sans';font-weight:700;font-size:21px;letter-spacing:5px" fill="#5b5346">SENTENCE</text><text x="-230" y="160" style="font-family:'Sans';font-weight:700;font-size:80px" fill="#26231d">7 YEARS</text>
  <g transform="translate(70 250) rotate(-9)" filter="url(#ink)"><rect x="-190" y="-52" width="380" height="104" rx="8" fill="none" stroke="#b4261c" stroke-width="7"/><text x="0" y="24" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:60px;letter-spacing:4px" fill="#b4261c">CONVICTED</text></g></g>
  <rect x="-300" y="${(wipeY - 30).toFixed(1)}" width="600" height="60" fill="${lg(0, wipeY - 30, 0, wipeY + 30, [[0, '#fff', 0], [.5, '#fff', .95], [1, '#fff', 0]])}" opacity="${w > 0 && w < 1 ? 1 : 0}" filter="url(#b8)"/></g>`;
  // rising motes from the wipe
  for (let i = 0; i < 60; i++) { const g = clamp((lt - 1.3 - rnd(i) * 1.3) / 1.6); if (g > 0 && g < 1) s += `<circle cx="${280 + rnd(i + 5) * 520}" cy="${py - 300 + rnd(i + 9) * 600 - g * 420}" r="${2 + rnd(i + 2) * 4}" fill="#fff2cf" opacity="${(1 - g) * .9}" filter="url(#b3)"/>`; }
  s += dust(lt, { n: 55, seed: 51, col: '#fff0cf', size: 2.6, alpha: .7, rise: 9 });
  return { svg: s, cam: { z: lerp(1.0, 1.12, ease(lt / d)), cx: 540, cy: 1030, fx: 540, fy: 1030 }, over: titleBlock(4, 'PARDON', 'Wipes out the conviction and the sentence.', lt, 3.4, '#fff0cf') };
}

function shotSign(lt, d) { // pen signs Arjun's order, stamp
  let s = deskStage(lt, { bgT: '#1b1410', bgB: '#05070a', lamp: '#ffb25c', la: .55 });
  const py = 1010;
  s += paperShadow(540, py, 600, 800, -1.2);
  const sg = clamp((lt - .2) / 1.0);
  const path = 'M -170 330 C -120 250 -90 380 -40 300 C 0 240 20 360 70 290 C 110 240 130 330 190 280 C 220 260 240 300 260 280';
  s += `<g transform="translate(540 ${py}) rotate(-1.2)">${paperBody(600, 800, { a: '#f0e7d2', b: '#d2c5a9' })}${orderLines({ who: 'Arjun Rao' })}
  <text x="-230" y="130" style="font-family:'Sans';font-weight:700;font-size:21px;letter-spacing:5px" fill="#5b5346">SENTENCE</text><text x="-230" y="190" style="font-family:'Sans';font-weight:700;font-size:64px" fill="#14304f">LIFE</text><text x="-230" y="270" style="font-family:'Sans';font-weight:700;font-size:56px" fill="#14304f">IMPRISONMENT</text>
  <text x="-230" y="352" style="font-family:'Sans';font-weight:600;font-size:20px;letter-spacing:3px" fill="#5b5346">PRESIDENT'S ORDER</text>
  <path d="${path}" fill="none" stroke="#12285a" stroke-width="7" stroke-linecap="round" stroke-dasharray="1000" stroke-dashoffset="${(1000 * (1 - sg)).toFixed(0)}" transform="translate(0 130)"/></g>`;
  const st = clamp((lt - 1.45) / .1);
  if (st > 0) s += `<g transform="translate(580 1330) rotate(-9) scale(${lerp(2.1, 1, outE(st))})" filter="url(#ink)"><rect x="-210" y="-58" width="420" height="116" rx="8" fill="none" stroke="#c0281d" stroke-width="8"/><text x="0" y="26" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:70px;letter-spacing:4px" fill="#c0281d">COMMUTED</text></g>`;
  s += dust(lt, { n: 40, seed: 61, col: '#ffd7a0', size: 2.4, alpha: .6 });
  return { svg: s, cam: { z: lerp(1.04, 1.12, ease(lt / d)), cx: 540, cy: 1060, fx: 540, fy: 1010 } };
}

function shotQuiz(lt, d) {
  let s = `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, '#0b1424'], [1, '#05070c']])}"/>`;
  for (let i = 0; i < 14; i++) s += `<circle cx="${rnd(i) * W}" cy="${rnd(i + 3) * H}" r="${40 + rnd(i + 6) * 120}" fill="${['#ffb25c', '#9fc4ff'][i % 2]}" opacity="${.05 + .05 * Math.sin(lt * .8 + i)}" filter="url(#b40)"/>`;
  s += `<text x="540" y="238" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:26px;letter-spacing:8px" fill="#ffcf9a" opacity="${clamp(lt / .3)}">UPSC PRELIMS · POLITY</text>`;
  const q = ['Which power cuts the length', 'of a sentence but keeps', 'its kind?'];
  q.forEach((ln, i) => { s += caption(ln, lt, .2 + i * .22, 99, 400 + i * 104, 92, { sw: 6 }); });
  const names = ['Pardon', 'Reprieve', 'Commutation', 'Remission'], ans = lt > 3.55 ? 3 : -1;
  names.forEach((n, i) => {
    const x = i % 2 ? 562 : 78, y = 800 + Math.floor(i / 2) * 250, e = outE((lt - 1.1 - i * .15) / .45);
    const win = ans === i, lose = ans >= 0 && !win;
    s += `<g transform="translate(${x} ${y + (1 - e) * 40})" opacity="${(e * (lose ? .3 : 1)).toFixed(2)}"><rect width="440" height="200" rx="26" fill="${win ? '#12351f' : '#0f1a2c'}" stroke="${win ? '#22C55E' : 'rgba(255,255,255,.18)'}" stroke-width="${win ? 5 : 2}"/><text x="42" y="118" style="font-family:'Sans';font-weight:700;font-size:48px" fill="#FFF4E6">${n}</text><text x="398" y="64" text-anchor="end" style="font-family:'Sans';font-weight:700;font-size:30px" fill="#8693AE">${'ABCD'[i]}</text>${win ? '<text x="398" y="168" text-anchor="end" style="font-family:\'Sans\';font-weight:700;font-size:64px" fill="#22C55E">✓</text>' : ''}</g>`;
  });
  // timer ring
  if (lt > 1.9 && lt < 3.55) { const f = clamp((lt - 1.9) / 1.65); s += `<g transform="translate(540 1440)"><circle r="64" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="10"/><circle r="64" fill="none" stroke="#ffb25c" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(402 * (1 - f)).toFixed(0)} 999" transform="rotate(-90)"/><text y="16" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:44px" fill="#FFF4E6">${Math.ceil(3 - f * 3)}</text></g>`; }
  s += caption('Remission trims the length.', lt, 3.7, 99, 1400, 64, { italic: true, sw: 6 });
  s += caption('Commutation changes the kind.', lt, 4.15, 99, 1480, 64, { italic: true, sw: 6 });
  return { svg: s, cam: { z: lerp(1.0, 1.03, ease(lt / d)), cx: 540, cy: 960, fx: 540, fy: 960 } };
}

function shotCta(lt, d) {
  let s = `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, '#0b1424'], [1, '#05070c']])}"/>`;
  s += `<ellipse cx="540" cy="900" rx="560" ry="560" fill="${rg(540, 900, 560, [[0, '#ffb25c', .25], [1, '#ffb25c', 0]])}" filter="url(#b40)"/>`;
  const e = outE(lt / .6);
  s += `<g opacity="${e}" transform="translate(0 ${(1 - e) * 30})"><circle cx="540" cy="580" r="130" fill="#FFF4E6"/><image href="logo.png" x="440" y="480" width="200" height="200" preserveAspectRatio="xMidYMid meet"/></g>`;
  s += caption('Free UPSC Prelims tests + notes', lt, .5, 99, 860, 76, { sw: 6 });
  s += caption('LEAD Prelims 2027', lt, .9, 99, 960, 60, { italic: true, col: '#ffcf9a', sw: 6 });
  const p = outE((lt - 1.3) / .5);
  s += `<g opacity="${p}" transform="translate(0 ${(1 - p) * 20})"><rect x="170" y="1050" width="740" height="120" rx="60" fill="#ff7a1a"/><text x="540" y="1128" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:48px" fill="#1a0f06">leanprep.in/lead-prelims</text></g>`;
  s += caption('A fictional story built on Article 72.', lt, 1.8, 99, 1290, 38, { italic: true, col: '#8693AE', sw: 0 });
  return { svg: s, cam: { z: 1, cx: 540, cy: 960, fx: 540, fy: 960 } };
}

const FN = { cell: (lt, d) => shotCell(lt, d, {}), petition: shotPetition, desk: shotDesk, reprieve: shotReprieve, commute: shotCommute, remit: shotRemit, pardon: shotPardon, sign: shotSign,
  dawn: (lt, d) => shotCell(lt, d, { dawn: l => ease(l / 1.4), headUp: l => ease((l - .6) / 1.2), zoom: (l, dd) => lerp(1.12, 1.02, ease(l / dd)) }), quiz: shotQuiz, cta: shotCta };
const TRANS = { cell: ['fade', .6], petition: ['cut', 0], desk: ['cut', 0], reprieve: ['flash', .25], commute: ['flash', .25], remit: ['flash', .25], pardon: ['flash', .25], sign: ['fade', .3], dawn: ['flash', .3], quiz: ['fade', .4], cta: ['fade', .3] };

window.events = () => [];
window.frame = function (t, dry) {
  DEFS = []; UID = 0;
  const sh = CFG.shots.find(x => t >= x.t0 && t < x.t1) || CFG.shots[CFG.shots.length - 1];
  const lt = t - sh.t0, d = sh.t1 - sh.t0;
  const r = FN[sh.id](lt, d);
  const k = r.cam, hs = Math.sin(t * 1.7) * 2.2 + Math.sin(t * 3.1) * 1.1, hy = Math.cos(t * 1.3) * 2 + Math.sin(t * 2.7) * 1, hr = Math.sin(t * .9) * .12;
  const z = k.z * 1.014;
  const tx = clamp(k.fx - k.cx * z, W - W * z, 0), ty = clamp(k.fy - k.cy * z, H - H * z, 0);
  const tf = `translate(540 960) rotate(${hr.toFixed(3)}) translate(-540 -960) translate(${(tx + hs).toFixed(2)} ${(ty + hy).toFixed(2)}) scale(${z.toFixed(4)})`;
  const [tk, td] = TRANS[sh.id];
  let ov = '';
  const p = td ? clamp(lt / td) : 1;
  if (tk === 'fade' && p < 1) ov += `<rect width="${W}" height="${H}" fill="#000" opacity="${(1 - p).toFixed(3)}"/>`;
  if (tk === 'flash' && p < 1) ov += `<rect width="${W}" height="${H}" fill="#fff" opacity="${((1 - p) * .75).toFixed(3)}"/>`;
  const out = clamp((sh.t1 - t) / .0001);
  const last = CFG.shots[CFG.shots.length - 1];
  if (sh === last) ov += `<rect width="${W}" height="${H}" fill="#000" opacity="${clamp((t - (sh.t1 - .5)) / .5).toFixed(3)}"/>`;
  const vg = r.vig == null ? .55 : r.vig;
  ov = `<rect width="${W}" height="${H}" fill="${rg(540, 980, 1180, [[.45, '#000', 0], [1, '#000', vg]])}"/>` + ov;
  document.getElementById('stage').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${STATIC_DEFS}${DEFS.join('')}</defs><rect width="${W}" height="${H}" fill="#02040a"/><g transform="${tf}">${r.svg}</g>${r.over || ''}${ov}</svg>`;
};
