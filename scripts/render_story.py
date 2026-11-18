"""Animated illustrated story reel (1080x1920 MP4) for the creator's OWN voiceover.

Usage:
  python3 scripts/render_story.py --spec story.json --out out/2026-11-19_Story_Env.mp4 [--audio my_voice.m4a]

Spec: {"tag": "Prelims 2027 · Environment", "scenes": [{"type": "hook", "dur": 5, "caption": "...", ...}, ...]}
Scene types: hook (aspirant + thought bubble), river (art=tannery|city|farm), twist (answer card), cta.
Timing: each scene has "dur" seconds. With --audio, all durations are scaled so the film matches the audio length;
"starts" (list of scene start seconds, e.g. from the recording) overrides this exactly.
Output is silent without --audio. Needs Playwright (Chrome) and ffmpeg.
"""
import argparse, json, os, shutil, subprocess, tempfile
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "content" / "assets"
FPS = 24

PAGE = r"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Serif';src:url('instrument-serif-latin-400-normal.woff2')}
@font-face{font-family:'Serif';font-style:italic;src:url('instrument-serif-latin-400-italic.woff2')}
@font-face{font-family:'Sans';font-weight:600;src:url('instrument-sans-latin-600-normal.woff2')}
@font-face{font-family:'Sans';font-weight:700;src:url('instrument-sans-latin-700-normal.woff2')}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#FFF8F0;font-family:'Sans'}
svg{position:absolute;left:0;top:0}
.cap{position:absolute;left:70px;right:70px;top:1290px;text-align:center;font-weight:700;font-size:70px;line-height:1.12;color:#0A1628}
.cap b{color:#FF6B00}
.cap span{display:inline-block}
.tag{position:absolute;right:70px;top:162px;color:#FF6B00;font-weight:600;font-size:28px;letter-spacing:.1em;text-transform:uppercase}
.logo{position:absolute;left:84px;top:150px;height:64px}
.foot{position:absolute;left:0;right:0;bottom:0;height:300px;background:#0A1628;color:#fff;font-size:38px;font-weight:600;padding:56px 84px}
.foot i{display:block;margin-top:14px;font-style:normal;font-weight:600;color:#FF6B00;font-size:34px}
.prog{position:absolute;left:0;bottom:300px;height:10px;background:#FF6B00}
</style></head><body>
<img class="logo" src="logo.png"><div class="tag" id="tag"></div>
<svg id="art" width="1080" height="1920" viewBox="0 0 1080 1920"></svg>
<div class="cap" id="cap"></div>
<div class="prog" id="prog"></div>
<div class="foot">Free tests + notes &rarr; leanprep.in/lead-prelims<i>Daily quiz on Telegram: t.me/leanprep</i></div>
<script>
const NS='http://www.w3.org/2000/svg';
const S=window.SPEC; document.getElementById('tag').textContent=S.tag;
const art=document.getElementById('art'), cap=document.getElementById('cap'), prog=document.getElementById('prog');
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), ease=x=>1-Math.pow(1-clamp(x),3), back=x=>{x=clamp(x);const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
const rnd=n=>{const v=Math.sin(n*127.1)*43758.5453;return v-Math.floor(v)};
function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const k in attrs)e.setAttribute(k,attrs[k]);(parent||art).appendChild(e);return e}
let ST=0; const starts=S.scenes.map(s=>{const t=ST;ST+=s.dur;return t}); const TOTAL=ST;
if(S.starts){S.starts.forEach((v,i)=>starts[i]=v)}
const OR='#FF6B00',INK='#0A1628';
/* ---------- characters / pieces ---------- */
function aspirant(g,x,y,sc,mood,t){ // mood: think|shock|happy
  const b=Math.sin(t*3)*4, blink=(Math.floor(t*10)%23==0)?0.1:1;
  const G=el('g',{transform:`translate(${x},${y}) scale(${sc})`},g);
  el('rect',{x:-190,y:210,width:380,height:30,rx:12,fill:'#C9A27A'},G); // desk
  el('path',{d:'M-120 220 q0-150 120-150 q120 0 120 150z',fill:OR},G); // body
  el('rect',{x:-26,y:30+b,width:52,height:50,fill:'#E8B48A'},G);
  el('circle',{cx:0,cy:-30+b,r:100,fill:'#F1BF97'},G);
  el('path',{d:`M-104 -50+b q10 -110 104 -110 q94 0 104 110 q-50 -60 -104 -60 q-54 0 -104 60z`.replace('+b',''),fill:INK,transform:`translate(0,${b})`},G);
  const ey=-30+b;
  el('ellipse',{cx:-36,cy:ey,rx:11,ry:16*blink*(mood=='shock'?1.5:1),fill:INK},G);
  el('ellipse',{cx:36,cy:ey,rx:11,ry:16*blink*(mood=='shock'?1.5:1),fill:INK},G);
  if(mood=='happy')el('path',{d:`M-34 ${22+b} q34 38 68 0`,stroke:INK,'stroke-width':8,fill:'none','stroke-linecap':'round'},G);
  else if(mood=='shock')el('ellipse',{cx:0,cy:34+b,rx:16,ry:22,fill:INK},G);
  else el('path',{d:`M-26 ${34+b} q26 -10 52 0`,stroke:INK,'stroke-width':8,fill:'none','stroke-linecap':'round'},G);
  if(mood=='think'){el('path',{d:`M-70 ${-72+b} l44 -8`,stroke:INK,'stroke-width':8,'stroke-linecap':'round'},G);el('path',{d:`M26 ${-80+b} l44 8`,stroke:INK,'stroke-width':8,'stroke-linecap':'round'},G);}
  el('rect',{x:-90,y:176,width:180,height:50,rx:8,fill:'#fff',stroke:INK,'stroke-width':5},G); // paper
  for(let i=0;i<3;i++)el('line',{x1:-70,x2:70-(i*20),y1:192+i*13,y2:192+i*13,stroke:'#9AA5B1','stroke-width':4},G);
}
function bubble(g,x,y,w,h,text,p){
  const G=el('g',{transform:`translate(${x},${y}) scale(${back(p)})`,opacity:clamp(p*3)},g);
  el('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:50,fill:'#fff',stroke:INK,'stroke-width':6},G);
  el('circle',{cx:-w/2+60,cy:h/2+34,r:20,fill:'#fff',stroke:INK,'stroke-width':6},G);
  el('circle',{cx:-w/2+30,cy:h/2+76,r:12,fill:'#fff',stroke:INK,'stroke-width':6},G);
  const lines=text.split('|');lines.forEach((l,i)=>{const t=el('text',{x:0,y:-(lines.length-1)*36+i*72+18,'text-anchor':'middle','font-size':58,'font-weight':700,fill:INK,'font-family':'Sans'},G);t.textContent=l});
}
function stamp(g,x,y,text,col,p){
  const G=el('g',{transform:`translate(${x},${y}) rotate(-8) scale(${back(p)*1})`,opacity:clamp(p*4)},g);
  const w=text.length*44+80;
  el('rect',{x:-w/2,y:-62,width:w,height:124,rx:22,fill:'#fff',stroke:col,'stroke-width':10},G);
  const t=el('text',{x:0,y:20,'text-anchor':'middle','font-size':68,'font-weight':700,fill:col,'font-family':'Sans'},G);t.textContent=text;
}
/* ---------- river scene ---------- */
function river(g,art_,lt,dur,t){
  // sky + ground
  el('rect',{x:0,y:230,width:1080,height:1050,fill:'#DCEEFF'},g);
  el('circle',{cx:900,cy:360,r:70,fill:'#FFD66B'},g);
  // river band with waves
  el('rect',{x:0,y:830,width:1080,height:230,fill:'#4DA3E0'},g);
  for(let i=0;i<8;i++){const wx=((i*170+lt*60)%1240)-80;el('path',{d:`M${wx} ${900+(i%3)*50} q30 -22 60 0 q30 22 60 0`,stroke:'#fff','stroke-width':6,fill:'none',opacity:.7},g)}
  // tint of river grows with pollution
  const pol=ease(lt/dur);
  const tint=art_=='farm'?'#8B6B2E':art_=='city'?'#6F6A58':'#7A4A2A';
  el('rect',{x:0,y:830,width:1080,height:230,fill:tint,opacity:0.1+pol*0.45},g);
  el('rect',{x:0,y:1060,width:1080,height:220,fill:'#5CA45A'},g); // near bank
  el('rect',{x:0,y:230,width:1080,height:0,fill:'none'},g);
  el('rect',{x:0,y:700,width:1080,height:130,fill:'#7CBF6A'},g); // far bank
  if(art_=='tannery'){
    const G=el('g',{transform:'translate(40,470)'},g);
    el('rect',{x:0,y:80,width:330,height:220,fill:'#B9573A'},G);el('rect',{x:240,y:-30,width:60,height:130,fill:'#8C3E27'},G);
    for(let i=0;i<3;i++){const sy=-60-((lt*40+i*50)%160);el('circle',{cx:270+Math.sin(lt*2+i)*14,cy:sy+10,r:26+i*8,fill:'#fff',opacity:.55-i*.1},G)}
    el('rect',{x:310,y:250,width:330,height:34,fill:'#6B6F76'},G);el('rect',{x:600,y:250,width:34,height:140,fill:'#6B6F76'},G);
    const n=14;for(let i=0;i<n;i++){const k=((lt*1.6+i/n)%1);const dy=250+k*(830-470-250+110);el('ellipse',{cx:617,cy:390+k*430,rx:13,ry:19,fill:'#7A4A2A',opacity:1-k*.3},G)}
  } else if(art_=='city'){
    const G=el('g',{transform:'translate(0,520)'},g);
    [[30,150,190],[180,230,150],[340,120,210],[480,200,170],[640,260,120]].forEach(([x,h,w],i)=>{el('rect',{x:x,y:290-h,width:w*0.7,height:h,fill:['#5B6B8A','#7A8BAA','#4A5878','#8798B5','#5B6B8A'][i]},G);for(let r=0;r<3;r++)for(let c=0;c<2;c++)el('rect',{x:x+16+c*34,y:290-h+20+r*44,width:20,height:26,fill:'#FFE9A6'},G)});
    el('rect',{x:690,y:255,width:180,height:34,fill:'#6B6F76'},G);el('rect',{x:850,y:255,width:34,height:130,fill:'#6B6F76'},G);
    for(let i=0;i<14;i++){const k=((lt*1.6+i/14)%1);el('ellipse',{cx:867,cy:385+k*360,rx:15,ry:20,fill:'#6F6A58',opacity:1-k*.3},G)}
  } else { // farm + rain + many streams
    const G=el('g',{},g);
    for(let r=0;r<6;r++)el('rect',{x:20,y:1090+(r%2)*0,width:1040,height:0,fill:'none'},G);
    for(let r=0;r<5;r++)el('path',{d:`M0 ${760+r*0} L1080 ${760}`,stroke:'none'},G);
    el('rect',{x:0,y:620,width:1080,height:210,fill:'#C9B458'},G);
    for(let r=0;r<10;r++)el('line',{x1:r*120-40,y1:830,x2:r*120+40,y2:620,stroke:'#A8943F','stroke-width':8},G);
    for(let i=0;i<46;i++){const x=rnd(i)*1080,k=((lt*1.4+rnd(i+9))%1);el('line',{x1:x,y1:240+k*500,x2:x-10,y2:270+k*500,stroke:'#3F6FA8','stroke-width':5,opacity:.8},G)}
    for(let i=0;i<9;i++){const x=70+i*118;const gr=clamp((lt-0.8)/1.2);const L=ease(gr)*(830-700);el('line',{x1:x,y1:830,x2:x+(i%2?14:-14),y2:830+L,stroke:'#9B6B3A','stroke-width':10,'stroke-linecap':'round',opacity:.9},G)}
  }
  // label
  const lab={tannery:['POINT SOURCE','one pipe · one place'],city:['POINT SOURCE','big city · still one pipe'],farm:['NON-POINT SOURCE','whole field · no single outlet']}[art_];
  const lp=ease((lt-1.0)/0.6),col=art_=='farm'?'#0F6B3A':'#B42318';
  const G=el('g',{transform:`translate(540,1160) scale(${back(lp)})`,opacity:clamp(lp*3)},g);
  el('rect',{x:-380,y:-70,width:760,height:140,rx:28,fill:'#fff',stroke:col,'stroke-width':8},G);
  const t1=el('text',{x:0,y:-4,'text-anchor':'middle','font-size':56,'font-weight':700,fill:col,'font-family':'Sans'},G);t1.textContent=lab[0];
  const t2=el('text',{x:0,y:46,'text-anchor':'middle','font-size':34,'font-weight':600,fill:INK,'font-family':'Sans'},G);t2.textContent=lab[1];
}
/* ---------- frame ---------- */
window.setT=function(t){
  art.innerHTML=''; const i=Math.max(0,starts.findLastIndex(s=>t>=s)); const sc=S.scenes[i], lt=t-starts[i], dur=(starts[i+1]??TOTAL)-starts[i];
  const g=el('g',{});
  const sx=1+0.03*lt/dur; // slow push-in
  const gg=el('g',{transform:`translate(${540-540*sx},${760-760*sx}) scale(${sx})`},g);
  const fade=Math.min(ease(lt/0.35),1);
  g.setAttribute('opacity',fade);
  if(sc.type=='hook'){
    el('rect',{x:0,y:230,width:1080,height:1050,fill:'#FFE9D2'},gg);
    aspirant(gg,540,790,1.6,lt>(dur-1.3)?'shock':'think',t);
    bubble(gg,540,430,880,280,sc.bubble,ease((lt-0.4)/0.5));
  } else if(sc.type=='river'){ river(gg,sc.art,lt,dur,t); }
  else if(sc.type=='twist'){
    el('rect',{x:0,y:230,width:1080,height:1050,fill:'#E6F6EA'},gg);
    aspirant(gg,540,840,1.5,'happy',t);
    for(let k=0;k<5;k++){const a=ease((lt-0.3)/0.6),ang=-Math.PI/2+(k-2)*0.5;el('line',{x1:540+Math.cos(ang)*230*a,y1:470+Math.sin(ang)*150*a,x2:540+Math.cos(ang)*300*a,y2:470+Math.sin(ang)*190*a,stroke:'#FFB400','stroke-width':10,'stroke-linecap':'round'},gg)}
    stamp(gg,540,420,sc.stamp,'#0F6B3A',ease((lt-0.2)/0.5));
  } else if(sc.type=='cta'){
    el('rect',{x:0,y:230,width:1080,height:1050,fill:OR},gg);
    const p=ease(lt/0.5);const t=el('text',{x:540,y:600,'text-anchor':'middle','font-size':130,'font-weight':700,fill:'#fff','font-family':'Sans',transform:`scale(${0.9+0.1*p})`,'transform-origin':'540 600'},gg);t.textContent=sc.big;
    const t2=el('text',{x:540,y:760,'text-anchor':'middle','font-size':64,'font-weight':600,fill:'#0A1628','font-family':'Sans'},gg);t2.textContent=sc.sub;
    const pulse=1+0.04*Math.sin(t*6);el('rect',{x:240,y:880,width:600,height:140,rx:70,fill:'#fff',transform:`translate(540,950) scale(${pulse}) translate(-540,-950)`},gg);
    const t3=el('text',{x:540,y:968,'text-anchor':'middle','font-size':54,'font-weight':700,fill:OR,'font-family':'Sans'},gg);t3.textContent='Link in bio';
  }
  // caption: words pop in
  const words=(sc.caption||'').split(' ');cap.innerHTML=words.map((w,k)=>{const p=ease((lt-0.25-k*0.18)/0.25);const em=w.startsWith('*');return `<span style="opacity:${p};transform:translateY(${(1-p)*18}px)">${em?'<b>'+w.slice(1)+'</b>':w}&nbsp;</span>`}).join('');
  prog.style.width=(t/TOTAL*1080)+'px';
};
window.TOTAL=TOTAL;
</script></body></html>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--audio")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text())
    if a.audio:
        d = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                           "-of", "csv=p=0", a.audio]).decode())
        tot = sum(s["dur"] for s in spec["scenes"])
        if not spec.get("starts"):
            for s in spec["scenes"]:
                s["dur"] *= (d + 0.4) / tot
    from playwright.sync_api import sync_playwright
    tmp = Path(tempfile.mkdtemp())
    for f in ASSETS.iterdir():
        shutil.copy(f, tmp / f.name)
    html = PAGE.replace("<script>", "<script>window.SPEC=" + json.dumps(spec) + ";", 1)
    (tmp / "p.html").write_text(html)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome")
        pg = b.new_page(viewport={"width": 1080, "height": 1920})
        pg.goto((tmp / "p.html").as_uri())
        pg.wait_for_timeout(500)
        total = pg.evaluate("TOTAL")
        n = int(total * FPS)
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-i", "-"]
        if a.audio:
            cmd += ["-i", a.audio]
        else:
            cmd += ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
        cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac",
                "-t", f"{total:.2f}", "-movflags", "+faststart", a.out]
        ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for k in range(n):
            pg.evaluate(f"setT({k / FPS})")
            ff.stdin.write(pg.screenshot(type="jpeg", quality=92))
            if k == int(n * 0.45):
                pg.screenshot(path=str(Path(a.out).with_suffix(".cover.png")))
        ff.stdin.close()
        ff.wait()
        b.close()
    print(a.out, f"{total:.1f}s")


if __name__ == "__main__":
    main()
