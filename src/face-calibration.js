// Repairs a head's landmark UV table (assets/human/rocketbox/face-landmarks-uv.json) before a photo face is
// warped onto it (src/human-kit.js composePhotoHead). tools/human/rocketbox/04_raycast_uv.py casts one camera
// ray per landmark at a straight-on render; near the face outline some rays miss the head (their UV is then a
// copy of the nearest hit's) or graze past the cheek onto the ear. Either way the warp triangles there fold or
// stretch past the drop limit, and the hole shows the fallback background as a hard-edged patch in front of
// the ear. The Rocketbox head textures are unwrapped left-right symmetric about u = .5 (paired landmarks sit
// within about 3 texels of each other's mirror image), so such a point takes its partner's UV mirrored -- the
// same rule src/face-shape3d.js headLandmarks uses for the 3D points. Pure, so it can be tested in Node.

/** How far (metres) a hit may sit behind its left-right partner before it counts as a graze onto the ear. */
export const GRAZE_DEPTH=.015;

/**
 * Landmarks whose calibration UV is not their own: rays that missed (`points[i]` null) or grazed onto the ear.
 * `points`: the head's 468 hits (face-landmarks-3d.json, metres, +z forward); `pairs`: each landmark's mirror
 * partner (src/face-shape3d.js mirrorPairs).
 */
export function unreliableLandmarks(points,pairs){
 const out=[];
 for(let i=0;i<pairs.length;i++){const j=pairs[i],p=points[i],q=points[j];
  if(!p||(j!==i&&q&&q[2]-p[2]>=GRAZE_DEPTH))out.push(i);}
 return out;
}

/**
 * A copy of `uv` ([[u, v], ...]) with every unreliable landmark moved to its partner's UV mirrored about
 * u = .5, when that partner is itself reliable. Centre-line landmarks and pairs that are both unreliable keep
 * their UV. Returns {uv, repaired: the landmark ids that moved}.
 */
export function repairCalibrationUV(uv,points,pairs){
 const bad=new Set(unreliableLandmarks(points,pairs)),out=uv.map(p=>[...p]),repaired=[];
 for(const i of bad){const j=pairs[i];if(j===i||bad.has(j)||!uv[j])continue;out[i]=[1-uv[j][0],uv[j][1]];repaired.push(i);}
 return {uv:out,repaired};
}

/**
 * The triangles whose destination (head texture) keeps the winding of their source (the photo's canonical UV).
 * Along the face outline a straight-on calibration render squeezes the side of the face, so the outermost ring
 * of landmarks can land past the next ring in: those triangles fold over, and warping them paints a mirrored
 * strip of the photo over their neighbours. Only the sides are filtered: folds closer than `side` (a fraction of
 * the texture width, `size` pixels) to the centre line are the closed lips and nostrils, tiny and kept as before.
 * Points are [x, y] pairs in pixels of a `size` wide texture.
 */
export function unfoldedTriangles(triangles,src,dst,size,side=.1){
 const area=(p,[i,j,k])=>(p[j][0]-p[i][0])*(p[k][1]-p[i][1])-(p[j][1]-p[i][1])*(p[k][0]-p[i][0]);
 return triangles.filter(t=>area(src,t)*area(dst,t)>0||Math.abs((dst[t[0]][0]+dst[t[1]][0]+dst[t[2]][0])/3/size-.5)<side);
}
