import sys,subprocess,os,shutil
from playwright.sync_api import sync_playwright
FPS=24;TOTAL=40
fr='frames';shutil.rmtree(fr,ignore_errors=True);os.makedirs(fr)
only=[float(a) for a in sys.argv[1:]]
with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1080,'height':1920})
    pg.goto('file://'+os.path.abspath('scene.html'))
    if only:
        for t in only:
            pg.evaluate(f'setT({t})');pg.screenshot(path=f'{fr}/t{t}.png')
    else:
        for i in range(FPS*TOTAL):
            pg.evaluate(f'setT({i/FPS})');pg.screenshot(path=f'{fr}/f{i:05d}.png')
    b.close()
