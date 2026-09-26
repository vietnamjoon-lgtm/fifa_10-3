// Which rig index is which side of the player. The rig faces +z and index 0 of legs/arms sits
// at x<0, which is the player's RIGHT (checked 2026-09-26: the boot toe points to +z, legs[0]
// hip at x=-0.09). Game code used to map 'left' to 0, so left-foot actions were drawn with the
// right leg. Every foot/side to index conversion goes through here.
export const RIGHT=0,LEFT=1;
export const sideIndex=foot=>foot==='left'?LEFT:RIGHT;
