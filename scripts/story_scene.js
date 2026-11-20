// Cartoon story frame renderer. window.frame(t) draws the whole 1080x1920 frame as one SVG string.
// CFG = {tag, scenes:[{kind,t0,t1,...}], env:[mouth per frame at 24 fps], fps, total}
const W = 1080, H = 1920, FY = 300, FH = 1000; // cinematic frame window
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const back = x => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rnd = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function clock(cx, cy, r, minDeg, o = {}) {
  let s = `<g transform="translate(${cx},${cy})">`;
  s += `<circle r="${r + 14}" fill="#2B1B12"/><circle r="${r}" fill="#FFF6E5" stroke="#E8B04B" stroke-width="8"/>`;
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * Math.PI / 180;
    s += `<line x1="${Math.sin(a) * r * .84}" y1="${-Math.cos(a) * r * .84}" x2="${Math.sin(a) * r * .94}" y2="${-Math.cos(a) * r * .94}" stroke="#2B1B12" stroke-width="${i % 3 ? 5 : 9}" stroke-linecap="round"/>`;
  }
  s += `<line x1="0" y1="0" x2="0" y2="${-r * .52}" stroke="#2B1B12" stroke-width="12" stroke-linecap="round" transform="rotate(${minDeg / 12})"/>`;
  s += `<line x1="0" y1="0" x2="0" y2="${-r * .78}" stroke="#2B1B12" stroke-width="8" stroke-linecap="round" transform="rotate(${minDeg})"/>`;
  if (o.sec !== undefined) s += `<line x1="0" y1="14" x2="0" y2="${-r * .86}" stroke="#D7263D" stroke-width="4" transform="rotate(${o.sec})"/>`;
  s += `<circle r="12" fill="#D7263D"/></g>`;
  return s;
}

function chiku(x, y, sc, o) {
  const look = o.look || 0, mouth = o.mouth || 0, blink = o.blink ? 4 : 34, bob = o.bob || 0;
  const worry = o.mood === 'worry';
  let s = `<g transform="translate(${x},${y + bob}) scale(${sc})">`;
  s += `<ellipse cx="0" cy="190" rx="100" ry="16" fill="#000" opacity=".3"/>`;
  s += `<ellipse cx="-110" cy="70" rx="34" ry="78" fill="#B27439" transform="rotate(${14 + (o.flap || 0)} -110 70)"/>`;
  s += `<ellipse cx="110" cy="70" rx="34" ry="78" fill="#B27439" transform="rotate(${-14 - (o.flap || 0)} 110 70)"/>`;
  s += `<ellipse cx="0" cy="62" rx="108" ry="122" fill="#C98B4B"/><ellipse cx="0" cy="92" rx="68" ry="86" fill="#F3DDB5"/>`;
  for (let i = -1; i <= 1; i++) s += `<path d="M${i * 30 - 12} 70 q12 14 24 0" stroke="#D9B98B" stroke-width="5" fill="none"/>`;
  s += `<polygon points="-92,-110 -58,-170 -26,-126" fill="#B27439"/><polygon points="92,-110 58,-170 26,-126" fill="#B27439"/>`;
  s += `<circle cx="0" cy="-58" r="104" fill="#D49A57"/>`;
  [-1, 1].forEach(d => {
    s += `<ellipse cx="${d * 44}" cy="-64" rx="38" ry="${blink}" fill="#fff"/>`;
    if (!o.blink) s += `<circle cx="${d * 44 + look * 12}" cy="-62" r="19" fill="#161616"/><circle cx="${d * 44 + look * 12 + 6}" cy="-70" r="6" fill="#fff"/>`;
    s += `<line x1="${d * 44 - 30}" y1="${-112 + (worry ? d * 10 + 4 : 0)}" x2="${d * 44 + 30}" y2="${-112 + (worry ? -d * 10 + 4 : 0)}" stroke="#7A4A1C" stroke-width="7" stroke-linecap="round"/>`;
    s += `<circle cx="${d * 70}" cy="-22" r="13" fill="#F4A09A" opacity=".6"/>`;
  });
  s += `<polygon points="0,-44 -17,-20 17,-20" fill="#F59E0B"/>`;
  s += `<ellipse cx="0" cy="${-17 + mouth * 8}" rx="${12 + mouth * 3}" ry="${3 + mouth * 12}" fill="#B3541E"/>`;
  s += `<ellipse cx="-40" cy="190" rx="26" ry="10" fill="#F59E0B"/><ellipse cx="40" cy="190" rx="26" ry="10" fill="#F59E0B"/>`;
  if (worry) s += `<text x="118" y="-96" font-size="56" opacity="${.6 + .4 * Math.sin((o.t || 0) * 9)}">💧</text>`;
  return s + `</g>`;
}

