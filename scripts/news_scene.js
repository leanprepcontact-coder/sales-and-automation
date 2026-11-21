// "News to Prelims question" reel (faceless, ~26 s, 1080x1920). window.frame(t) draws one SVG frame.
// Content comes from CFG.q = {hook1, hook2, tag, headline, hl:[words], question, options:[..4], answer:0-3, rules:[{k,v}], cta, url}
const W = 1080, H = 1920;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const outE = x => 1 - Math.pow(1 - clamp(x), 3);
const inOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const back = x => { x = clamp(x); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rnd = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const Q = CFG.q, T = CFG.times;
let DEFS = [], UID = 0;
const lg = (x1, y1, x2, y2, st) => { const id = 'g' + UID++; DEFS.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${st.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] == null ? 1 : s[2]}"/>`).join('')}</linearGradient>`); return `url(#${id})`; };
const rg = (cx, cy, r, st) => { const id = 'g' + UID++; DEFS.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${st.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}" stop-opacity="${s[2] == null ? 1 : s[2]}"/>`).join('')}</radialGradient>`); return `url(#${id})`; };
const STATIC = `<filter id="b40" filterUnits="userSpaceOnUse" x="-400" y="-400" width="1900" height="2700"><feGaussianBlur stdDeviation="60"/></filter><filter id="b16" filterUnits="userSpaceOnUse" x="-300" y="-300" width="1700" height="2500"><feGaussianBlur stdDeviation="18"/></filter>`;
const mvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
mvg.setAttribute('style', 'position:absolute;left:0;top:0;opacity:0;pointer-events:none');
const mtx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
mvg.appendChild(mtx); document.body.appendChild(mvg);
const MC = {};
function mw(t, size, fam, weight) {
  const key = fam + weight + size + '|' + t; if (MC[key] != null) return MC[key];
  mtx.setAttribute('style', `font-family:'${fam}';font-size:${size}px;font-weight:${weight || 400};white-space:pre`);
  mtx.textContent = t.replace(/ /g, '\u00a0'); return MC[key] = mtx.getComputedTextLength();
}
function wrap(text, size, maxW, fam, weight) {
  const out = []; let cur = '';
  for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (mw(t, size, fam, weight) > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); return out;
}
function bg(t) {
  let s = `<rect width="${W}" height="${H}" fill="${lg(0, 0, 0, H, [[0, '#0d1830'], [.6, '#070d1a'], [1, '#04060c']])}"/>`;
  const orbs = [['#ff7a1a', 220, 380, 420], ['#3b6bff', 860, 1100, 520], ['#ff7a1a', 760, 1700, 380]];
  orbs.forEach((o, i) => { s += `<circle cx="${o[1] + Math.sin(t * .35 + i * 2) * 60}" cy="${o[2] + Math.cos(t * .3 + i) * 70}" r="${o[3]}" fill="${o[0]}" opacity=".16" filter="url(#b40)"/>`; });
  for (let i = 0; i < 26; i++) { const x = rnd(i) * W, y = ((rnd(i + 9) * H - t * (12 + rnd(i + 3) * 22)) % H + H) % H; s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1.4 + rnd(i + 5) * 2.2).toFixed(1)}" fill="#dfe8ff" opacity="${(.12 + .25 * rnd(i + 7)).toFixed(2)}"/>`; }
  return s;
}
function chip(x, y, text, fill, ink, op, size = 26) {
  const w = mw(text, size, 'Sans', 700) + 48 + text.length * 2.4;
  return `<g opacity="${op}"><rect x="${x}" y="${y}" width="${w}" height="${size + 30}" rx="${(size + 30) / 2}" fill="${fill}"/><text x="${x + 24}" y="${y + size + 7}" style="font-family:'Sans';font-weight:700;font-size:${size}px;letter-spacing:2.4px" fill="${ink}">${esc(text)}</text></g>`;
}

window.events = () => [];
window.frame = function (t) {
  DEFS = []; UID = 0;
  let s = bg(t);

  // ---- A: hook
  const aOut = clamp((t - (T.card - .2)) / .35);
  if (t < T.card + .2) {
    const o = 1 - aOut, k1 = back((t - .1) / .45), k2 = back((t - .95) / .45);
    s += `<g opacity="${o}" transform="translate(0 ${-aOut * 60})">
      <text x="540" y="${(820 + (1 - k1) * 50).toFixed(1)}" text-anchor="middle" style="font-family:'Serif';font-size:176px" fill="#FFF4E6" opacity="${clamp(k1)}">${esc(Q.hook1)}</text>
      <text x="540" y="${(960 + (1 - k2) * 50).toFixed(1)}" text-anchor="middle" style="font-family:'Serif';font-style:italic;font-size:96px" fill="#ff9d4a" opacity="${clamp(k2)}">${esc(Q.hook2)}</text></g>`;
  }

  // ---- B: news card
  if (t >= T.card - .1 && t < T.q + .2) {
    const inn = back((t - T.card) / .6), out = inOut((t - (T.q - .35)) / .55);
    const y = 480 + (1 - inn) * 1000 - out * 1000, rot = (1 - inn) * -6;
    const lines = Q.headline_lines;
    const h = 230 + lines.length * 112 + 70;
    let words = '', ly = 0;
    lines.forEach((ln, li) => {
      let tsp = '';
      ln.split(' ').forEach((w, wi) => {
        const isHl = Q.hl.includes(w.replace(/[^A-Za-z]/g, '')), idx = li * 5 + wi;
        const a = outE((t - T.card - .5 - idx * .07) / .3), hlA = outE((t - (T.card + 1.7)) / .45);
        tsp += `<tspan opacity="${a.toFixed(2)}"${isHl ? ` data-hl="1" data-hla="${hlA.toFixed(3)}"` : ''}>${esc(w)}</tspan><tspan> </tspan>`;
      });
      words += `<text x="0" y="${ly + 98}" xml:space="preserve" style="font-family:'Serif';font-size:90px" fill="#1a1510">${tsp}</text>`;
      ly += 112;
    });
    s += `<g transform="translate(70 ${y.toFixed(1)}) rotate(${rot.toFixed(2)} 470 300)">
      <rect x="14" y="26" width="940" height="${h}" rx="30" fill="#000" opacity=".5" filter="url(#b16)"/>
      <rect width="940" height="${h}" rx="30" fill="#f5ecd8"/>
      <rect width="940" height="14" rx="7" fill="#ff7a1a"/>
      <text x="60" y="108" style="font-family:'Sans';font-weight:700;font-size:28px;letter-spacing:4px" fill="#8a6a3a">${esc(Q.tag)}</text>
      <rect x="60" y="130" width="820" height="3" fill="#1a1510" opacity=".25"/>
      <g transform="translate(70 170)">${words}</g></g>`;
    // tiny reading lines under card for texture
  }

  // ---- C: question + options
  if (t >= T.q - .1 && t < T.rule + .1) {
    const ci = clamp((t - T.q) / .5), co = clamp((t - (T.rule - .45)) / .45);
    const reveal = t >= T.ans, rv = outE((t - T.ans) / .35);
    const g = ci * (1 - co);
    s += `<g opacity="${g}">`;
    s += chip(70, 250, 'PRELIMS QUESTION', '#ff7a1a', '#1a0f06', 1);
    const ql = wrap(Q.question, 72, 690, 'Sans', 700);
    ql.forEach((ln, i) => { s += `<text x="70" y="${440 + i * 90}" style="font-family:'Sans';font-weight:700;font-size:72px" fill="#FFF4E6">${esc(ln)}</text>`; });
    // timer
    if (t >= T.opts && t < T.ans + .3) {
      const f = clamp((t - T.opts) / (T.ans - T.opts)), left = Math.max(1, Math.ceil((1 - f) * (T.ans - T.opts)));
      const op = 1 - clamp((t - T.ans) / .3), R = 52;
      s += `<g transform="translate(950 400)" opacity="${op}"><circle r="${R}" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="11"/><circle r="${R}" fill="none" stroke="#ff9d4a" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(2 * Math.PI * R * (1 - f)).toFixed(1)} 999" transform="rotate(-90)"/><text y="19" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:54px" fill="#FFF4E6">${left}</text></g>`;
    }
    const oy0 = 640 + (ql.length > 2 ? 90 : 0);
    Q.options.forEach((o, i) => {
      const e = back((t - T.opts + 0.3 - i * .22) / .45), win = i === Q.answer;
      const dim = reveal && !win ? 1 - .72 * rv : 1;
      const lines = wrap(o, 46, 770, 'Sans', 600);
      const y = oy0 + i * 214 + (1 - clamp(e)) * 60;
      s += `<g transform="translate(70 ${y.toFixed(1)})" opacity="${(clamp(e) * dim).toFixed(2)}">
        <rect width="940" height="190" rx="30" fill="${reveal && win ? '#0f3a22' : '#101c34'}" stroke="${reveal && win ? '#22C55E' : 'rgba(255,255,255,.16)'}" stroke-width="${reveal && win ? 6 : 2}"/>
        <rect x="28" y="${95 - 40}" width="80" height="80" rx="22" fill="${reveal && win ? '#22C55E' : 'rgba(255,255,255,.1)'}"/>
        <text x="68" y="${95 + 18}" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:46px" fill="${reveal && win ? '#04150b' : '#cfd9ee'}">${'ABCD'[i]}</text>
        ${lines.slice(0, 2).map((ln, li) => `<text x="130" y="${lines.length > 1 ? 86 + li * 58 : 108}" style="font-family:'Sans';font-weight:600;font-size:46px" fill="#FFF4E6">${esc(ln)}</text>`).join('')}
        ${reveal && win ? `<text x="900" y="100" text-anchor="end" style="font-family:'Sans';font-weight:700;font-size:78px" fill="#22C55E" transform="scale(${lerp(1.6, 1, rv)}) " opacity="${rv}"></text>` : ''}
      </g>`;
    });
    if (t >= T.opts && t < T.ans) s += `<text x="540" y="1640" text-anchor="middle" style="font-family:'Serif';font-style:italic;font-size:56px" fill="#ffcf9a" opacity="${outE((t - T.opts - 1) / .4)}">Comment your answer</text>`;
    if (reveal) s += `<text x="540" y="1640" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:50px" fill="#22C55E" opacity="${rv}">Answer: ${'ABCD'[Q.answer]}</text>`;
    s += `</g>`;
  }

  // ---- D: rule card
  if (t >= T.rule - .1 && t < T.cta + .2) {
    const ci = clamp((t - T.rule) / .5), co = clamp((t - (T.cta - .4)) / .4), g = ci * (1 - co);
    s += `<g opacity="${g}" transform="translate(0 ${(1 - ci) * 40})">`;
    s += chip(70, 330, 'REMEMBER THIS', '#22C55E', '#04150b', 1);
    Q.rules.forEach((r, i) => {
      const a = outE((t - T.rule - .35 - i * .9) / .5), y = 500 + i * 470;
      const vl = wrap(r.v, 50, 800, 'Sans', 600);
      s += `<g transform="translate(70 ${(y + (1 - a) * 50).toFixed(1)})" opacity="${a}"><rect width="940" height="410" rx="32" fill="#101c34" stroke="rgba(255,255,255,.14)" stroke-width="2"/><rect width="14" height="410" rx="7" fill="#ff7a1a"/>
        <text x="60" y="130" style="font-family:'Serif';font-size:112px" fill="#ffb25c">${esc(r.k)}</text>
        ${vl.map((ln, li) => `<text x="60" y="${215 + li * 62}" style="font-family:'Sans';font-weight:600;font-size:50px" fill="#FFF4E6">${esc(ln)}</text>`).join('')}</g>`;
    });
    s += `</g>`;
  }

  // ---- E: CTA
  if (t >= T.cta - .1) {
    const e = outE((t - T.cta) / .55), p = outE((t - T.cta - .7) / .5);
    s += `<g opacity="${e}"><circle cx="540" cy="620" r="140" fill="#FFF4E6"/><image href="logo.png" x="430" y="510" width="220" height="220" preserveAspectRatio="xMidYMid meet"/>
      <text x="540" y="920" text-anchor="middle" style="font-family:'Serif';font-size:92px" fill="#FFF4E6">${esc(Q.cta)}</text>
      <text x="540" y="1010" text-anchor="middle" style="font-family:'Serif';font-style:italic;font-size:58px" fill="#ffcf9a">${esc(Q.cta2)}</text></g>
      <g opacity="${p}" transform="translate(0 ${(1 - p) * 24})"><rect x="150" y="1100" width="780" height="124" rx="62" fill="#ff7a1a"/><text x="540" y="1180" text-anchor="middle" style="font-family:'Sans';font-weight:700;font-size:50px" fill="#1a0f06">${esc(Q.url)}</text></g>`;
  }

  // fades
  let ov = '';
  if (t < .3) ov += `<rect width="${W}" height="${H}" fill="#000" opacity="${1 - t / .3}"/>`;
  if (t > CFG.total - .5) ov += `<rect width="${W}" height="${H}" fill="#000" opacity="${clamp((t - (CFG.total - .5)) / .5)}"/>`;
  ov = `<rect width="${W}" height="${H}" fill="${rg(540, 980, 1250, [[.55, '#000', 0], [1, '#000', .45]])}"/>` + ov;
  const stage = document.getElementById('stage');
  stage.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${STATIC}${DEFS.join('')}</defs>${s}${ov}</svg>`;
  stage.querySelectorAll('tspan[data-hl]').forEach(ts => {
    const bb = ts.getBBox(), g = ts.parentNode.parentNode, hla = parseFloat(ts.getAttribute('data-hla'));
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', bb.x - 8); r.setAttribute('y', bb.y + bb.height * .1); r.setAttribute('width', (bb.width + 16) * hla);
    r.setAttribute('height', bb.height * .82); r.setAttribute('rx', 8); r.setAttribute('fill', '#ffb25c'); r.setAttribute('opacity', '.85');
    g.insertBefore(r, g.firstChild);
  });
};
