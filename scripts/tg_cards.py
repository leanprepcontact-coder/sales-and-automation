import sys, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
A=Path('/home/claude/sales-and-automation/content/assets')
src={'notes':'/tmp/claude-tool-results/3b99ad6f-eb2e-5c50-8ac0-0e7cc8184e05/mcp-Google_Drive-blob-1795330547162-b7p18d-62a07b04.png',
     'free':'/tmp/claude-tool-results/3b99ad6f-eb2e-5c50-8ac0-0e7cc8184e05/mcp-Google_Drive-blob-1795330548831-4jj4in-02eedcc3.png'}
out={'notes':'2026-11-22_notes_notes-st_p4_tg.png','free':'2026-11-22_free-tests_science-tech_tg.png'}
for k,v in src.items(): shutil.copy(v, A/f'_{k}.png')
def doc(k): return f"""<!doctype html><html><head><meta charset=utf-8><style>
@font-face{{font-family:S;font-weight:600;src:url(instrument-sans-latin-600-normal.woff2)}}
@font-face{{font-family:S;font-weight:700;src:url(instrument-sans-latin-700-normal.woff2)}}
body{{margin:0;width:1080px;height:1350px;position:relative;font-family:S}}
img{{position:absolute;left:0;top:0}}
.cov{{position:absolute;left:86px;top:996px;width:272px;height:100px;background:#fff}}
.st{{position:absolute;left:91px;top:998px;width:270px;font-size:26px;font-weight:600;line-height:31px;color:#0a1628}}
.st b{{color:#ff6a00;font-weight:600}}
.fc{{position:absolute;left:60px;top:1262px;width:560px;height:52px;background:#0a1628}}
.ft{{position:absolute;left:72px;top:1269px;font-size:28px;font-weight:700;color:#fff;white-space:nowrap}}
.ft span{{color:#ff6a00}}
</style></head><body><img src="_{k}.png">
<div class=cov></div><div class=st><b>1</b> Open leanprep.in</div>
<div class=fc></div><div class=ft>Free tests + notes · <span>leanprep.in</span></div></body></html>"""
with sync_playwright() as p:
    b=p.chromium.launch(channel='chrome'); pg=b.new_page(viewport={'width':1080,'height':1350})
    for k in src:
        t=A/'_fix.html'; t.write_text(doc(k)); pg.goto(t.as_uri()); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(300)
        pg.screenshot(path=f'/home/claude/sales-and-automation/out/tg/{out[k]}')
    b.close()
for f in ['_fix.html','_notes.png','_free.png']: (A/f).unlink(missing_ok=True)
