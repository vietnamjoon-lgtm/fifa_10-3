# 사람 모델 다시 만들기 (ROADMAP 10단계) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MPFB와 CC0 에셋으로 사람처럼 보이는 축구 선수 모델(3 LOD, 체형 3종, 얼굴 8종, 유니폼 3종)을 Blender 백그라운드 스크립트로 만들고, 단독 뷰어에서 확인한다.

**Architecture:** `tools/human/blender/0N_*.py`가 순서대로 `.cache/`의 중간 .blend를 이어받아 가공하고, 마지막에 LOD별 GLB와 JSON(기본 뼈 위치, 마스크, 대응표)을 내보낸다. 웹은 `human-lab.html`에서 vendored three r180 애드온으로 GLB를 불러 선수를 조립한다. 게임 코드(src/ 기존 파일)는 바꾸지 않는다.

**Tech Stack:** Blender 5.1.2 + MPFB(확장, build 20260722), Python(bpy), three r180(vendor), gltf-transform CLI(npx), KTX-Software `toktx`, Node 22 `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-26-real-human-design.md`

## Global Constraints

- Blender 실행: `/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python <script>` (스크립트 실패 시 종료 코드 1)
- MPFB 임포트 경로: `from bl_ext.blender_org.mpfb.services.humanservice import HumanService` (확인됨)
- 뼈 이름: 내보낼 때 `mixamorig:` 제거. 몸 22뼈 = Hips, Spine, Spine1, Spine2, Neck, Head, Left/RightShoulder, Left/RightArm, Left/RightForeArm, Left/RightHand, Left/RightUpLeg, Left/RightLeg, Left/RightFoot, Left/RightToeBase
- 기준 키 1.83 m, 선수 스케일 `s = 키/1.83` (0.93~1.07)
- LOD 예산: near ≤ 25,000 삼각형·52뼈, mid ≤ 10,000·22뼈, far ≤ 5,000·22뼈(얼굴 모프 없음)
- 용량: near ≤ 6 MB, mid ≤ 1.5 MB, far ≤ 0.4 MB, 경기 첫 로딩 ≤ 4 MB
- 게임 코드(src/ 기존 파일) 수정 금지. 새 파일만 추가.
- 원본(에셋 팩, .blend, 100STYLE·CMU 원본)은 `tools/human/.cache/`(gitignore)에만. 커밋은 압축본 GLB·JSON·스크립트·문서.
- 커밋: `git -c user.name=namseonghun37-create -c user.email=namseonghun37@gmail.com commit`, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **진행 규칙: 모든 태스크는 끝날 때마다 결과(렌더·표)를 사용자에게 보여주고 멈춘다.** 태스크 4~11의 세부는 직전 결과(실제 에셋 목록, 치수)를 반영해 시작 전에 확정하고, 바뀐 내용을 이 문서에 반영해 커밋한다.
- 렌더는 항상 `render_views`의 고정 카메라 4방향(front, side, back, threequarter)과 고정 조명으로 한다.
- 에셋 팩을 받으면 실제 들어 있는 피부·머리카락·눈(눈썹·속눈썹·치아 포함) 목록과 각각의 라이선스를 먼저 보여준다. CC0가 아닌 것은 쓰지 않는다.
- `legs[0]`·`arms[0]` 좌우는 `game13.json`에 적고, 기존 게임 코드에서 좌우를 가정하는 곳(`action.foot`, `receive.foot`, `turnPlan.foot`의 'left'/'right'와 인덱스 변환)을 함께 적는다.
- 브랜치는 태스크 3개마다 푸시한다(태스크 3, 6, 9, 12 끝).
- 실행 위치: `~/fifa_10-3-human` (브랜치 `work/01-human-v2`)

## 파일 구조

| 파일 | 책임 |
|---|---|
| `tools/human/common.py` | Blender 공용: 경로, MPFB 임포트, .blend 저장/열기, 렌더 헬퍼, 검사 실패 시 종료 |
| `tools/human/config/humans.json` | 체형·얼굴·피부톤·머리·유니폼 정의 (데이터만) |
| `tools/human/maps/{game13,100style,cmu}.json` | 뼈 대응표 |
| `tools/human/hand-poses.json` | 손 자세 칸 |
| `tools/human/blender/01_body.py` ~ `08_checks.py`, `retarget_min.py` | 단계별 Blender 스크립트 (한 파일 한 단계) |
| `tools/human/compress.mjs` | gltf-transform 압축과 용량 검사 |
| `tools/human/build.sh` | 전체 순서 실행 |
| `assets/human/` | 결과 GLB·JSON |
| `vendor/three-addons/` | three r180 애드온 원본 그대로 |
| `human-lab.html`, `src/human-lab/{load,assemble,lod,kit-material,view}.js` | 뷰어 (로딩 / 선수 조립 / LOD / 유니폼 재질 / 화면) |
| `tests/human-v2.test.mjs` | 데이터·대응표·용량·조립 검사 |
| `reports/human-v2/` | 렌더 이미지, 확인 표 |

---

### Task 1: 도구 준비 (에셋 팩, KTX, gltf-transform, three 애드온)

**Files:**
- Create: `tools/human/common.py`, `tools/human/setup_assets.py`, `tools/human/.gitignore`, `vendor/three-addons/…`, `tests/human-v2.test.mjs`
- Modify: `collaboration/ownership.json` (1번 paths에 `tools/human/`, `assets/human/`, `human-lab.html`, `src/human-lab/`, `vendor/three-addons/`, `tests/human-v2.test.mjs` 추가)

