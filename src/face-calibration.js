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
