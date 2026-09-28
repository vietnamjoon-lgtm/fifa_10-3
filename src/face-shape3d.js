// A photo's 3D face shape on the Rocketbox heads.
//
// Stored form (face assets, src/face-assets.js `shape3d`): MediaPipe's 468 face points from the front photo
// (x, y and its predicted depth z), optionally with a profile photo's points correcting the depth of the nose,
// lips, chin and forehead, lined up with MediaPipe's canonical face (assets/human/canonical-face.json
// `vertices`, cm) by scale, rotation and position, made half symmetric, and kept as each point's offset from the
// canonical face: 468 x 3 signed bytes of 0.3 mm (+-38 mm), base64 behind a version tag -- 1,874 characters.
// The shape is independent of which head the player is drawn with.
//
// In the game (src/human-body.js): the points are fitted by scale, rotation and position to the same 468 points
// on the chosen head (assets/human/rocketbox/face-landmarks-3d.json, found by the calibration rays of
// tools/human/rocketbox/04_raycast_uv.py), the per-point differences are interpolated with a compact radial basis
// (Wendland C2, 4 cm) and a face mask brings the result to zero at the back of the head, the scalp, under the
// jaw and on the neck seam. Pure functions (no DOM, no three.js) so they can be tested in Node.
const COUNT=468,STEP=.03,TAG='1:',ENCODED=1872;
// Inner lip ring: its shape is the photo's expression (open or pressed lips), not the face's build.
const INNER_LIPS=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};

/** A stored shape string, or null (anything else is dropped, like a wrong-size image). */
export function validFaceShape(value){return typeof value==='string'&&value.length===TAG.length+ENCODED&&value.startsWith(TAG)&&/^[A-Za-z0-9+/]+$/.test(value.slice(TAG.length))?value:null;}

/** MediaPipe landmarks ([x, y, z] normalized to the image) -> points in pixels, +y up, +z towards the camera. */
export function photoPoints(landmarks,width,height){
 const out=new Float64Array(COUNT*3);
 for(let i=0;i<COUNT;i++){const [x,y,z=0]=landmarks[i];out[i*3]=x*width;out[i*3+1]=-y*height;out[i*3+2]=-z*width;}
 return out;
}

// --- Similarity fit (Horn's quaternion method; scale by least squares) ---------------------------------------
function jacobiLargest(A){ // eigenvector of the largest eigenvalue of a symmetric 4x4 matrix
 const a=A.map(r=>[...r]),v=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
 for(let sweep=0;sweep<50;sweep++){
  let off=0;for(let p=0;p<4;p++)for(let q=p+1;q<4;q++)off+=a[p][q]*a[p][q];if(off<1e-20)break;
  for(let p=0;p<4;p++)for(let q=p+1;q<4;q++){
   if(Math.abs(a[p][q])<1e-30)continue;
   const theta=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(theta||1)/(Math.abs(theta)+Math.sqrt(theta*theta+1)),c=1/Math.sqrt(t*t+1),s=t*c;
   for(let k=0;k<4;k++){const akp=a[k][p],akq=a[k][q];a[k][p]=c*akp-s*akq;a[k][q]=s*akp+c*akq;}
   for(let k=0;k<4;k++){const apk=a[p][k],aqk=a[q][k];a[p][k]=c*apk-s*aqk;a[q][k]=s*apk+c*aqk;}
   for(let k=0;k<4;k++){const vkp=v[k][p],vkq=v[k][q];v[k][p]=c*vkp-s*vkq;v[k][q]=s*vkp+c*vkq;}
  }
 }
 let best=0;for(let i=1;i<4;i++)if(a[i][i]>a[best][best])best=i;
 return [v[0][best],v[1][best],v[2][best],v[3][best]];
}
/**
 * Scale, rotation and translation taking `src` onto `dst` (flat xyz arrays) over `indices` (weights optional):
 * {s, R (row-major 3x3), t}, minimising the weighted squared distance.
 */