function scarf(x0, y0, len, phase, o = {}) {
  if (len < 4) return '';
  let p = '';
  for (let x = 0; x <= len; x += 12) p += `${x ? 'L' : 'M'}${x0 + x} ${y0 + Math.sin(x / 55 + phase) * 22} `;
  const col = o.col || '#D7263D';
  let s = `<path d="${p}" stroke="#7E1020" stroke-width="64" fill="none" stroke-linecap="butt"/>`;
  s += `<path d="${p}" stroke="${col}" stroke-width="54" fill="none" stroke-linecap="butt"/>`;
  s += `<path d="${p}" stroke="#FFE9B8" stroke-width="10" fill="none" stroke-dasharray="26 34"/>`;
  const ex = x0 + len, ey = y0 + Math.sin(len / 55 + phase) * 22;
  for (let i = -3; i <= 3; i++) s += `<line x1="${ex}" y1="${ey + i * 8}" x2="${ex + 22}" y2="${ey + i * 8 + 2}" stroke="${col}" stroke-width="5"/>`;
  return s;
}

function hat(cx, cy, k) {
  return `<g transform="translate(${cx},${cy}) scale(${k})"><path d="M-120 0 A120 130 0 0 1 120 0 Z" fill="#D7263D"/><path d="M-120 0 A120 130 0 0 1 120 0" fill="none" stroke="#FFE9B8" stroke-width="10" stroke-dasharray="26 30" transform="translate(0,-34) scale(.78 .78)"/><rect x="-132" y="-8" width="264" height="46" rx="20" fill="#9C1B2D"/><circle cx="0" cy="-132" r="34" fill="#fff"/></g>`;
}

function emoji(ch, cx, cy, size, rot = 0) {
  return `<text x="${cx}" y="${cy + size * .35}" font-size="${size}" text-anchor="middle" transform="rotate(${rot} ${cx} ${cy})">${ch}</text>`;
}

function prop(kind, cx, cy, k, t, phase) {
  if (kind === 'scarf') return scarf(cx - 260, cy, 520 * k, phase);
  if (kind === 'hat') return hat(cx, cy + 40, k);
  return emoji(kind, cx, cy, 300 * k);
}

function card(text, x, y, rot, o = {}) {
  const w = o.w || 330, hgt = 84;
  return `<g transform="translate(${x},${y}) rotate(${rot})"><rect x="${-w / 2}" y="${-hgt / 2}" width="${w}" height="${hgt}" rx="18" fill="${o.fill || '#101826'}" stroke="${o.stroke || '#FF6B00'}" stroke-width="5"/><text x="0" y="14" text-anchor="middle" font-size="${o.fs || 44}" font-weight="700" fill="${o.col || '#fff'}">${esc(text)}</text></g>`;
}

function caption(lines, u) {
  let s = '';
  lines.forEach((ln, i) => {
    const a = clamp((u - i * 0.18) / 0.12);
    if (a <= 0) return;
    const y = 1440 + i * 96 + (1 - a) * 24;
    s += `<text x="540" y="${y}" text-anchor="middle" font-size="${ln.length > 26 ? 62 : 74}" font-weight="700" fill="#fff" stroke="#05080F" stroke-width="12" paint-order="stroke" opacity="${a}">${esc(ln)}</text>`;
  });
  return s;
}

