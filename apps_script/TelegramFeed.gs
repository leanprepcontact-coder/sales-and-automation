/**
 * LeanPrep Telegram Feed (Google Apps Script, bound to the "LeanPrep Growth OS" sheet).
 * A small private web app. GitHub Actions asks it what to post for a slot, posts to Telegram
 * through @leanprep_poster_bot, then asks it to write the Post Log row.
 * (Telegram blocks Google's servers, so the posting itself happens on GitHub.)
 *
 * Script Property needed: FEED_KEY (any long random text; the same text goes in the
 * GitHub secret FEED_KEY). Deploy > New deployment > Web app, Execute as: Me,
 * Who has access: Anyone. The /exec URL goes in the GitHub secret GAS_URL.
 */

const CFG = {
  SHEET_ID: '1R8sN_1NYs9aX6BfLkpSeeIf5Czaw4kT3If-GSy2qKjY',
  TZ: 'Asia/Kolkata',
  PRELIMS_CLOSE: '📚 Learn more: https://leanprep.in/lead-prelims',
  MAINS_CLOSE: '🎯 Learn more: https://leanprep.in/#lead-batch',
};
const SLOT_NAME = { '8am': '8 AM', '9am': '9 AM', '115pm': '1:15 PM', '6pm': '6 PM', '8pm': '8 PM' };

function doGet(e) {
  const p = (e && e.parameter) || {};
  const key = PropertiesService.getScriptProperties().getProperty('FEED_KEY');
  if (!key || p.key !== key) return json_({ ok: false, error: 'bad key' });
  try {
    if (p.action === 'pending') return json_({ ok: true, date: today_(), items: build_(p.slot) });
    if (p.action === 'log') { logPost_(SLOT_NAME[p.slot] || p.slot, p.label, p.result || 'Posted by bot'); return json_({ ok: true }); }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err) }); }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ---------- what to post for each slot ----------
function build_(slot) {
  const out = [];
  if (slot === '8am') {
    const r = findRows_('Morning Revision')[0];
    if (r) photo_(out, 'Morning Revision', fileId_(r['Image file']), block_(r.Caption, 'TELEGRAM 8 AM') || r.Caption, CFG.PRELIMS_CLOSE);
  } else if (slot === '9am') {
    findRows_('Prelims MCQ').forEach((r, i) => {
      const q = 'Q' + (i + 1);
      // 24 Nov 2026: question + options are on the card and in the quiz poll, so the caption keeps only title, links and closing line.
      const lines = (block_(r.Caption, 'TELEGRAM 9 AM') || '').split('\n');
      const title = lines.find(l => /^\s*🧠/.test(l)) || ('🧠 ' + (r.Subject || '') + ' ' + q + ' · Daily Quiz: read the card and answer in the quiz below.');
      const links = lines.filter(l => /^\s*📘/.test(l));
      const cap = [title].concat(links.length ? links : ['📘 Take the free ' + (r.Subject || '') + ' tests and read the free notes: https://leanprep.in/lead-prelims']).join('\n');
      photo_(out, q + ' question', fileId_(r['Image file']), cap, CFG.PRELIMS_CLOSE);
      quiz_(out, r, q);
    });
  } else if (slot === '115pm') {
    const r = findRows_('Notes snippet')[0];
    if (r) photo_(out, 'Notes snippet', fileId_(r['Image file']), block_(r.Caption, 'TELEGRAM 1 PM'), CFG.PRELIMS_CLOSE);
  } else if (slot === '6pm') {
    const r = findRows_('Mains question')[0];
    if (r) photo_(out, 'Mains', fileId_(r['Image file']), block_(r.Caption, 'TELEGRAM 6 PM'), CFG.MAINS_CLOSE);
  } else if (slot === '8pm') {
    const rows = findRows_('Prelims MCQ');
    rows.forEach((r, i) => {
      const m = String(r.Explanation || '').match(/Answer card:\s*(\S+)/i);
      if (m) photo_(out, 'Q' + (i + 1) + ' answer', fileId_(m[1]), block_(r.Caption, 'TELEGRAM 8 PM'), CFG.PRELIMS_CLOSE);
    });
    const s = rows.length && String(rows[0].Explanation || '').match(/Free-test slide:\s*(\S+)/i);
    if (s) photo_(out, 'Free tests card', fileId_(s[1]),
      '📘 Take today\'s free ' + (rows[0].Subject || '') + ' Concept Test and Sectional and read the free notes: https://leanprep.in/lead-prelims', CFG.PRELIMS_CLOSE);
  } else throw new Error('unknown slot ' + slot);
  return out;
}