export function similarity(src,dst,indices,weights=null){
 let W=0;const cs=[0,0,0],cd=[0,0,0];
 for(const i of indices){const w=weights?weights[i]:1;W+=w;for(let k=0;k<3;k++){cs[k]+=w*src[i*3+k];cd[k]+=w*dst[i*3+k];}}
 for(let k=0;k<3;k++){cs[k]/=W;cd[k]/=W;}
 const S=[[0,0,0],[0,0,0],[0,0,0]];let ss=0;
 for(const i of indices){const w=weights?weights[i]:1,a=[0,1,2].map(k=>src[i*3+k]-cs[k]),b=[0,1,2].map(k=>dst[i*3+k]-cd[k]);ss+=w*(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]);for(let r=0;r<3;r++)for(let c=0;c<3;c++)S[r][c]+=w*a[r]*b[c];}
 const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=S;
 const N=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
 const [q0,q1,q2,q3]=jacobiLargest(N);
 const R=[[q0*q0+q1*q1-q2*q2-q3*q3,2*(q1*q2-q0*q3),2*(q1*q3+q0*q2)],[2*(q1*q2+q0*q3),q0*q0-q1*q1+q2*q2-q3*q3,2*(q2*q3-q0*q1)],[2*(q1*q3-q0*q2),2*(q2*q3+q0*q1),q0*q0-q1*q1-q2*q2+q3*q3]];
 let dot=0;for(const i of indices){const w=weights?weights[i]:1,a=[0,1,2].map(k=>src[i*3+k]-cs[k]),b=[0,1,2].map(k=>dst[i*3+k]-cd[k]);for(let r=0;r<3;r++)dot+=w*b[r]*(R[r][0]*a[0]+R[r][1]*a[1]+R[r][2]*a[2]);}
 const s=ss>0?dot/ss:1,t=[0,1,2].map(r=>cd[r]-s*(R[r][0]*cs[0]+R[r][1]*cs[1]+R[r][2]*cs[2]));
 return {s,R,t};
}
export function applySimilarity({s,R,t},points){
 const out=new Float64Array(points.length);
 for(let i=0;i<points.length;i+=3){const x=points[i],y=points[i+1],z=points[i+2];for(let r=0;r<3;r++)out[i+r]=s*(R[r][0]*x+R[r][1]*y+R[r][2]*z)+t[r];}
 return out;
}
const all=Array.from({length:COUNT},(_,i)=>i);

/** Each landmark's left-right partner on the canonical face (itself on the centre line). */
export function mirrorPairs(canonical){
 return all.map(i=>{let best=i,d=Infinity;const x=-canonical[i][0],y=canonical[i][1],z=canonical[i][2];
  for(let j=0;j<COUNT;j++){const e=(canonical[j][0]-x)**2+(canonical[j][1]-y)**2+(canonical[j][2]-z)**2;if(e<d){d=e;best=j;}}return best;});
}
function symmetric(points,pairs,amount){
 const out=new Float64Array(points);
 for(let i=0;i<COUNT;i++){const j=pairs[i],m=[-points[j*3],points[j*3+1],points[j*3+2]];for(let k=0;k<3;k++)out[i*3+k]=points[i*3+k]+(((points[i*3+k]+m[k])/2)-points[i*3+k])*amount;}
 return out;
}

/**
 * {shape: the stored string, side: how much the profile photo corrected depth (0 = not used)}, or null when there
 * are not 468 points. `front`/`side`: {landmarks, width,
 * height} as the face-fit worker returns them (src/face-fit-worker.js). The profile photo only corrects depth
 * (front z) of the central face -- nose, lips, chin, forehead -- where its image plane actually measures it, and
 * only when it is turned at least 30 degrees and its points fit the front ones (rms under 4 mm).
 */