function sceneArt(sc, t, F, mouth) {
  const u = clamp((t - sc.t0) / (sc.t1 - sc.t0));
  const lt = t - sc.t0;
  const blink = (t * 1.0) % 3.3 < 0.12;
  let s = '', sat = 1, zoom = 1 + .06 * u, cam = [0, 0];
  const bob = Math.sin(t * 3) * 5;
  if (sc.kind === 'open') {
    sat = 0;
    s += `<rect width="${W}" height="${FH}" fill="#1C1F26"/><rect y="800" width="${W}" height="200" fill="#101319"/>`;
    const tick = lt * (2 + 2 * u), sec = Math.floor(tick) * 6 + Math.pow(1 - (tick % 1), 6) * 4;
    s += clock(840, 230, 150, 280 + lt * 3, { sec });
    s += chiku(260, 520, 1.45, { look: .8, mouth, blink, mood: 'worry', bob, t });
    sc.words.forEach((w, i) => {
      const a = lt * (1.2 + 2.2 * u) + i * Math.PI / 2, r = 215 * (1 - ease((u - .82) / .18) * .55);
      let x = 740 + Math.cos(a) * r * 1.0, y = 560 + Math.sin(a) * r * .8;
      if (u > .86) { x = 740; y = 380 + i * 110; }
      const jx = rnd(Math.floor(t * 24) + i) > .93 ? 14 : 0;
      s += card(w.toUpperCase(), x + jx, y, Math.sin(a * 2) * 10 * (1 - ease((u - .86) / .1)), { w: 360, fs: 38 });
    });
    s += `<rect width="${W}" height="${FH}" fill="#fff" opacity="${clamp((u - .93) / .07) * .9}"/>`;
  } else if (sc.kind === 'title') {
    sat = clamp((u - .15) / .6);
    s += `<rect width="${W}" height="${FH}" fill="#10253A"/>`;
    const sc2 = 1 + .05 * Math.max(0, 1 - lt * 3);
    s += `<g transform="translate(0,0) scale(${sc2}) translate(${-(sc2 - 1) * 540 / sc2},${-(sc2 - 1) * 500 / sc2})">` + clock(540, 430, 270, -u * u * 1500 + 200, { sec: -u * 3000 }) + `</g>`;
    s += `<text x="540" y="860" text-anchor="middle" font-size="76" font-weight="700" fill="#FFE9B8" letter-spacing="${14 - 10 * ease(u / .4)}" opacity="${ease(u / .3)}">${esc(sc.title.toUpperCase())}</text>`;
    s += `<rect width="${W}" height="${FH}" fill="#fff" opacity="${Math.max(0, 1 - lt * 5) * .8}"/>`;
  } else if (sc.kind === 'concept') {
    s += `<defs><radialGradient id="lamp" cx=".78" cy=".25" r=".9"><stop offset="0" stop-color="#F6B86A" stop-opacity=".55"/><stop offset="1" stop-color="#F6B86A" stop-opacity="0"/></radialGradient></defs>`;
    s += `<rect width="${W}" height="${FH}" fill="#173B4C"/><rect width="${W}" height="${FH}" fill="url(#lamp)"/><rect y="800" width="${W}" height="200" fill="#2A1A12"/>`;
    s += `<rect x="60" y="90" width="150" height="190" rx="12" fill="#0F2A38" stroke="#E8B04B" stroke-width="6"/><circle cx="135" cy="150" r="30" fill="#F6D58A"/>`;
    s += chiku(275, 580, 1.4, { look: .6, mouth, blink, bob, flap: Math.sin(t * 8) * 6, mood: sc.worry ? 'worry' : '', t });
    const px = 690, py = 520, ph = t * 1.5;
    const a = sc.anim;
    if (a === 'trim') {
      const grow = ease(u / .22), cutT = clamp((u - .28) / .22);
      const L = 1 - .5 * ease(cutT), snip = Math.sin(cutT * 40) * 14;
      s += scarf(px - 260, py, 520 * grow * L, ph);
      if (cutT > 0 && cutT < 1.01 && u < .8) s += emoji('✂️', px - 260 + 520 * L, py - 70, 110, snip);
      if (cutT > .3) { const f = clamp((u - .36) / .35); s += `<g transform="translate(${px - 260 + 520 * L},${py + f * 320}) rotate(${f * 50})" opacity="${1 - f}">${scarf(0, 0, 520 * .5, ph)}</g>`; }
      if (u > .62) s += `<g opacity="${ease((u - .62) / .12)}">${card('STILL A SCARF', px, py + 200, 0, { w: 400, fs: 42, stroke: '#7CE3A1' })}</g>`;
    } else if (a === 'swap') {
      const f = clamp((u - .4) / .3);
      if (f < .5) s += `<g opacity="${1 - f * 2}">${prop(sc.from, px, py, 1 - f * 1.2, t, ph)}</g>`;
      else s += prop(sc.to, px, py, back((f - .5) * 2) * 1, t, ph);
      if (u < .4) s += prop(sc.from, px, py, ease(u / .25), t, ph);
      if (f > .1 && f < .6) s += emoji('✨', px, py, 260 * Math.sin(f / .6 * Math.PI));
      if (u > .78) s += `<g opacity="${ease((u - .78) / .12)}">${card(sc.tag, px, py + 210, 0, { w: 400, fs: 42, stroke: '#7CE3A1' })}</g>`;
    } else if (a === 'erase') {
      const e = clamp((u - .3) / .45), ex = px - 260 + 560 * ease(e);
      s += `<clipPath id="cl"><rect x="${ex}" y="0" width="${W}" height="${FH}"/></clipPath><g clip-path="url(#cl)">${prop(sc.from, px, py, ease(u / .2) || .01, t, ph)}</g>`;
      if (u > .26 && u < .8) s += `<g transform="translate(${ex},${py + 70}) rotate(-8)"><rect x="-70" y="-45" width="140" height="90" rx="14" fill="#F8B4C8"/><rect x="-70" y="-45" width="62" height="90" rx="14" fill="#fff"/></g>`;
      if (u > .8) s += `<g opacity="${ease((u - .8) / .12)}">${card(sc.tag, px, py, 0, { w: 440, fs: 42, stroke: '#7CE3A1' })}</g>`;
    } else if (a === 'pause') {
      s += prop(sc.from, px, py, ease(u / .2) || .01, t, ph);
      const f = ease((u - .4) / .2);
      if (f > 0) {
        s += `<rect x="${px - 300}" y="${py - 160}" width="620" height="420" fill="#8EC5FF" opacity="${.28 * f}"/>`;
        s += `<g transform="translate(${px},${py - 40}) scale(${back((u - .4) / .25)})"><circle r="100" fill="#101826" stroke="#FF6B00" stroke-width="8"/><rect x="-34" y="-46" width="24" height="92" rx="6" fill="#fff"/><rect x="10" y="-46" width="24" height="92" rx="6" fill="#fff"/></g>`;
      }
      if (u > .78) s += `<g opacity="${ease((u - .78) / .12)}">${card(sc.tag, px, py + 250, 0, { w: 440, fs: 42, stroke: '#7CE3A1' })}</g>`;
    }
    s += `<g opacity="${ease(u / .12)}">${card(sc.label.toUpperCase(), 540, 70, 0, { w: 620, fs: 56, stroke: '#FF6B00' })}</g>`;
  } else if (sc.kind === 'return') {
    sat = 0.3 + .7 * ease(u / .5);
    s += `<rect width="${W}" height="${FH}" fill="#1C2A38"/><rect y="800" width="${W}" height="200" fill="#2A1A12"/>`;
    const stop = u > .7;
    s += clock(840, 210, 130, stop ? 0 : 300 + lt * 40, {});
    s += chiku(260, 560, 1.45, { look: .5, mouth, blink, bob: stop ? Math.sin(t * 12) * 12 : bob, flap: stop ? Math.sin(t * 16) * 14 : 0, mood: stop ? '' : 'worry', t });
    s += `<g transform="translate(700,640) rotate(-4)"><rect x="-210" y="-250" width="420" height="500" rx="14" fill="#FFF8F0"/>`;
    sc.words.forEach((w, i) => { const hi = i < 2; s += `<text x="-170" y="${-150 + i * 120}" font-size="44" font-weight="700" fill="#101826">(${'abcd'[i]}) ${esc(w)}</text>`; });
    const p = clamp((u - .35) / .3), r = 150;
    s += `<ellipse cx="-20" cy="${-150}" rx="190" ry="48" fill="none" stroke="#D7263D" stroke-width="9" stroke-dasharray="${p * 900} 900" transform="rotate(-2)"/>`;
    s += `</g>`;
    if (u > .72) s += `<g transform="translate(860,300) scale(${back((u - .72) / .2)})">${emoji('✅', 0, 0, 160)}</g>`;
  } else if (sc.kind === 'cta') {
    s += `<rect width="${W}" height="${FH}" fill="#0B1423"/>`;
    s += chiku(540, 470, 1.2, { look: 0, mouth, blink, bob, flap: Math.sin(t * 8) * 10, t });
    s += `<g opacity="${ease(u / .2)}"><rect x="170" y="770" width="740" height="130" rx="65" fill="#FF6B00"/><text x="540" y="858" text-anchor="middle" font-size="72" font-weight="700" fill="#fff">${esc(sc.big)}</text></g>`;
  }
  return { art: s, sat, zoom, cam };
}

