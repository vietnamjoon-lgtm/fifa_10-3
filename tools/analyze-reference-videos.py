"""Decode official reference clips for motion analysis; never bundle footage into the game."""
import sys, pathlib, json, urllib.request, subprocess, concurrent.futures, hashlib, re, time, io
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[2]/'.analysis-tools'))
import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont
root=pathlib.Path(__file__).resolve().parents[1]
cache=root.parent/'.reference-video-analysis';cache.mkdir(exist_ok=True)
catalog=json.loads((root/'src/research/video-catalog.json').read_text(encoding='utf-8'))
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
previous={x['id']:x for x in json.loads((cache/'analysis.json').read_text(encoding='utf-8'))['results']} if (cache/'analysis.json').exists() else {}
def process(item):
    output=cache/(item['id']+'.mp4');frames=cache/(item['id']+'.jpg')
    if previous.get(item['id'],{}).get('decoded') and frames.exists():return previous[item['id']]
    try:
        if not output.exists() or item['id'] in previous:
            request=urllib.request.Request(item['url'],headers={'User-Agent':'Touchline reference analysis'})
            temporary=output.with_suffix('.part')
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(request,timeout=45) as r,temporary.open('wb') as w:
                        expected=int(r.headers.get('Content-Length','0'));received=0
                        while chunk:=r.read(1024*1024):w.write(chunk);received+=len(chunk)
                    if expected and received!=expected:raise IOError('Incomplete video download')
                    if temporary.parent.resolve()!=cache.resolve():raise IOError('Unexpected cache target')
                    temporary.replace(output);break
                except Exception:
                    if attempt==2:raise
                    time.sleep(2)
        probe=subprocess.run([ffmpeg,'-hide_banner','-i',str(output)],capture_output=True,creationflags=flags,timeout=20)
        match=re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',probe.stderr.decode(errors='replace'))
        if not match:raise ValueError('Duration unavailable')
        h,m,s=map(float,match.groups());duration=h*3600+m*60+s;targets=[duration*t for t in [.08,.24,.4,.56,.72,.88]];selected=[]
        for t in targets:
            result=subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-threads','1','-ss',str(t),'-i',str(output),'-frames:v','1','-vf','scale=240:135','-threads','1','-f','image2pipe','-vcodec','mjpeg','pipe:1'],capture_output=True,creationflags=flags,timeout=30)
            if result.returncode:raise ValueError(result.stderr.decode(errors='replace')[:200])
            selected.append(Image.open(io.BytesIO(result.stdout)).convert('RGB'))
        if not selected:raise ValueError('No decoded frame')
        while len(selected)<6:selected.append(selected[-1])
        strip=Image.new('RGB',(1440,155),'#0f2119');d=ImageDraw.Draw(strip)
        for n,im in enumerate(selected):strip.paste(im,(n*240,20))
        d.text((5,3),item['id']+'  '+item['file']+'  '+str(round(duration,2))+'s',fill='white')
        strip.save(frames,quality=88)
        return {**item,'duration':duration,'decoded':True,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'storyboard':str(frames),'sampleSeconds':targets,'viewed':False,'timingMeasured':False}
    except Exception as e:return {**item,'decoded':False,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    results=[]
    for item in ex.map(process,catalog):
        results.append(item)
        if len(results)%10==0:print('Decoded',len(results),'/',len(catalog),flush=True)
pages=[]
for page,start in enumerate(range(0,len(results),8)):
    items=results[start:start+8];sheet=Image.new('RGB',(1440,155*len(items)),'#142018')
    for n,item in enumerate(items):
        if item.get('decoded'):sheet.paste(Image.open(item['storyboard']),(0,n*155))
        else:ImageDraw.Draw(sheet).text((5,n*155+5),item['id']+' FAILED',fill='white')
    name=cache/f'storyboard-{page+1:02d}.jpg';sheet.save(name,quality=91);pages.append({'file':str(name),'ids':[x['id'] for x in items]})
(cache/'analysis.json').write_text(json.dumps({'results':results,'pages':pages},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'decoded':sum(x.get('decoded',False) for x in results),'total':len(results),'pages':len(pages),'report':str(cache/'analysis.json')}),flush=True)