export function encodeFaceShape({front,side=null},canonical){
 if(!front?.landmarks||front.landmarks.length<COUNT||!canonical?.vertices)return null;
 const C=Float64Array.from(canonical.vertices.flat());
 let P=applySimilarity(similarity(photoPoints(front.landmarks,front.width,front.height),C,all),photoPoints(front.landmarks,front.width,front.height));
 let sideUsed=0;
 if(side?.landmarks?.length>=COUNT){
  const S0=photoPoints(side.landmarks,side.width,side.height),T=similarity(S0,P,all),S=applySimilarity(T,S0);
  let rms=0;for(let i=0;i<COUNT*3;i++)rms+=(S[i]-P[i])**2;rms=Math.sqrt(rms/COUNT);
  // How far the side camera looks across the front camera's depth axis: sin^2 of the turn.
  const w=1-T.R[2][2]**2;
  if(w>=.25&&rms<.4){sideUsed=w;P=Float64Array.from(P);for(let i=0;i<COUNT;i++){const centre=smooth((6-Math.abs(P[i*3]))/2.5)*.75*w;P[i*3+2]+=(S[i*3+2]-P[i*3+2])*centre;}}
 }
 P=symmetric(P,mirrorPairs(canonical.vertices),.5);
 const bytes=new Uint8Array(COUNT*3);
 for(let i=0;i<COUNT*3;i++)bytes[i]=clamp(Math.round((P[i]-C[i])/STEP),-127,127)&255;
 let text='';for(const b of bytes)text+=String.fromCharCode(b);
 return {shape:TAG+btoa(text),side:sideUsed};
}
/** Canonical-frame points (cm) of a stored shape, or null. */
export function decodeFaceShape(value,canonical){
 if(!validFaceShape(value)||!canonical?.vertices)return null;
 const text=atob(value.slice(TAG.length)),out=new Float64Array(COUNT*3);
 for(let i=0;i<COUNT;i++)for(let k=0;k<3;k++){const b=text.charCodeAt(i*3+k);out[i*3+k]=canonical.vertices[i][k]+(b>127?b-256:b)*STEP;}
 return out;
}

// --- The deformation field on one head ---------------------------------------------------------------------
const RADIUS=4,SMOOTHING=.02,MAX_OFFSET=1.5; // cm
const wendland=r=>{const q=r/RADIUS;return q>=1?0:(1-q)**4*(4*q+1);};
/** Derivative of the kernel over r (for the normals). */
const wendlandDr=r=>{const q=r/RADIUS;return q>=1?0:-20*q*(1-q)**3/RADIUS;};
function solve(A,B,n,m){ // Gaussian elimination with partial pivoting, A n x n, B n x m (both flat, overwritten)
 for(let c=0;c<n;c++){
  let p=c;for(let r=c+1;r<n;r++)if(Math.abs(A[r*n+c])>Math.abs(A[p*n+c]))p=r;
  if(p!==c){for(let k=0;k<n;k++){const t=A[c*n+k];A[c*n+k]=A[p*n+k];A[p*n+k]=t;}for(let k=0;k<m;k++){const t=B[c*m+k];B[c*m+k]=B[p*m+k];B[p*m+k]=t;}}
  const d=A[c*n+c];if(Math.abs(d)<1e-12)continue;
  for(let r=c+1;r<n;r++){const f=A[r*n+c]/d;if(!f)continue;for(let k=c;k<n;k++)A[r*n+k]-=f*A[c*n+k];for(let k=0;k<m;k++)B[r*m+k]-=f*B[c*m+k];}
 }
 for(let c=n-1;c>=0;c--){const d=A[c*n+c];for(let k=0;k<m;k++){let v=B[c*m+k];for(let j=c+1;j<n;j++)v-=A[c*n+j]*B[j*m+k];B[c*m+k]=Math.abs(d)<1e-12?0:v/d;}}
 return B;
}
/**
 * A head's calibration points, completed left-right: a ray that missed the head, or grazed past the cheek
 * onto the ear (its depth more than 1.5 cm behind its partner's), takes its partner's point mirrored -- the
 * Rocketbox heads are close to symmetric, and without it one side of the jaw would have no control points.
 */