window.frame = function (t) {
  const sc = CFG.scenes.find(x => t >= x.t0 && t < x.t1) || CFG.scenes[CFG.scenes.length - 1];
  const fi = Math.min(CFG.env.length - 1, Math.floor(t * CFG.fps));
  const mouth = CFG.env[fi] || 0;
  const r = sceneArt(sc, t, fi, mouth);
  const u = clamp((t - sc.t0) / (sc.t1 - sc.t0));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'Sans', sans-serif">`;
  s += `<defs><filter id="g"><feColorMatrix type="saturate" values="${r.sat.toFixed(3)}"/></filter><radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient><clipPath id="fr"><rect x="0" y="${FY}" width="${W}" height="${FH}"/></clipPath></defs>`;
  s += `<rect width="${W}" height="${H}" fill="#05080F"/>`;
  s += `<g clip-path="url(#fr)"><g filter="url(#g)"><g transform="translate(0,${FY}) translate(540,500) scale(${r.zoom}) translate(-540,-500)">${r.art}</g></g>`;
  s += `<rect x="0" y="${FY}" width="${W}" height="${FH}" fill="${sc.kind === 'open' ? '#2B4A6B' : '#E8943A'}" opacity=".10"/><rect x="0" y="${FY}" width="${W}" height="${FH}" fill="url(#vg)"/></g>`;
  // letterbox hairlines + grain
  s += `<rect x="0" y="${FY - 3}" width="${W}" height="3" fill="#FF6B00"/><rect x="0" y="${FY + FH}" width="${W}" height="3" fill="#FF6B00"/>`;
  s += `<text x="60" y="130" font-size="34" font-weight="700" fill="#FF6B00" letter-spacing="5">${esc(CFG.tag.toUpperCase())}</text>`;
  s += `<text x="60" y="200" font-size="46" font-weight="500" fill="#C9D3E0" opacity=".9">${esc(sc.chapter || '')}</text>`;
  s += caption(sc.cap || [], u);
  s += `<rect y="1780" width="${W}" height="70" fill="#FF6B00"/><text x="60" y="1829" font-size="36" font-weight="600" fill="#fff">Free tests + notes → leanprep.in/lead-prelims</text>`;
  s += `<rect y="1850" width="${W}" height="70" fill="#0A1628"/><text x="60" y="1899" font-size="34" fill="#fff">Daily quiz on Telegram: t.me/leanprep</text>`;
  s += `</svg>`;
  document.getElementById('stage').innerHTML = s;
  const gn = document.getElementById('grain');
  gn.style.backgroundPosition = `${Math.floor(rnd(Math.floor(t * 24)) * 256)}px ${Math.floor(rnd(Math.floor(t * 24) + 9) * 256)}px`;
  gn.style.opacity = sc.kind === 'open' ? .22 : .12;
};
