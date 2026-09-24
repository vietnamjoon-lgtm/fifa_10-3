// Feature coordinates on the MakeHuman head used by this game, in metres.
// Photos move the geometry itself. They are never used as a face texture here.
const pair=(a,b,x,y,z)=>[[a,[-x,y,z]],[b,[x,y,z]]];
export const FACE_ANCHORS=Object.fromEntries([
 [10,[0,.112,.087]],[152,[0,-.076,.080]],
 ...pair(67,297,.037,.108,.075),...pair(127,356,.074,.067,.025),
 ...pair(234,454,.073,.009,.036),...pair(93,323,.066,-.014,.045),
 ...pair(132,361,.057,-.038,.049),...pair(172,397,.045,-.054,.055),
 ...pair(136,365,.030,-.067,.066),...pair(148,377,.017,-.073,.075),
 ...pair(33,263,.046,.047,.075),...pair(133,362,.018,.047,.085),
 ...pair(159,386,.032,.053,.086),...pair(145,374,.032,.040,.085),
 ...pair(70,300,.050,.066,.076),...pair(63,293,.041,.074,.082),
 ...pair(105,334,.031,.076,.085),...pair(66,296,.022,.075,.090),...pair(107,336,.014,.068,.094),
 [168,[0,.050,.096]],[6,[0,.035,.099]],[1,[0,.007,.113]],[2,[0,-.011,.104]],
 ...pair(98,327,.015,-.007,.101),...pair(129,358,.022,.005,.095),
 ...pair(61,291,.025,-.033,.091),...pair(40,270,.014,-.026,.102),
 ...pair(91,321,.014,-.041,.098),[0,[0,-.023,.106]],[13,[0,-.032,.104]],
 [14,[0,-.036,.103]],[17,[0,-.044,.100]]
]);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function cleanIdentity(raw){
 if(raw?.version!==2||!Array.isArray(raw.points)||raw.points.length!==Object.keys(FACE_ANCHORS).length)return null;
 const seen=new Set(),points=[];
 for(const p of raw.points){if(!Array.isArray(p)||p.length!==3||!Object.hasOwn(FACE_ANCHORS,p[0])||seen.has(p[0])||!p.slice(1).every(Number.isFinite))return null;seen.add(p[0]);const base=FACE_ANCHORS[p[0]];points.push([p[0],clamp(p[1],base[0]-.028,base[0]+.028),clamp(p[2],base[1]-.024,base[1]+.024)]);}
 return {version:2,points,likeness:typeof raw.likeness==='number'&&Number.isFinite(raw.likeness)?clamp(raw.likeness,0,1):1};
}
export function identityFromLandmarks(points,width,height){
 const q=points.map(p=>[p.x*width,p.y*height]),left=q[33],right=q[263],roll=Math.atan2(right[1]-left[1],right[0]-left[0]),c=Math.cos(roll),s=Math.sin(roll);
 const rotated=q.map(([x,y])=>[x*c+y*s,-x*s+y*c]),cx=(rotated[234][0]+rotated[454][0])/2,flat=rotated.map(([x,y])=>[x-cx,y]);
 const top=flat[10][1],span=flat[152][1]-top,scale=.188/span;
 // Remove camera roll while retaining measured feature heights and spacing.
 const targets=Object.entries(FACE_ANCHORS).map(([key])=>{const id=Number(key),p=flat[id];return [id,p[0]*scale,.112-(p[1]-top)*scale];});
 return cleanIdentity({version:2,points:targets,likeness:1});
}
export function identityWarp(identity){
 const clean=cleanIdentity(identity);if(!clean||!clean.likeness)return (x,y,z)=>[x,y,z];
 const anchors=clean.points.map(([id,x,y])=>({base:FACE_ANCHORS[id],delta:[x-FACE_ANCHORS[id][0],y-FACE_ANCHORS[id][1]]}));
 // Solve a regularized radial-basis field: averaging displacements alone washes
 // out eye spacing, brow height and lip shape when adjacent features differ.
 const kernel=(x,y)=>Math.exp(-(x*x+y*y)/(2*.026**2)),n=anchors.length;
 const matrix=anchors.map((a,i)=>[...anchors.map((b,j)=>kernel(a.base[0]-b.base[0],a.base[1]-b.base[1])+(i===j?.025:0)),...a.delta]);
 for(let col=0;col<n;col++){let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(matrix[row][col])>Math.abs(matrix[pivot][col]))pivot=row;[matrix[col],matrix[pivot]]=[matrix[pivot],matrix[col]];const div=matrix[col][col];for(let k=col;k<n+2;k++)matrix[col][k]/=div;for(let row=0;row<n;row++){if(row===col)continue;const factor=matrix[row][col];for(let k=col;k<n+2;k++)matrix[row][k]-=factor*matrix[col][k];}}
 return (x,y,z)=>{if(z<-.01||y<-.095||y>.15)return [x,y,z];let dx=0,dy=0;
  for(let i=0;i<n;i++){const a=anchors[i],w=kernel(x-a.base[0],y-a.base[1]);dx+=matrix[i][n]*w;dy+=matrix[i][n+1]*w;}
  const neck=clamp((y+.075)/.032,0,1),front=clamp((z+.01)/.065,0,1),scalp=clamp((.15-y)/.032,0,1),strength=neck*front*scalp*clean.likeness;
  return [x+clamp(dx,-.034,.034)*strength,y+clamp(dy,-.029,.029)*strength,z];
 };
}