export function headLandmarks(model,pairs){
 return model.map((p,i)=>{const j=pairs[i],q=model[j];
  if(j!==i&&q&&(!p||q[2]-p[2]>=.015))return [-q[0],q[1],q[2]];
  return p&&[...p];});
}
/** Landmarks that steer the shape: every completed point except the inner lips. */
export function reliableLandmarks(points){return all.filter(i=>points[i]&&!INNER_LIPS.includes(i));}
/**
 * The field that moves one head to a stored face shape. `head`: {points: its 468 calibration hits in metres
 * (null for a miss), shape: the stored shape of MediaPipe's reading of the same head's calibration render}.
 * Both MediaPipe readings (the photo's and the head's) share the detector's own habits -- where it puts the
 * face outline, how deep it guesses a face to be -- so only their difference is used: it is taken in the
 * canonical frame, turned and scaled into the head's frame by the fit of the head's reading to its hits, and
 * applied at the hits. A photo of the head's own render therefore changes nothing. `photo`: decodeFaceShape's
 * points. `seam`: rest positions (metres, flat) where head and body meet, which must not move. `strength`
 * scales the whole change. Returns {offset, mask, landmarks, largest}; positions and offsets are metres in the
 * head's rest space.
 */
export function faceShapeField(head,photo,canonical,{seam=null,strength=1}={}){
 const reference=decodeFaceShape(head?.shape,canonical);
 if(!head?.points||!reference||!photo)return null;
 const model=headLandmarks(head.points,mirrorPairs(canonical.vertices)),use=reliableLandmarks(model);
 if(use.length<200)return null;
 const M=new Float64Array(COUNT*3);for(const i of use)for(let k=0;k<3;k++)M[i*3+k]=model[i][k]*100;
 const P=applySimilarity(similarity(photo,reference,all),photo),{s,R}=similarity(reference,M,use);
 const n=use.length,centres=new Float64Array(n*3),values=new Float64Array(n*3);
 use.forEach((i,j)=>{const c=[0,1,2].map(k=>P[i*3+k]-reference[i*3+k]);let d=[0,1,2].map(r=>s*(R[r][0]*c[0]+R[r][1]*c[1]+R[r][2]*c[2])*strength);
  const len=Math.hypot(...d);if(len>MAX_OFFSET)d=d.map(v=>v*MAX_OFFSET/len);
  for(let k=0;k<3;k++){centres[j*3+k]=M[i*3+k];values[j*3+k]=d[k];}});
 return buildField(model,use,centres,values,seam);
}
/**
 * The same field from direct 3D targets instead of MediaPipe readings: `targets` are where each of the head's 468
 * landmarks should go (metres, the head's rest space, null to leave one out), as the face-scan tool measures them
 * on a scan already fitted to the head (tools/human/scan). `maxOffset` caps each landmark's move (cm).
 */