function photo_(out, label, fid, caption, close) {
  if (!caption || alreadyPosted_(label)) return;
  const blob = DriveApp.getFileById(fid).getBlob();
  out.push({ label: label, type: 'photo', caption: clean_(caption, close), mime: blob.getContentType(), image_b64: Utilities.base64Encode(blob.getBytes()) });
}

function quiz_(out, row, q) {
  const label = q + ' quiz poll'; if (alreadyPosted_(label)) return;
  const L = ['a', 'b', 'c', 'd'], ans = L.indexOf(String(row.Answer).trim().toLowerCase()); if (ans < 0) return;
  const parts = String(row.Options || '').split(/\s*\(([abcd])\)\s*/).filter(Boolean), map = {};
  for (let i = 0; i < parts.length - 1; i++) if (/^[abcd]$/.test(parts[i])) map[parts[i]] = parts[i + 1].trim();
  const full = L.map(l => map[l]), useFull = full.every(o => o && ('(x) ' + o).length <= 95);
  const ex = String(row.Explanation || '');
  let expl = (ex.match(/Remember:[^\n]*/) || [''])[0].trim() || (ex.split(/(?<=\.)\s/)[0] || '').trim();
  if (expl.length > 200) expl = expl.slice(0, 197).replace(/\s+\S*$/, '') + '…';
  out.push({ label: label, type: 'quiz', question: ((row.Subject || '') + ' ' + q + ' · Which option is correct? Read the card above.').slice(0, 300),
    options: L.map((l, i) => useFull ? '(' + l + ') ' + full[i] : '(' + l + ')'), correct: ans, explanation: expl });
}

// ---------- sheet helpers ----------
function today_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function findRows_(type) {
  const v = SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName('Content Queue').getDataRange().getValues();
  const h = v[0].map(String), t = today_(), out = [];
  for (let i = 1; i < v.length; i++) {
    const r = {}; h.forEach((k, j) => r[k] = v[i][j]);
    const d = r.Date instanceof Date ? Utilities.formatDate(r.Date, CFG.TZ, 'yyyy-MM-dd') : String(r.Date).trim();
    if (d === t && String(r.Type).trim() === type && /telegram/i.test(r.Platform) && /^approved$/i.test(String(r.Status).trim())) out.push(r);
  }
  return out;
}
function block_(caption, label) {
  const lines = String(caption || '').split('\n'); let on = false; const out = [];
  for (const l of lines) {
    if (/^\s*(TELEGRAM|INSTAGRAM)\b[^\n]*:\s*$/i.test(l) || /^\s*(TELEGRAM|INSTAGRAM) \d/i.test(l)) {
      if (on) break;
      if (l.trim().toUpperCase().startsWith(label.toUpperCase())) { on = true; continue; }
    } else if (on) out.push(l);
  }
  return out.join('\n').trim();
}
function clean_(text, close) {
  let t = String(text || '').replace(/\s*\(link in bio\)/gi, '');
  t = t.split('\n').filter(l => !/^\s*#\w/.test(l)).map(l => /\benroll\b/i.test(l) ? close : l).join('\n');
  t = t.replace(/LEAD-Prelims/g, 'LEAD Prelims').trim();
  const lines = t.split('\n'); if (lines[lines.length - 1].trim() !== close) t += '\n\n' + close;
  return t.replace(/\n{3,}/g, '\n\n');
}
function fileId_(s) {
  s = String(s || '').split('|')[0].trim();
  const m = s.match(/\/d\/([\w-]{20,})/) || s.match(/[?&]id=([\w-]{20,})/) || s.match(/^([\w-]{20,})$/);
  if (!m) throw new Error('No Drive file id in: ' + s); return m[1];
}
function postLog_() { return SpreadsheetApp.openById(CFG.SHEET_ID).getSheetByName('Post Log'); }
function alreadyPosted_(label) {
  const t = today_();
  return postLog_().getDataRange().getValues().some(r => {
    const d = r[0] instanceof Date ? Utilities.formatDate(r[0], CFG.TZ, 'yyyy-MM-dd') : String(r[0]);
    return d === t && String(r[2]).toLowerCase().startsWith(label.toLowerCase()) && !/^Failed/i.test(String(r[4]));
  });
}
function logPost_(slot, label, result) {
  postLog_().appendRow([today_(), slot, label, Utilities.formatDate(new Date(), CFG.TZ, 'HH:mm'), result]);
}

// Run once from the editor to check the feed without posting anything.
function testFeed() { ['8am', '9am', '115pm', '6pm', '8pm'].forEach(s => console.log(s + ': ' + build_(s).map(i => i.label + ' (' + i.type + ')').join(', '))); }