**Interfaces:**
- Produces: `common.py`의 `CACHE`, `ROOT`, `OUT`, `mpfb()`, `save_stage(name)`, `open_stage(name)`, `render_views(objs, path, views)`, `fail(msg)`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// tests/human-v2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ADDONS=['loaders/GLTFLoader.js','loaders/KTX2Loader.js','utils/SkeletonUtils.js','utils/BufferGeometryUtils.js','utils/WorkerPool.js','libs/ktx-parse.module.js','libs/zstddec.module.js','libs/meshopt_decoder.module.js','libs/basis/basis_transcoder.js','libs/basis/basis_transcoder.wasm'];
test('three r180 addons are vendored next to the core build',()=>{
 for(const f of ADDONS)assert.ok(fs.existsSync('vendor/three-addons/'+f),f);
 assert.match(fs.readFileSync('vendor/three.core.js','utf8'),/REVISION = '180'/);
 assert.match(fs.readFileSync('vendor/three-addons/VERSION','utf8'),/^0\.180\.0/);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test --experimental-test-isolation=none tests/human-v2.test.mjs` / Expected: FAIL (파일 없음)

- [ ] **Step 3: three 애드온 받기 (npm 타르볼, r180 = 0.180.0)**

```bash
mkdir -p tools/human/.cache && cd tools/human/.cache && npm pack three@0.180.0 --silent && tar xzf three-0.180.0.tgz && cd ../../..
for f in loaders/GLTFLoader.js loaders/KTX2Loader.js utils/SkeletonUtils.js utils/BufferGeometryUtils.js utils/WorkerPool.js libs/ktx-parse.module.js libs/zstddec.module.js libs/meshopt_decoder.module.js libs/basis/basis_transcoder.js libs/basis/basis_transcoder.wasm; do mkdir -p vendor/three-addons/$(dirname $f); cp tools/human/.cache/package/examples/jsm/$f vendor/three-addons/$f; done
echo 0.180.0 > vendor/three-addons/VERSION
```

- [ ] **Step 4: 테스트 통과 확인** — 같은 명령 / Expected: PASS

- [ ] **Step 5: KTX-Software, gltf-transform 확인**

Homebrew에는 KTX-Software 포뮬러가 없다(2026-09-26 확인). 공식 GitHub 릴리스 `.pkg`를 시스템에 설치하지 않고 풀어서 `.cache/ktx/`에 둔다.

```bash
cd tools/human/.cache && gh release download v4.4.2 -R KhronosGroup/KTX-Software -p "KTX-Software-4.4.2-Darwin-arm64.pkg"
pkgutil --expand-full KTX-Software-4.4.2-Darwin-arm64.pkg ktx-pkg && mkdir -p ktx/bin ktx/lib
cp ktx-pkg/*tools.pkg/Payload/usr/local/bin/* ktx/bin/ && cp -a ktx-pkg/*library.pkg/Payload/usr/local/lib/* ktx/lib/
./ktx/bin/toktx --version && npx -y @gltf-transform/cli@4 --version
```
Expected: `toktx v4.4.2`, `4.5.0`. `compress.mjs`는 `tools/human/.cache/ktx/bin`을 PATH 앞에 넣고 실행한다.

- [ ] **Step 6: `common.py`와 `.gitignore` 작성** (실제 구현: `render_views` 대신 `render_grid(items, name)` — 항목마다 원점에 혼자 세워 고정 카메라 4방향으로 찍고, `compose_grid.py`(시스템 python3 + Pillow)가 행=방향, 열=항목인 한 장으로 합친다. 여러 몸을 x축으로 늘어놓으면 측면에서 서로 가리기 때문.)

```python
# tools/human/common.py
import bpy, os, sys, json, math
ROOT=os.path.dirname(os.path.abspath(__file__))
CACHE=os.path.join(ROOT,'.cache'); OUT=os.path.join(os.path.dirname(os.path.dirname(ROOT)),'assets','human')
REPORT=os.path.join(os.path.dirname(os.path.dirname(ROOT)),'reports','human-v2')
for d in (CACHE,OUT,REPORT): os.makedirs(d,exist_ok=True)
def mpfb():
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
    from bl_ext.blender_org.mpfb.services.targetservice import TargetService
    from bl_ext.blender_org.mpfb.services.rigservice import RigService
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService
    return HumanService,TargetService,RigService,LocationService
def config(): return json.load(open(os.path.join(ROOT,'config','humans.json')))
def fail(msg): print('CHECK FAILED:',msg); sys.exit(1)
def save_stage(name): bpy.ops.wm.save_as_mainfile(filepath=os.path.join(CACHE,name+'.blend'))
def open_stage(name): bpy.ops.wm.open_mainfile(filepath=os.path.join(CACHE,name+'.blend'))
def clear_scene():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
VIEWS={'front':0,'side':90,'back':180,'threequarter':-45}  # camera azimuth around the model, degrees; fixed for every report
def render_views(objs,path,views=('front','side','back','threequarter'),frame_height=2.1,res=(900,1100),engine='BLENDER_EEVEE_NEXT'):
    """Renders objs from the same fixed cameras and lights every time, one PNG per view (path-<view>.png)."""
    sc=bpy.context.scene; sc.render.engine=engine; sc.render.resolution_x,sc.render.resolution_y=res
    if not sc.world: sc.world=bpy.data.worlds.new('ReportWorld')
    sc.world.use_nodes=False; sc.world.color=(0.62,0.66,0.70); sc.view_settings.view_transform='AgX'; sc.view_settings.exposure=0
    def ensure(name,data):
        o=bpy.data.objects.get(name) or bpy.data.objects.new(name,data)
        if o.name not in sc.collection.objects: sc.collection.objects.link(o)
        return o
    cam=ensure('ReportCam',bpy.data.cameras.get('ReportCam') or bpy.data.cameras.new('ReportCam')); cam.data.type='ORTHO'; sc.camera=cam
    key=ensure('ReportKey',bpy.data.lights.get('ReportKey') or bpy.data.lights.new('ReportKey','SUN')); key.data.energy=3.0; key.rotation_euler=(math.radians(50),0,math.radians(35))
    fill=ensure('ReportFill',bpy.data.lights.get('ReportFill') or bpy.data.lights.new('ReportFill','SUN')); fill.data.energy=1.0; fill.rotation_euler=(math.radians(70),0,math.radians(-140))
    xs=[o.location.x for o in objs] or [0]; cx=(min(xs)+max(xs))/2; width=max(xs)-min(xs)+1.0
    files=[]
    for v in views:
        a=math.radians(VIEWS[v]); d=12
        cam.location=(cx+d*math.sin(a),-d*math.cos(a),frame_height/2); cam.rotation_euler=(math.radians(90),0,a)
        cam.data.ortho_scale=max(frame_height,width*res[1]/res[0])
        f=path.replace('.png',f'-{v}.png'); sc.render.filepath=f; bpy.ops.render.render(write_still=True); files.append(f)
    return files
```

```text
# tools/human/.gitignore
.cache/
```

- [ ] **Step 7: 시스템 에셋 팩 설치 스크립트**

makehuman_system_assets 팩 페이지(https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html)에서 zip 링크를 확인해 `ASSET_URL`에 적는다.

```python
# tools/human/setup_assets.py — blender -b --python-exit-code 1 --python tools/human/setup_assets.py
import os, sys, urllib.request
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from common import CACHE, mpfb, fail
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
ASSET_URL=os.environ.get('MH_SYSTEM_ASSETS_URL')
zip_path=os.path.join(CACHE,'makehuman_system_assets.zip')
if not AssetService.system_assets_pack_is_installed():
    if not os.path.exists(zip_path):
        if not ASSET_URL: fail('set MH_SYSTEM_ASSETS_URL to the zip link from the pack page')
        urllib.request.urlretrieve(ASSET_URL,zip_path)
    _,_,_,LocationService=mpfb()
    err=AssetService.fix_and_extract_asset_pack_zip(zip_path,LocationService.get_user_data())
    if err: fail('asset pack: '+err)
    AssetService.update_all_asset_lists()
if not AssetService.system_assets_pack_is_installed(): fail('system assets not installed')
print('SKINS',len(AssetService.list_mhmat_assets('skins')),'HAIR',len(AssetService.list_mhclo_assets('hair')),'EYEBROWS',len(AssetService.list_mhclo_assets('eyebrows')))
```

Run: `MH_SYSTEM_ASSETS_URL=<링크> /Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python tools/human/setup_assets.py`
Expected: `ASSETS <종류> <개수> | 이름[라이선스]…`. 라이선스는 파일 첫머리 주석("explicitly released as CC0")이나 `license` 줄에서 읽고, 목록은 `reports/human-v2/assets-licenses.json`에 저장한다. 결과(2026-09-26): 피부 23, 머리카락 10, 눈 2, 눈썹 12, 속눈썹 4, 치아 6, 전부 CC0.

- [ ] **Step 8: 담당표 갱신과 커밋**

`collaboration/ownership.json`에서 id가 01인 역할의 `paths` 배열에 위 새 경로 6개를 추가한다.

```bash
node --test --experimental-test-isolation=none tests/*.test.mjs
git add tools/human/common.py tools/human/setup_assets.py tools/human/.gitignore vendor/three-addons tests/human-v2.test.mjs collaboration/ownership.json
git commit -m "사람 모델 도구 준비: three r180 애드온, Blender 공용 헬퍼, 에셋 팩 설치"
```

---

### Task 2: 설정과 뼈 대응표 데이터

**Files:**
- Create: `tools/human/config/humans.json`, `tools/human/maps/game13.json`, `tools/human/maps/100style.json`, `tools/human/maps/cmu.json`, `tools/human/hand-poses.json`
- Test: `tests/human-v2.test.mjs`

**Interfaces:**
- Produces: `humans.json` 키 `bodies.{slim,standard,large}.macro/targets/heightRange`, `faces[8]`, `skinTones[4]`, `hair`, `hairColors[5]`, `kits.{field_short,field_long,gk}`; `game13.json` 키 `joints.{hips,torso,head,arms,legs}`, `sides.legs0`(태스크 3에서 채움); 대응표 `{source:{target,share?}}`

- [ ] **Step 1: 실패하는 테스트 추가**

```js
// tests/human-v2.test.mjs (추가)
const BODY22=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftShoulder','RightShoulder','LeftArm','RightArm','LeftForeArm','RightForeArm','LeftHand','RightHand','LeftUpLeg','RightUpLeg','LeftLeg','RightLeg','LeftFoot','RightFoot','LeftToeBase','RightToeBase'];
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
test('bone maps only target the 22 body bones and cover every source joint',()=>{
 const style=read('tools/human/maps/100style.json');
 const src100=['Hips','Chest','Chest2','Chest3','Chest4','Neck','Head','RightCollar','RightShoulder','RightElbow','RightWrist','LeftCollar','LeftShoulder','LeftElbow','LeftWrist','RightHip','RightKnee','RightAnkle','RightToe','LeftHip','LeftKnee','LeftAnkle','LeftToe'];
 assert.deepEqual(Object.keys(style.bones).sort(),src100.sort());
 for(const m of [style,read('tools/human/maps/cmu.json')])for(const v of Object.values(m.bones))if(v)assert.ok(BODY22.includes(v.target),v.target);
 const g=read('tools/human/maps/game13.json');
 for(const j of Object.values(g.joints))for(const part of j.bones)assert.ok(BODY22.includes(part.bone),part.bone);
});
test('body presets stay in the footballer ranges',()=>{
 const c=read('tools/human/config/humans.json');
 assert.deepEqual(Object.keys(c.bodies),['slim','standard','large']);
 for(const b of Object.values(c.bodies)){assert.ok(b.heightRange[0]>=1.70&&b.heightRange[1]<=1.95);assert.ok(b.macro.weight<=0.35&&b.macro.muscle>=0.5);}
 assert.equal(c.faces.length,8);assert.equal(c.skinTones.length,4);assert.equal(c.hairColors.length,5);
 assert.deepEqual(Object.keys(c.kits),['field_short','field_long','gk']);
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (파일 없음)

- [ ] **Step 3: 데이터 파일 작성**

```json
// tools/human/maps/100style.json
{"source":"100STYLE BVH (CC BY 4.0), T-pose, cm, Y-up, 60 fps",
 "bones":{"Hips":{"target":"Hips"},"Chest":{"target":"Spine"},"Chest2":{"target":"Spine1"},"Chest3":{"target":"Spine2","compose":"first"},"Chest4":{"target":"Spine2","compose":"second"},
  "Neck":{"target":"Neck"},"Head":{"target":"Head"},
  "LeftCollar":{"target":"LeftShoulder"},"LeftShoulder":{"target":"LeftArm"},"LeftElbow":{"target":"LeftForeArm"},"LeftWrist":{"target":"LeftHand"},
  "RightCollar":{"target":"RightShoulder"},"RightShoulder":{"target":"RightArm"},"RightElbow":{"target":"RightForeArm"},"RightWrist":{"target":"RightHand"},
  "LeftHip":{"target":"LeftUpLeg"},"LeftKnee":{"target":"LeftLeg"},"LeftAnkle":{"target":"LeftFoot"},"LeftToe":{"target":"LeftToeBase"},
  "RightHip":{"target":"RightUpLeg"},"RightKnee":{"target":"RightLeg"},"RightAnkle":{"target":"RightFoot"},"RightToe":{"target":"RightToeBase"}}}
```

```json
// tools/human/maps/cmu.json
{"source":"CMU ASF/AMC, 31 bones",
 "bones":{"root":{"target":"Hips"},"lowerback":{"target":"Spine"},"upperback":{"target":"Spine1"},"thorax":{"target":"Spine2"},"lowerneck":{"target":"Neck"},"upperneck":{"target":"Neck","compose":"second"},"head":{"target":"Head"},
  "lclavicle":{"target":"LeftShoulder"},"lhumerus":{"target":"LeftArm"},"lradius":{"target":"LeftForeArm"},"lwrist":{"target":"LeftHand"},"lhand":null,"lfingers":null,"lthumb":null,
  "rclavicle":{"target":"RightShoulder"},"rhumerus":{"target":"RightArm"},"rradius":{"target":"RightForeArm"},"rwrist":{"target":"RightHand"},"rhand":null,"rfingers":null,"rthumb":null,
  "lhipjoint":null,"lfemur":{"target":"LeftUpLeg"},"ltibia":{"target":"LeftLeg"},"lfoot":{"target":"LeftFoot"},"ltoes":{"target":"LeftToeBase"},
  "rhipjoint":null,"rfemur":{"target":"RightUpLeg"},"rtibia":{"target":"RightLeg"},"rfoot":{"target":"RightFoot"},"rtoes":{"target":"RightToeBase"}}}
```

```json
// tools/human/maps/game13.json
{"note":"Old 13-joint rig (src/player.js createPlayer) -> new 22-bone rig. write = how a rotation for the old joint is spread; read = which bone stands for the old joint.",
 "joints":{
  "hips":{"bones":[{"bone":"Hips","share":1}],"read":"Hips"},
  "torso":{"bones":[{"bone":"Spine","share":0.3},{"bone":"Spine1","share":0.3},{"bone":"Spine2","share":0.4}],"read":"Spine2"},
  "head":{"bones":[{"bone":"Neck","share":0.4},{"bone":"Head","share":0.6}],"read":"Head"},
  "arms0.upper":{"bones":[{"bone":"RightArm","share":1}],"read":"RightArm"},"arms0.lower":{"bones":[{"bone":"RightForeArm","share":1}],"read":"RightForeArm"},
  "arms1.upper":{"bones":[{"bone":"LeftArm","share":1}],"read":"LeftArm"},"arms1.lower":{"bones":[{"bone":"LeftForeArm","share":1}],"read":"LeftForeArm"},
  "legs0.upper":{"bones":[{"bone":"RightUpLeg","share":1}],"read":"RightUpLeg"},"legs0.lower":{"bones":[{"bone":"RightLeg","share":1}],"read":"RightLeg"},"legs0.foot":{"bones":[{"bone":"RightFoot","share":1}],"read":"RightFoot"},
  "legs1.upper":{"bones":[{"bone":"LeftUpLeg","share":1}],"read":"LeftUpLeg"},"legs1.lower":{"bones":[{"bone":"LeftLeg","share":1}],"read":"LeftLeg"},"legs1.foot":{"bones":[{"bone":"LeftFoot","share":1}],"read":"LeftFoot"}},
 "sides":{"legs0":"pending: confirmed by 01_body.py","note":"old rig: legs[0]/arms[0] sit at x<0 and the player faces +z"}}
```

(`legs0`은 아직 추정: 지금 리그는 +z를 보고 x<0에 legs[0]이 있으므로 선수의 **오른쪽**이다. 태스크 3에서 새 리그 위치로 확인해 `sides.legs0`을 `"Right"` 또는 `"Left"`로 적고, 틀렸으면 위 대응을 서로 바꾼다.)

```json
// tools/human/hand-poses.json
{"bones":"near only: Left/Right Hand{Thumb,Index,Middle,Ring,Pinky}{1,2,3}",
 "poses":{"relaxed":{"curl":{"Thumb":0.25,"Index":0.35,"Middle":0.45,"Ring":0.55,"Pinky":0.6},"spread":0.05},
  "open":null,"fist":null,"gk_catch":null,"gk_punch":null}}
```

```json
// tools/human/config/humans.json
{"referenceHeight":1.83,
 "bodies":{
  "slim":{"heightRange":[1.70,1.80],"macro":{"gender":1.0,"age":0.5,"muscle":0.55,"weight":0.2,"proportions":0.85},"targets":{"legs/l-upperleg-muscle-incr":0.35,"legs/r-upperleg-muscle-incr":0.35,"legs/l-lowerleg-muscle-incr":0.3,"legs/r-lowerleg-muscle-incr":0.3,"torso/measure-shoulder-dist-decr":0.2}},
  "standard":{"heightRange":[1.75,1.85],"macro":{"gender":1.0,"age":0.5,"muscle":0.65,"weight":0.25,"proportions":0.85},"targets":{"legs/l-upperleg-muscle-incr":0.55,"legs/r-upperleg-muscle-incr":0.55,"legs/l-lowerleg-muscle-incr":0.45,"legs/r-lowerleg-muscle-incr":0.45}},
  "large":{"heightRange":[1.85,1.95],"macro":{"gender":1.0,"age":0.55,"muscle":0.7,"weight":0.3,"proportions":0.85},"targets":{"legs/l-upperleg-muscle-incr":0.6,"legs/r-upperleg-muscle-incr":0.6,"legs/l-lowerleg-muscle-incr":0.5,"legs/r-lowerleg-muscle-incr":0.5,"torso/measure-shoulder-dist-incr":0.3}}},
 "faces":[
  {"id":"f1","targets":{"chin/chin-width-decr":0.3,"nose/nose-width1-decr":0.2,"eyes/r-eye-height2-incr":0.1}},
  {"id":"f2","targets":{"cheek/l-cheek-bones-incr":0.4,"cheek/r-cheek-bones-incr":0.4,"chin/chin-jutting-incr":0.2}},
  {"id":"f3","targets":{"nose/nose-hump-incr":0.4,"forehead/forehead-scale-vert-incr":0.2}},
  {"id":"f4","targets":{"mouth/mouth-scale-horiz-incr":0.3,"chin/chin-width-incr":0.3}},
  {"id":"f5","targets":{"eyes/l-eye-size-decr":0.2,"eyes/r-eye-size-decr":0.2,"nose/nose-scale-vert-incr":0.3}},
  {"id":"f6","targets":{"head/head-square":0.4,"chin/chin-prominent-incr":0.3}},
  {"id":"f7","targets":{"head/head-oval":0.5,"nose/nose-point-width-decr":0.3}},
  {"id":"f8","targets":{"cheek/l-cheek-inner-decr":0.3,"cheek/r-cheek-inner-decr":0.3,"mouth/mouth-lowerlip-volume-incr":0.3}}],
 "skinTones":["light","medium","tan","dark"],
 "hair":{"short":4,"long":1},
 "hairColors":["#1b1410","#3a2718","#6b4a2b","#b58a55","#2a2a2a"],
 "kits":{"field_short":{"shirt":"short","pants":"shorts","gloves":false},"field_long":{"shirt":"long","pants":"shorts","gloves":false},"gk":{"shirt":"long","pants":["shorts","long"],"gloves":true}}}
```

얼굴 타깃 이름은 MPFB `data/targets`의 실제 파일명과 맞아야 한다. 태스크 4 시작 때 스크립트가 없는 이름을 만나면 실패하도록 해서 고친다.

- [ ] **Step 4: 테스트 통과 확인** — Expected: PASS
- [ ] **Step 5: 커밋** — `git add tools/human/config tools/human/maps tools/human/hand-poses.json tests/human-v2.test.mjs && git commit -m "사람 모델 설정과 뼈 대응표(100STYLE, CMU, 기존 13관절)"`

---

### Task 3: `01_body.py` — 기본 몸, 체형 3종, Mixamo 리그, 기본 뼈 위치, 몸 영역

**Files:**
- Create: `tools/human/blender/01_body.py`
- Produces files: `tools/human/.cache/01_body.blend`, `assets/human/rest-skeletons.json`, `reports/human-v2/01-body-front.png`, `-side.png`
- Modify: `tools/human/maps/game13.json` (`sides.legs0`)
- Test: `tests/human-v2.test.mjs`

**Interfaces:**
- Consumes: `common.py` (태스크 1), `humans.json` bodies (태스크 2)
- Produces:
  - .blend 안 객체 `Body`(메시), `Rig`(아마추어, 뼈 이름에서 `mixamorig:` 제거됨)
  - `Body`의 셰이프키 `body_slim`, `body_large`(기준 standard 대비 차이)
  - 정점 속성 `_REGION`(INT, 정점 도메인)
  - `rest-skeletons.json`: `{"referenceHeight":1.83,"bones":{name:{"parent":str|null}},"bodies":{slim|standard|large:{name:{"head":[x,y,z],"tail":[x,y,z],"roll":r}}},"units":"m, glTF axes (Y up, +Z forward)"}`

- [ ] **Step 1: 실패하는 테스트 추가**

```js
test('rest skeletons: 52 bones, same names for every body, 22-bone body subset, legs side recorded',()=>{
 const r=read('assets/human/rest-skeletons.json');
 assert.equal(Object.keys(r.bones).length,52);
 for(const b of BODY22)assert.ok(r.bones[b],b);
 for(const k of ['slim','standard','large'])assert.deepEqual(Object.keys(r.bodies[k]).sort(),Object.keys(r.bones).sort());
 const head=k=>r.bodies[k].Head.head[1];assert.ok(head('slim')<head('standard')+0.001&&head('large')>head('standard')-0.001,'height order');
 assert.ok(r.bodies.standard.LeftUpLeg.head[0]>0,'glTF: LeftUpLeg at +x when facing +z');
 assert.match(read('tools/human/maps/game13.json').sides.legs0,/^(Left|Right)$/);
});
```

- [ ] **Step 2: 실패 확인** — Expected: FAIL (파일 없음)

- [ ] **Step 3: 스크립트 작성**

```python
# tools/human/blender/01_body.py
import bpy, bmesh, os, sys, json, math
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import ROOT, OUT, REPORT, mpfb, config, fail, save_stage, clear_scene, render_views
from mathutils import Vector
HumanService,TargetService,RigService,LocationService=mpfb()
cfg=config(); H=cfg['referenceHeight']
TARGETS=LocationService.get_mpfb_data('targets')

def body_height(obj):
    """Height of the visible body (the 'body' vertex group), evaluated with shape keys."""
    dg=bpy.context.evaluated_depsgraph_get(); ev=obj.evaluated_get(dg); me=ev.to_mesh()
    g=obj.vertex_groups['body'].index; zs=[(obj.matrix_world@v.co).z for v in me.vertices if any(x.group==g for x in v.groups)]
    ev.to_mesh_clear(); return max(zs)-min(zs)

def make_body(name,spec):
    macro=TargetService.get_default_macro_info_dict(); macro.update(spec['macro'])
    obj=HumanService.create_human(macro_detail_dict=macro,scale=0.1); obj.name=name
    for t,w in spec['targets'].items():
        p=os.path.join(TARGETS,t+'.target.gz')
        if not os.path.exists(p): fail('missing target '+t)
        TargetService.load_target(obj,p,weight=w)
    # Height macro: search so the body reaches the reference height, then the exact rest is 1.83 m.
    from bl_ext.blender_org.mpfb.entities.objectproperties import HumanObjectProperties
    lo,hi=0.0,1.0
    for _ in range(12):
        mid=(lo+hi)/2
        HumanObjectProperties.set_value('height',mid,entity_reference=obj); TargetService.reapply_macro_details(obj)
        if body_height(obj)<H: lo=mid
        else: hi=mid
    return obj

clear_scene()
bodies={k:make_body('Body_'+k,v) for k,v in cfg['bodies'].items()}
for k,o in bodies.items(): print('HEIGHT',k,round(body_height(o),4))

# One mesh with the standard body as basis and slim/large as shape keys (same topology).
base=bodies['standard']
def bake(obj):
    dg=bpy.context.evaluated_depsgraph_get(); ev=obj.evaluated_get(dg); me=ev.to_mesh(); co=[v.co.copy() for v in me.vertices]; ev.to_mesh_clear(); return co
co={k:bake(o) for k,o in bodies.items()}
body=base.copy(); body.data=base.data.copy(); body.name='Body'; bpy.context.scene.collection.objects.link(body)
body.shape_key_clear()
for i,v in enumerate(body.data.vertices): v.co=co['standard'][i]
body.shape_key_add(name='Basis')
for k in ('slim','large'):
    sk=body.shape_key_add(name='body_'+k)
    for i,c in enumerate(co[k]): sk.data[i].co=c

# Rig per body type (MPFB refits joints to each shape), then keep the standard rig for the mesh.
rest={}
def to_gltf(v): return [round(v.x,5),round(v.z,5),round(-v.y,5)]  # Blender Z-up,-Y forward -> glTF Y-up,+Z forward
bones=None
for k,o in bodies.items():
    before={a.name for a in bpy.data.objects if a.type=='ARMATURE'}
    HumanService.add_builtin_rig(o,'mixamo')
    arm=[a for a in bpy.data.objects if a.type=='ARMATURE' and a.name not in before][0]
    for b in arm.data.bones: b.name=b.name.replace('mixamorig:','')
    if bones is None: bones={b.name:{'parent':b.parent.name if b.parent else None} for b in arm.data.bones}
    rest[k]={b.name:{'head':to_gltf(arm.matrix_world@b.head_local),'tail':to_gltf(arm.matrix_world@b.tail_local),'roll':0.0} for b in arm.data.bones}
    if k=='standard': arm.name='Rig'; std_arm=arm
    else: bpy.data.objects.remove(arm,do_unlink=True)
for k,o in bodies.items(): bpy.data.objects.remove(o,do_unlink=True)
# Re-bind the combined mesh to the standard rig with MPFB mixamo weights.
body.parent=std_arm; RigService.ensure_armature_modifier(body,std_arm)
w=json.load(open(os.path.join(LocationService.get_mpfb_data('rigs'),'standard','weights.mixamo.json')))
RigService.apply_weights([std_arm],body,w)
for g in body.vertex_groups:
    if g.name.startswith('mixamorig:'): g.name=g.name.replace('mixamorig:','')

# Which side is the old legs[0]? Old rig: legs[0] at x<0 while facing +z.
left_x=rest['standard']['LeftUpLeg']['head'][0]
legs0='Left' if left_x<0 else 'Right'
gpath=os.path.join(ROOT,'maps','game13.json'); g13=json.load(open(gpath)); g13['sides']['legs0']=legs0
if legs0=='Left':  # swap the default Right mapping written in task 2
    for j,v in g13['joints'].items():
        for p in v['bones']: p['bone']=p['bone'].replace('Right','@').replace('Left','Right').replace('@','Left')
        v['read']=v['read'].replace('Right','@').replace('Left','Right').replace('@','Left')
json.dump(g13,open(gpath,'w'),indent=1); print('LEGS0',legs0)

# Body regions: cut lines shared by all kits. Region ids are assigned from bone weights + height bands.
REG={'head':0,'neck':1,'torso':2,'upperarm_hi':3,'upperarm_lo':4,'forearm':5,'hand':6,'pelvis':7,'thigh_hi':8,'thigh_lo':9,'knee':10,'shin':11,'foot':12}
attr=body.data.attributes.new('_REGION','INT','POINT')
vg={g.index:g.name for g in body.vertex_groups}
def top(v):
    best=max(((vg[x.group],x.weight) for x in v.groups if vg[x.group] in bones),key=lambda t:t[1],default=(None,0)); return best[0]
std=rest['standard']
for v in body.data.vertices:
    b=top(v) or 'Hips'; z=v.co.z
    if b in('Head',): r='head'
    elif b=='Neck': r='neck'
    elif b in('Spine','Spine1','Spine2','LeftShoulder','RightShoulder'): r='torso'
    elif b.endswith('Arm') and not b.endswith('ForeArm'):
        a=std[b]; mid=(a['head'][1]+a['tail'][1])/2; r='upperarm_hi' if z>mid else 'upperarm_lo'
    elif b.endswith('ForeArm'): r='forearm'
    elif 'Hand' in b: r='hand'
    elif b=='Hips': r='pelvis'
    elif b.endswith('UpLeg'):
        a=std[b]; mid=(a['head'][1]+a['tail'][1])/2; r='thigh_hi' if z>mid else 'thigh_lo'
    elif b.endswith('Leg'):
        a=std[b]; r='knee' if z>a['head'][1]-0.08 else 'shin'
    else: r='foot'
    attr.data[v.index].value=REG[r]

json.dump({'referenceHeight':H,'units':'m, glTF axes (Y up, +Z forward)','bones':bones,'bodies':rest,'regions':REG},open(os.path.join(OUT,'rest-skeletons.json'),'w'),indent=1)
if len(bones)!=52: fail('expected 52 bones, got %d'%len(bones))
save_stage('01_body')

# Report: the three bodies side by side, rig visible.
objs=[]
for i,k in enumerate(('slim','standard','large')):
    o=body.copy(); o.data=body.data; bpy.context.scene.collection.objects.link(o); o.location.x=(i-1)*0.9
    o.show_only_shape_key=True; o.active_shape_key_index={'slim':1,'standard':0,'large':2}[k]; objs.append(o)
body.hide_render=True
render_views(objs,os.path.join(REPORT,'01-body.png'),views=('front','side'))
print('DONE 01_body')
```

체형별 다른 스켈레톤을 한 메시에 쓰는 규칙은 설계 3장을 따른다: 메시는 standard 리그에 바인딩되고, 체형 모프를 쓸 때는 `rest-skeletons.json`의 해당 체형 위치로 뼈를 옮긴 뒤 역행렬을 다시 계산한다.

- [ ] **Step 4: 실행**

Run: `/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python tools/human/blender/01_body.py 2>&1 | grep -E "HEIGHT|LEGS0|DONE|CHECK FAILED|Traceback|Error"`
Expected: `HEIGHT slim 1.83`, `HEIGHT standard 1.83`, `HEIGHT large 1.83`(±0.005), `LEGS0 Right` 또는 `Left`, `DONE 01_body`

- [ ] **Step 5: 테스트 통과 확인** — `node --test --experimental-test-isolation=none tests/human-v2.test.mjs` / Expected: PASS
- [ ] **Step 6: 커밋** — `git add tools/human/blender/01_body.py tools/human/maps/game13.json assets/human/rest-skeletons.json reports/human-v2/01-body-*.png tests/human-v2.test.mjs && git commit -m "01_body: MPFB 몸, 체형 3종, Mixamo 리그, 기본 뼈 위치, 몸 영역"`
- [ ] **Step 7: 체크포인트 — 렌더 이미지(정면·측면) 보여주고 멈춤.** 사용자 확인 사항: 체형 3종 인상(윙어/미드필더/수비수), 비율, legs[0] 결과.

---

### Task 4: `02_faces.py` — 얼굴 프리셋 8개

**Files:** Create `tools/human/blender/02_faces.py`; produces `.cache/02_faces.blend`, `reports/human-v2/02-faces.png`

**Interfaces:** Consumes `Body`, `Rig` from `01_body.blend`, `humans.json.faces`. Produces 셰이프키 `face_f1`…`face_f8`(Basis 대비 차이, 머리·목 정점만 0이 아님).

- [ ] **Step 1: 테스트** — `tests/human-v2.test.mjs`에 추가(태스크 9의 GLB 검사에서 모프 이름을 확인하므로 여기서는 Blender 내부 검사로 대체):

```python
# 02_faces.py 끝의 자체 검사
keys=[k.name for k in body.data.shape_keys.key_blocks]
for f in cfg['faces']:
    if 'face_'+f['id'] not in keys: fail('missing '+f['id'])
```

- [ ] **Step 2: 스크립트 작성**

```python
# tools/human/blender/02_faces.py
import bpy, os, sys
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import REPORT, mpfb, config, fail, save_stage, open_stage, render_views
HumanService,TargetService,RigService,LocationService=mpfb()
open_stage('01_body'); cfg=config(); body=bpy.data.objects['Body']; T=LocationService.get_mpfb_data('targets')
basis=[v.co.copy() for v in body.data.shape_keys.key_blocks['Basis'].data]
head_g={g.index for g in body.vertex_groups if g.name in('Head','Neck')}
for f in cfg['faces']:
    for k in body.data.shape_keys.key_blocks: k.value=0.0
    tmp=[]
    for t,w in f['targets'].items():
        p=os.path.join(T,t+'.target.gz')
        if not os.path.exists(p): fail('missing face target '+t)
        TargetService.load_target(body,p,weight=w); k=body.data.shape_keys.key_blocks[-1]; k.value=w; tmp.append(k.name)
    # Bake the weighted mix of this face's targets into one key, then drop the loose targets.
    mix=body.shape_key_add(name='face_'+f['id'],from_mix=True)
    for n in tmp: body.shape_key_remove(body.data.shape_keys.key_blocks[n])
    for k in body.data.shape_keys.key_blocks: k.value=0.0
# Faces only move head/neck vertices.
for k in body.data.shape_keys.key_blocks:
    if not k.name.startswith('face_'): continue
    for i,v in enumerate(body.data.vertices):
        if not any(x.group in head_g and x.weight>0.05 for x in v.groups): k.data[i].co=basis[i]
keys=[k.name for k in body.data.shape_keys.key_blocks]
for f in cfg['faces']:
    if 'face_'+f['id'] not in keys: fail('missing '+f['id'])
save_stage('02_faces')
# Report: 8 heads in a row (close-up).
objs=[]
for i,f in enumerate(cfg['faces']):
    o=body.copy(); o.data=body.data; bpy.context.scene.collection.objects.link(o); o.location.x=i*0.35
    o.show_only_shape_key=True; o.active_shape_key_index=keys.index('face_'+f['id']); objs.append(o)
body.hide_render=True
render_views(objs,os.path.join(REPORT,'02-faces.png'),views=('front',),height=0.45)
print('DONE 02_faces')
```

(믹스 전에 다른 셰이프키를 모두 0으로 두고, 이 얼굴의 타깃만 가중치대로 켠 상태에서 `from_mix=True`로 한 키에 굽는다.)

- [ ] **Step 3: 실행** — `… --python tools/human/blender/02_faces.py` / Expected: `DONE 02_faces`, 실패 없음
- [ ] **Step 4: 커밋** — `git add tools/human/blender/02_faces.py reports/human-v2/02-faces-*.png && git commit -m "02_faces: 얼굴 프리셋 8개"`
- [ ] **Step 5: 체크포인트 — 얼굴 8개 렌더 보여주고 멈춤.** (실제 선수를 닮지 않았는지, 과한 변형 없는지 확인)

---

### Task 5: `03_skin_bake.py` — 피부톤 4개 텍스처 굽기

**Files:** Create `tools/human/blender/03_skin_bake.py`; produces `.cache/textures/skin_{tone}_{2048,1024,512}_{color,normal,rough}.png`, `.cache/03_skin.blend`, `reports/human-v2/03-skin.png`

**Interfaces:** Consumes `02_faces.blend`. Produces 재질 슬롯 `Skin`(glTF용: Base Color/Normal/Roughness 이미지 노드만), 톤별 텍스처 파일 이름 규칙 위와 같음.

- [ ] **Step 1: 시작 전 확인** — 태스크 1의 `SKINS` 목록에서 남성 피부 4개(밝음·중간·황갈·어두움)를 골라 `humans.json`의 `skinTones`를 `{"id":"light","mhmat":"skins/<파일>.mhmat"}` 형식으로 바꾼다. 테스트 `c.skinTones.length===4`는 그대로 통과해야 한다.
- [ ] **Step 2: 스크립트 작성**

```python
# tools/human/blender/03_skin_bake.py
import bpy, os, sys
sys.path.insert(0,os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from common import CACHE, REPORT, mpfb, config, fail, save_stage, open_stage, render_views
HumanService,TargetService,RigService,LocationService=mpfb()
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
open_stage('02_faces'); cfg=config(); body=bpy.data.objects['Body']; tex=os.path.join(CACHE,'textures'); os.makedirs(tex,exist_ok=True)
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.samples=16; sc.cycles.device='GPU'
def bake(kind,img):
    mat=body.active_material; nt=mat.node_tree; n=nt.nodes.new('ShaderNodeTexImage'); n.image=img; nt.nodes.active=n
    sc.render.bake.use_pass_direct=sc.render.bake.use_pass_indirect=False
    bpy.ops.object.bake(type={'color':'DIFFUSE','normal':'NORMAL','rough':'ROUGHNESS'}[kind]); nt.nodes.remove(n)
bpy.context.view_layer.objects.active=body; body.select_set(True)
for tone in cfg['skinTones']:
    path=AssetService.find_asset_absolute_path(tone['mhmat'],'skins') or fail('skin '+tone['mhmat'])
    HumanService.set_character_skin(path,body,skin_type='MAKESKIN')  # texture-based, bakeable
    for size in (2048,1024,512):
        for kind in ('color','normal','rough'):
            img=bpy.data.images.new(f"skin_{tone['id']}_{size}_{kind}",size,size,alpha=False,is_data=kind!='color')
            bake(kind,img); img.filepath_raw=os.path.join(tex,img.name+'.png'); img.file_format='PNG'; img.save()
# glTF-ready material: three image nodes -> Principled.
mat=bpy.data.materials.new('Skin'); mat.use_nodes=True; nt=mat.node_tree; P=nt.nodes['Principled BSDF']
def img(kind,tone='medium',size=2048): n=nt.nodes.new('ShaderNodeTexImage'); n.image=bpy.data.images.load(os.path.join(tex,f'skin_{tone}_{size}_{kind}.png')); return n
c=img('color'); nt.links.new(c.outputs[0],P.inputs['Base Color'])
r=img('rough'); r.image.colorspace_settings.name='Non-Color'; nt.links.new(r.outputs[0],P.inputs['Roughness'])
n=img('normal'); n.image.colorspace_settings.name='Non-Color'; nm=nt.nodes.new('ShaderNodeNormalMap'); nt.links.new(n.outputs[0],nm.inputs['Color']); nt.links.new(nm.outputs[0],P.inputs['Normal'])
body.data.materials.clear(); body.data.materials.append(mat)
save_stage('03_skin')
render_views([body],os.path.join(REPORT,'03-skin.png'),views=('front',))
print('DONE 03_skin')
```

- [ ] **Step 3: 실행과 확인** — Expected: 텍스처 36장(4톤×3크기×3종), `DONE 03_skin`
- [ ] **Step 4: 커밋** — 스크립트와 리포트 이미지(텍스처 원본은 .cache라 커밋 안 함)
- [ ] **Step 5: 체크포인트 — 피부톤 4개 클로즈업 렌더 보여주고 멈춤.** 눈썹 굽기는 태스크 6에서 머리카락과 같이 한다.

---

### Task 6: `04_hair.py` — 머리카락·눈썹·속눈썹·눈·치아

**Files:** Create `tools/human/blender/04_hair.py`; produces `.cache/04_hair.blend`, `.cache/textures/hair_*.png`, `reports/human-v2/04-hair.png`

**Interfaces:** Produces 객체 `Hair_<id>`(near 카드, 머리카락별), `HairShell_<id>`(mid 껍질), `Eyes`, `Teeth`, `Eyelashes`, `Eyebrows`(near), `EyebrowBake`(mid 피부에 구울 텍스처 `brows_<size>.png`). 모든 객체는 `Rig`에 Armature 모디파이어로 연결.

- [ ] **Step 1: 시작 전 확인** — 태스크 1 목록에서 CC0 머리카락 중 짧은 4개, 긴 1개를 골라 `humans.json.hair`를 `{"short":["hair/<a>.mhclo",…],"long":["hair/<b>.mhclo"]}`로 바꾸고 테스트를 `hair.short.length===4`로 고친다.
- [ ] **Step 2: 스크립트** — 핵심 코드:

```python
# tools/human/blender/04_hair.py (핵심)
from bl_ext.blender_org.mpfb.services.assetservice import AssetService
def add(asset,kind):
    p=AssetService.find_asset_absolute_path(asset,kind) or fail('asset '+asset)
    before=set(bpy.data.objects); HumanService.add_mhclo_asset(p,body,asset_type=kind.capitalize() if kind!='hair' else 'Hair',subdiv_levels=0,material_type='MAKESKIN')
    return [o for o in bpy.data.objects if o not in before][0]
for i,a in enumerate(cfg['hair']['short']+cfg['hair']['long']):
    o=add(a,'hair'); o.name=f'Hair_{i}'
    # Mid LOD shell: shrinkwrap a copy of the scalp region onto the card hull, 1 cm out.
    shell=make_shell(o,body,offset=0.01); shell.name=f'HairShell_{i}'
for kind,asset in (('eyes','eyes/<eyes>.mhclo'),('eyebrows','eyebrows/<brows>.mhclo'),('eyelashes','eyelashes/<lashes>.mhclo'),('teeth','teeth/<teeth>.mhclo')):
    add(asset,kind).name=kind.capitalize()
```

`make_shell`: 머리 정점 그룹(`helper-hair`)을 복제해 머리카락 메시에 Shrinkwrap(Project, 바깥쪽)→적용→1 cm Displace, 머리카락 색 텍스처를 카드에서 Cycles `Selected to Active`로 굽는다. 눈썹 `EyebrowBake`도 같은 방식으로 피부 UV에 굽는다. 머리카락 재질은 glTF에서 `alphaMode: MASK`로 내보내고, 뷰어에서 `alphaHash=true`로 바꾼다.

(`<eyes>` 등 실제 파일명은 Step 1 목록으로 채운다.)
- [ ] **Step 3: 실행·커밋**
- [ ] **Step 4: 체크포인트 — 머리 모양 5개 × 머리색 샘플 렌더 보여주고 멈춤.**

---

### Task 7: `05_kit.py` — 유니폼 3종, 정강이 보호대, 축구화, 장갑, 마스크

**Files:** Create `tools/human/blender/05_kit.py`; produces `.cache/05_kit.blend`, `assets/human/kit-masks.json`, `.cache/textures/kit_{mask,normal}_*.png`, `reports/human-v2/05-kit-{front,side,back}.png`

**Interfaces:**
- Consumes `_REGION`(태스크 3)
- Produces 객체 `Kit_shirt_short`, `Kit_shirt_long`, `Kit_shorts`, `Kit_pants_long`, `Kit_socks`, `Kit_boots`, `Kit_gloves`(모두 Rig에 연결, UV0=천, UV1=번호 칸), `kit-masks.json` = `{"regions":{name:id},"hide":{"field_short":[ids],"field_long":[ids],"gk_shorts":[ids],"gk_long":[ids]},"decal":{"back_number":[u0,v0,u1,v1],"back_name":[…],"front_number":[…]}}`

- [ ] **Step 1: 실패하는 테스트 추가**

```js
test('kit masks hide the covered body regions for every kit type',()=>{
 const m=read('assets/human/kit-masks.json'),R=m.regions;
 assert.ok(m.hide.field_short.includes(R.torso)&&!m.hide.field_short.includes(R.forearm));
 assert.ok(m.hide.field_long.includes(R.forearm)&&!m.hide.field_long.includes(R.hand));
 assert.ok(m.hide.gk_long.includes(R.shin)&&m.hide.gk_long.includes(R.hand));
 for(const k of ['back_number','back_name','front_number']){const d=m.decal[k];assert.ok(d.length===4&&d[2]>d[0]&&d[3]>d[1]);}
});
```

- [ ] **Step 2: 스크립트 — 영역별 복제·오프셋 핵심 코드**

```python
# tools/human/blender/05_kit.py (핵심)
OFF={'shirt':0.008,'shorts':0.012,'socks':0.002,'pants':0.01,'gloves':0.003}
PIECES={'shirt_short':['torso','upperarm_hi'],'shirt_long':['torso','upperarm_hi','upperarm_lo','forearm'],
        'shorts':['pelvis','thigh_hi'],'pants_long':['pelvis','thigh_hi','thigh_lo','knee','shin'],'socks':['shin'],'gloves':['hand']}
def piece(name,regions,offset,flare=0.0):
    o=body.copy(); o.data=body.data.copy(); o.name='Kit_'+name; bpy.context.scene.collection.objects.link(o)
    o.shape_key_clear(); bm=bmesh.new(); bm.from_mesh(o.data); lay=bm.verts.layers.int.get('_REGION')
    ids={REG[r] for r in regions}; bmesh.ops.delete(bm,geom=[f for f in bm.faces if not all(v[lay] in ids for v in f.verts)],context='FACES')
    for v in bm.verts: v.co+=v.normal*offset
    bm.to_mesh(o.data); bm.free()
    s=o.modifiers.new('hem','SOLIDIFY'); s.thickness=0.003; s.offset=1
    return o
# socks: shin guard bulge = extra 6 mm on the front 25-75 % of the shin
# shorts/shirt hems: flare outward from the bone axis by up to 1.5 cm at the hem ring
# weights: DataTransfer from Body (nearest face interpolated), then smooth across the crotch for shorts
# boots: foot region shell + extruded sole (8 mm), masks R=upper G=sole B=stripe
# kit mask texture: R=shirt G=shorts/pants B=socks A=trim, baked per piece via UV0 island colors
# decal UV1: project back/front number & name rectangles from an orthographic view, pack into 0-1
```

`hide` 목록은 각 유니폼 종류에서 완전히 덮이는 영역이다(밑단 안쪽 1 cm는 영역 경계가 보장).

| kit | hide |
|---|---|
| field_short | torso, upperarm_hi, pelvis, thigh_hi, shin, foot |
| field_long | + upperarm_lo, forearm |
| gk_shorts | field_long + hand |
| gk_long | gk_shorts + thigh_lo, knee |

- [ ] **Step 3: 실행·테스트·커밋**
- [ ] **Step 4: 체크포인트 — 유니폼 3종 정면·측면·뒷면 렌더(번호 칸 표시) 보여주고 멈춤.**

---

### Task 8: `06_lod.py` — mid·far 만들기

**Files:** Create `tools/human/blender/06_lod.py`; produces `.cache/06_lod.blend`, `reports/human-v2/06-lod.png`, `reports/human-v2/06-lod.json`(LOD별 삼각형·뼈·모프 수)

**Interfaces:** Produces 컬렉션 `LOD_near`, `LOD_mid`, `LOD_far`. 각 컬렉션의 몸·유니폼 객체는 같은 `Rig`(near) 또는 손가락을 지운 `Rig22` 복제에 연결. far 몸은 `face_*` 셰이프키 없음.

- [ ] **Step 1: 스크립트 — 셰이프키 보존 감량 핵심 코드**

```python
def reduce(src,ratio,keep_keys):
    lo=src.copy(); lo.data=src.data.copy(); lo.shape_key_clear(); link(lo)
    d=lo.modifiers.new('dec','DECIMATE'); d.ratio=ratio; d.use_symmetry=True; d.vertex_group='Head'; d.vertex_group_factor=0.5
    apply(lo,'dec')
    sd=lo.modifiers.new('sd','SURFACE_DEFORM'); sd.target=src; bind(lo,'sd')
    lo.shape_key_add(name='Basis')
    for k in keep_keys:
        src.data.shape_keys.key_blocks[k].value=1.0
        bpy.ops.object.modifier_apply_as_shapekey(modifier='sd',keep_modifier=True); lo.data.shape_keys.key_blocks[-1].name=k
        src.data.shape_keys.key_blocks[k].value=0.0
    lo.modifiers.remove(lo.modifiers['sd'])
    dt=lo.modifiers.new('w','DATA_TRANSFER'); dt.object=src; dt.use_vert_data=True; dt.data_types_verts={'VGROUP_WEIGHTS'}; apply(lo,'w')
    return lo
```

near 전체가 25,000을 넘으면 몸(가려진 면 제외 후)에 `reduce(ratio)`를 한 번 더 건다. 목표: near ≤ 25,000, mid ≤ 10,000, far ≤ 5,000 (몸+유니폼+머리 합). 기본 자세 일치 검사: `Rig`와 `Rig22`의 몸 22뼈 `matrix_local` 차이 < 1e-5.

- [ ] **Step 2: 실행·커밋**
- [ ] **Step 3: 체크포인트 — LOD 3개 나란히(가까이·경기 거리) 렌더와 `06-lod.json` 보여주고 멈춤.**

---

### Task 9: `07_export.py` + `compress.mjs` — GLB 내보내기와 압축

**Files:** Create `tools/human/blender/07_export.py`, `tools/human/compress.mjs`, `tools/human/build.sh`; produces `assets/human/player_{near,mid,far}.glb`, `assets/human/skin_{tone}_{lod}.ktx2`

**Interfaces:** Produces GLB 규칙: 스킨 1개, 뼈 이름 `mixamorig:` 없음, 모프 이름 `body_slim`, `body_large`, `face_f1..8`(far는 body만), 메시 이름 `Body`, `Kit_*`, `Hair_*`/`HairShell_*`, `Eyes`, `Teeth`, `Eyelashes`, `Eyebrows`, 몸 정점 속성 `_REGION`.

- [ ] **Step 1: 실패하는 테스트**

```js
test('exported LODs: budgets, bone names, morphs and region attribute',async()=>{
 const {NodeIO}=await import('@gltf-transform/core').catch(()=>({}));
 if(!NodeIO)return; // tool installed only for the build; skip in normal CI runs
 const io=new NodeIO(),limit={near:[25000,52,6e6],mid:[10000,22,1.5e6],far:[5000,22,0.4e6]};
 for(const [lod,[tris,bones,bytes]] of Object.entries(limit)){
  const f=`assets/human/player_${lod}.glb`;assert.ok(fs.statSync(f).size<=bytes,lod+' size');
  const doc=await io.read(f),root=doc.getRoot();let t=0;
  for(const m of root.listMeshes())for(const p of m.listPrimitives())t+=(p.getIndices()?.getCount()||0)/3;
  assert.ok(t<=tris,lod+' tris '+t);
  const joints=root.listSkins()[0].listJoints().map(j=>j.getName());assert.equal(joints.length,bones);assert.ok(joints.every(n=>!n.includes(':')));
  const body=root.listMeshes().find(m=>m.getName()==='Body'),names=body.getExtras().targetNames;
  assert.ok(names.includes('body_slim')&&names.includes('body_large'));assert.equal(names.some(n=>n.startsWith('face_')),lod!=='far');
  assert.ok(body.listPrimitives()[0].getAttribute('_REGION'));
 }
});
```

- [ ] **Step 2: 내보내기 핵심 코드**

```python
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_skins=True,export_morph=True,export_morph_normal=False,
  export_attributes=True,export_animations=False,export_yup=True,export_image_format='NONE',export_extras=True)
```

- [ ] **Step 3: 압축**

```js
// tools/human/compress.mjs
import {execFileSync} from 'node:child_process';import fs from 'node:fs';
const gt=(...a)=>execFileSync('npx',['-y','@gltf-transform/cli@4',...a],{stdio:'inherit'});
for(const lod of ['near','mid','far']){const i=`tools/human/.cache/player_${lod}.glb`,o=`assets/human/player_${lod}.glb`;
 gt('meshopt',i,o,'--level','medium');}
for(const f of fs.readdirSync('tools/human/.cache/textures').filter(f=>f.endsWith('.png'))){
 const isData=/normal|rough|mask/.test(f),src='tools/human/.cache/textures/'+f,dst='assets/human/'+f.replace('.png','.ktx2');
 execFileSync('toktx',isData?['--t2','--encode','uastc','--uastc_quality','2','--zcmp','18','--assign_oetf','linear',dst,src]:['--t2','--encode','etc1s','--clevel','4','--qlevel','192',dst,src],{stdio:'inherit'});}
const size=f=>fs.statSync('assets/human/'+f).size;console.log('near',size('player_near.glb'),'mid',size('player_mid.glb'),'far',size('player_far.glb'));
```

- [ ] **Step 4: 실행·테스트(`npm i --no-save @gltf-transform/core@4` 후)·커밋**
- [ ] **Step 5: 체크포인트 — 용량 표 보여주고 멈춤.**

---

### Task 10: 뷰어 `human-lab.html` — 선수 조립, LOD, 유니폼 재질, 기존 캐릭터 비교

**Files:** Create `human-lab.html`, `src/human-lab/load.js`, `assemble.js`, `lod.js`, `kit-material.js`, `view.js`; Test: `tests/human-v2.test.mjs`

**Interfaces:**
- `load.js`: `loadHumanAssets(renderer) → Promise<{near,mid,far,rest,masks}>`
- `assemble.js`: `createHuman(assets,{body:'slim'|'standard'|'large',height,face:'f1'..'f8',skin,hair,hairColor,kit,colors:{shirt,shorts,socks,trim,boots:[upper,sole,stripe]},number,name}) → {root,skeleton,lods:{near,mid,far},setKit(kind),setColors(c),metrics}`
- `metrics = bodyMetrics(rest,body,scale) → {height,legLength,hipHeight,footLength,reach,shoulderWidth,bodyRadius}`
- `lod.js`: `pickLod(pxHeight,current) → 'near'|'mid'|'far'` (220/80 px, ±10 % 히스테리시스), `crossfade(human,from,to,t)`(디더링 0.15 s, `customDepthMaterial` 포함)
- `kit-material.js`: `kitMaterial(maps,colors,decalTexture) → THREE.Material` (마스크 RGBA로 색 4개 섞음), `numberTexture(number,name) → THREE.CanvasTexture`

- [ ] **Step 1: 실패하는 테스트 (순수 함수)**

```js
test('LOD choice uses hysteresis and bodyMetrics scale with height',async()=>{
 const {pickLod}=await import('../src/human-lab/lod.js');
 assert.equal(pickLod(230,'mid'),'near');assert.equal(pickLod(215,'near'),'near');assert.equal(pickLod(195,'near'),'mid');
 assert.equal(pickLod(75,'mid'),'mid');assert.equal(pickLod(70,'mid'),'far');assert.equal(pickLod(90,'far'),'mid');
 const {bodyMetrics}=await import('../src/human-lab/assemble.js');const rest=read('assets/human/rest-skeletons.json');
 const a=bodyMetrics(rest,'standard',1),b=bodyMetrics(rest,'standard',1.07);
 assert.ok(Math.abs(b.legLength/a.legLength-1.07)<1e-6);assert.ok(Math.abs(a.height-1.83)<0.01);
});
```

- [ ] **Step 2: 구현 핵심 코드**

```js
// src/human-lab/lod.js
export const LOD_PX={near:220,mid:80},HYST=.1;
export function pickLod(px,cur){
 const up=t=>t*(1+HYST),down=t=>t*(1-HYST);
 if(cur==='near')return px<down(LOD_PX.near)?(px<down(LOD_PX.mid)?'far':'mid'):'near';
 if(cur==='mid')return px>up(LOD_PX.near)?'near':px<down(LOD_PX.mid)?'far':'mid';
 return px>up(LOD_PX.near)?'near':px>up(LOD_PX.mid)?'mid':'far';
}
```

```js
// src/human-lab/assemble.js (bodyMetrics)
const len=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
export function bodyMetrics(rest,body,s){
 const r=rest.bodies[body],L=k=>r[k];
 const leg=len(L('RightUpLeg').head,L('RightLeg').head)+len(L('RightLeg').head,L('RightFoot').head)+L('RightFoot').head[1];
 const top=L('Head').tail[1],foot=len(L('RightFoot').head,L('RightToeBase').tail);
 return {height:top*s,legLength:leg*s,hipHeight:L('Hips').head[1]*s,footLength:foot*s,reach:(leg+foot*.6)*s,
  shoulderWidth:len(L('LeftArm').head,L('RightArm').head)*s,bodyRadius:.5*len(L('LeftArm').head,L('RightArm').head)*s*.62};
}
```

`createHuman` 순서: GLB 장면 복제(`SkeletonUtils.clone`) → 모프 값(`body_*`, `face_*`) → `rest.bodies[body]` 위치로 뼈 이동 → `skeleton.calculateInverses()` → `root.scale.setScalar(s)` → `_REGION`으로 kit별 인덱스 버퍼 4개 만들어 캐시(geometry마다 1회) → `setKit`이 몸 인덱스와 유니폼 메시 표시를 바꿈.

화면: 조명 모드(스튜디오 HDRI / 게임: `src/main.js`의 조명·`renderer.toneMapping`·노출 값을 그대로 복사), 카메라 프리셋(정면·측면·클로즈업·경기: `src/camera.js`의 방송 카메라 거리와 화각), 22명 배치·fps 표시, 기존 캐릭터(`src/player.js`의 `createPlayer`) 옆에 세우기.

- [ ] **Step 3: 테스트 통과·브라우저 확인(`node server.mjs` 후 `/human-lab.html`)**
- [ ] **Step 4: 커밋**
- [ ] **Step 5: 체크포인트 — 스튜디오·게임 조명에서 기존 캐릭터와 나란히 (정면·측면·클로즈업·경기 거리) 스크린샷 보여주고 멈춤.**

---

### Task 11: `retarget_min.py` + `08_checks.py` — 자세·모캡 뚫림, 키 스케일 발 미끄러짐

**Files:** Create `tools/human/blender/retarget_min.py`, `tools/human/blender/08_checks.py`; produces `reports/human-v2/08-checks.json`, `08-poses-*.png`, `08-mocap-*.png`

**Interfaces:** `retarget_min.retarget(src_armature, map_json, dst_rig, frames) → action` (월드 회전: 각 프레임 `dst_world = src_world · src_rest⁻¹ · dst_rest`, 대응표 `compose`는 순서대로 곱함, Hips 위치는 다리 길이 비율로 스케일). `08_checks`는 결과 JSON `{poses:{body:{kit:{pose:penetrations}}},mocap:{clip:{body:{kit:max_penetrations}}},extremes:{…},footSlide:{scale:{clip:cm}}}`.

- [ ] **Step 1: 데이터 받기** — 100STYLE Neutral의 FR·SR·BR과 스타일 1개(예: `Kick_FR`)를 태스크 조사 때 쓴 HTTP 범위 요청 방식으로 `.cache/100style/`에 받는다. CMU `10.asf`, `10_02.amc`는 mocap.cs.cmu.edu에서 받아 MPFB의 BVH 대신 Blender ASF 임포트가 없으므로 `tools/convert-mocap.mjs`의 ASF 파서를 재사용해 BVH로 바꾼다.
- [ ] **Step 2: 뚫림 계산 코드**

```python
def penetrations(body,kit_objs,hide_ids):
    """Body vertices within 3 cm of a hem that poke outside the kit surface (ray along the vertex normal)."""
    dg=bpy.context.evaluated_depsgraph_get(); b=body.evaluated_get(dg).to_mesh(); count=0
    kits=[k.evaluated_get(dg) for k in kit_objs]
    for v in b.vertices:
        if body.data.attributes['_REGION'].data[v.index].value in hide_ids: continue
        if not near_hem(v): continue
        for k in kits:
            hit,loc,*_=k.ray_cast(k.matrix_world.inverted()@(body.matrix_world@v.co),v.normal,distance=0.03)
            if not hit: continue
        # a visible body vertex that has kit surface *behind* it along -normal is outside the kit
        for k in kits:
            hit,*_=k.ray_cast(k.matrix_world.inverted()@(body.matrix_world@v.co),-v.normal,distance=0.03)
            if hit: count+=1; break
    return count
```

- [ ] **Step 3: 조합 실행** — 체형 3 × 유니폼 3 × (정지 자세 6 + 클립 5), 극단 `large×1.95`, `slim×1.70`, 스케일 0.93/1.0/1.07 발 미끄러짐(접지 프레임에서 발 이동 cm).
- [ ] **Step 4: 커밋**
- [ ] **Step 5: 체크포인트 — 뚫림 표(목표 0), 극단 조합, 발 미끄러짐 표, 대표 렌더 보여주고 멈춤.** 0이 아닌 곳은 태스크 7로 돌아가 오프셋·가중치를 고친다.

---

### Task 12: 성능·LOD 실측·크레딧·보고

**Files:** Create `CREDITS.md`(없으면), `reports/human-v2/README.md`; Modify `human-lab.html`(측정 버튼)

- [ ] **Step 1: 22명 fps** — 뷰어에서 조합 4개(전부 far / 6 mid+16 far / 1 near+6 mid+15 far / 전부 near) × 피부 산란·sheen 켬/끔, 각 10초 평균 fps와 p95 프레임 시간.
- [ ] **Step 2: 경기 카메라 LOD 분포** — 게임 방송 카메라 거리로 22명 배치(킥오프, 역습, 코너킥 3장면)에서 LOD별 인원.
- [ ] **Step 3: LOD 전환 확인** — 카메라를 천천히 당겨 near↔mid↔far 전환 프레임을 캡처(본 화면·그림자).
- [ ] **Step 4: CREDITS.md** — MakeHuman 에셋(CC0), Poly Haven HDRI(CC0), 100STYLE(CC BY 4.0: "The 100STYLE Dataset - Ian Mason"), CMU. MPFB 애드온은 저장소에 없음을 명시.
- [ ] **Step 5: 전체 테스트·빌드** — `node --test --experimental-test-isolation=none tests/*.test.mjs`, `node tools/build-web.mjs`
- [ ] **Step 6: 커밋·최종 보고 — 표와 이미지 보여주고 멈춤.** 푸시·PR은 사용자에게 물어본다.

---

## 자체 점검 결과

- 설계 1~11장 대응: 리그(태스크 3·8·9), 대응표(2·3), 키 스케일(10 `bodyMetrics`, 11 발 미끄러짐), 체형(3), 얼굴(4), 피부(5), 머리(6), 유니폼 종류·마스크·보호대·축구화·장갑(7), LOD·디더링·그림자(8·10·12), 확인 항목(11·12), 렌더링 모드(10), 파일 구성(전체), 크레딧(12).
- 태스크 4~11의 Blender 코드는 핵심 부분만 적었다. MPFB 에셋 실제 파일명과 치수가 앞 체크포인트에서 정해지기 때문이고, 진행 규칙대로 각 태스크 시작 전에 세부 단계를 확정한다. 게임 연결(보폭 공식의 실제 적용, IK·접촉·충돌 반지름 연결)은 ROADMAP 4~7단계 범위다.