export function landmarkField(head,targets,canonical,{seam=null,maxOffset=3}={}){
 if(!head?.points||!targets)return null;
 const model=headLandmarks(head.points,mirrorPairs(canonical.vertices)),use=reliableLandmarks(model).filter(i=>targets[i]);
 if(use.length<200)return null;
 const n=use.length,centres=new Float64Array(n*3),values=new Float64Array(n*3);
 use.forEach((i,j)=>{let d=[0,1,2].map(k=>(targets[i][k]-model[i][k])*100);const len=Math.hypot(...d);if(len>maxOffset)d=d.map(v=>v*maxOffset/len);
  for(let k=0;k<3;k++){centres[j*3+k]=model[i][k]*100;values[j*3+k]=d[k];}});
 return buildField(model,use,centres,values,seam);
}
function buildField(model,use,centres,values,seam){
 const n=use.length,M={y:i=>model[i][1]*100,z:i=>model[i][2]*100};
 const A=new Float64Array(n*n);
 for(let a=0;a<n;a++)for(let b=a;b<n;b++){const r=Math.hypot(centres[a*3]-centres[b*3],centres[a*3+1]-centres[b*3+1],centres[a*3+2]-centres[b*3+2]),v=wendland(r)+(a===b?SMOOTHING:0);A[a*n+b]=A[b*n+a]=v;}
 const coef=solve(A,Float64Array.from(values),n,3);
 // Face mask from the head's own landmarks (cm): the chin, the top of the forehead, the depth of the face sides.
 const at=i=>model[i]?model[i].map(v=>v*100):null,chin=at(152)?.[1]??Math.min(...use.map(M.y)),top=at(10)?.[1]??Math.max(...use.map(M.y));
 const back=Math.min(...use.map(M.z))-1;
 const seamPts=seam?Array.from(seam,v=>v*100):[];
 const mask=(x,y,z)=>{
  let w=smooth((z-back)/2.5)*smooth((top+1-y)/2)*smooth((y-(chin-4))/2.5);
  if(w>0&&seamPts.length){let d=Infinity;for(let i=0;i<seamPts.length;i+=3)d=Math.min(d,Math.hypot(x-seamPts[i],y-seamPts[i+1],z-seamPts[i+2]));w*=smooth(d/3);}
  return w;
 };
 /**
  * Offset (metres) at a rest position (metres) into `out`, and the 3x3 Jacobian of the unmasked field times
  * the mask into `jacobian` if given (row-major, for turning normals). Returns the mask weight.
  */
 const offset=(x,y,z,out,jacobian=null)=>{
  x*=100;y*=100;z*=100;out[0]=out[1]=out[2]=0;if(jacobian)jacobian.fill(0);
  const w=mask(x,y,z);if(w<=0)return 0;
  for(let j=0;j<n;j++){const dx=x-centres[j*3],dy=y-centres[j*3+1],dz=z-centres[j*3+2],r=Math.hypot(dx,dy,dz);if(r>=RADIUS)continue;
   const f=wendland(r);for(let k=0;k<3;k++)out[k]+=coef[j*3+k]*f;
   if(jacobian&&r>1e-9){const g=wendlandDr(r)/r;for(let k=0;k<3;k++){jacobian[k*3]+=coef[j*3+k]*g*dx*w;jacobian[k*3+1]+=coef[j*3+k]*g*dy*w;jacobian[k*3+2]+=coef[j*3+k]*g*dz*w;}}}
  for(let k=0;k<3;k++)out[k]*=w/100;
  return w;
 };
 // Largest change at the landmarks (mm), for reports and tests.
 let largest=0;for(let j=0;j<n;j++)largest=Math.max(largest,Math.hypot(values[j*3],values[j*3+1],values[j*3+2])*10);
 return {offset,mask:(x,y,z)=>mask(x*100,y*100,z*100),landmarks:use,largest};
}

/**
 * Offsets for a whole mesh: `rest` flat metres (n x 3), `rigid` optional arrays of vertex indices that move as
 * one piece (eyeballs, teeth: the mean offset of their vertices). Returns {offsets: Float32Array (metres),
 * jacobians: Float32Array (9 per vertex)}.
 */
export function meshOffsets(field,rest,rigid=[]){
 const count=rest.length/3,offsets=new Float32Array(rest.length),jacobians=new Float32Array(count*9),o=[0,0,0],J=new Float64Array(9);
 for(let i=0;i<count;i++){field.offset(rest[i*3],rest[i*3+1],rest[i*3+2],o,J);offsets.set(o,i*3);jacobians.set(J,i*9);}
 for(const group of rigid){const m=[0,0,0];for(const i of group)for(let k=0;k<3;k++)m[k]+=offsets[i*3+k]/group.length;for(const i of group){offsets.set(m,i*3);jacobians.fill(0,i*9,i*9+9);}}
 return {offsets,jacobians};
}
