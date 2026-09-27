// Canonical MediaPipe face UV space (assets/human/canonical-face.json, built by
// tools/human/rocketbox/build-canonical-face.mjs from vendor/mediapipe/canonical_face_model.obj) and the
// triangle warp used to move a photo's face onto it (src/face-assets.js bakeFaceAsset) and from it onto a
// Rocketbox head texture (src/human-kit.js composePhotoHead), using MediaPipe's 468-point triangulation for
// both. Pure, so the math is testable without a DOM; `warpTriangles` needs a canvas and is browser-only.
let canonicalPromise = null;
/** Fetches assets/human/canonical-face.json once (`base` is the page-relative asset root, as in
 * src/human-body.js's BASE). Not memoized per-base: this game only ever calls it with one base. */
export function loadCanonicalFace(base = './') {
	return canonicalPromise ??= fetch(base + 'assets/human/canonical-face.json').then(r => r.json());
}

/**
 * The 2x3 affine map (canvas `setTransform` order: a,b,c,d,e,f) that sends source triangle (s0,s1,s2) onto
 * destination triangle (d0,d1,d2). Points are `[x,y]` pairs. Throws if the source triangle is degenerate.
 */
export function triangleTransform(s0, s1, s2, d0, d1, d2) {
	const sx1 = s1[0] - s0[0], sy1 = s1[1] - s0[1], sx2 = s2[0] - s0[0], sy2 = s2[1] - s0[1];
	const det = sx1 * sy2 - sy1 * sx2;
	if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw Error('degenerate source triangle');
	const dx1 = d1[0] - d0[0], dy1 = d1[1] - d0[1], dx2 = d2[0] - d0[0], dy2 = d2[1] - d0[1];
	const a = (dx1 * sy2 - sy1 * dx2) / det, c = (sx1 * dx2 - dx1 * sx2) / det;
	const b = (dy1 * sy2 - sy1 * dy2) / det, d = (sx1 * dy2 - dy1 * sx2) / det;
	return { a, b, c, d, e: d0[0] - a * s0[0] - c * s0[1], f: d0[1] - b * s0[0] - d * s0[1] };
}

// A closed mouth or closed eye collapses the inner-lip/lid landmarks to nearly the same 2D point in a photo
// (or in a render used for calibration), while the same landmarks keep a real, non-zero footprint on the
// 3D head's own UV unwrap. That mismatch makes a handful of triangles (out of ~900) magnify a sliver of a
// few source pixels a hundredfold, which reads as a torn, streaky patch rather than skin. |det| of the
// transform's linear part is exactly the source-to-destination area ratio; triangles beyond this are
// skipped (the pre-filled background they'd otherwise cover through shows instead -- see callers).
export const MAX_MAGNIFY = 12;
/**
 * Draws `image` onto `ctx` warped triangle by triangle: each `triangles[i]` (3 landmark indices) is clipped
 * to its destination triangle in `dstPoints` and filled with the matching source triangle of `srcPoints`
 * from `image`. Both point arrays are indexed by the same landmark id (`[[x,y], ...]`, image/canvas pixels).
 * Skips triangles with a degenerate source or destination (can't happen with real landmarks, but a
 * synthetic/corrupt point set should not throw mid-bake) and triangles that would magnify far past
 * MAX_MAGNIFY (see above).
 */
export function warpTriangles(ctx, image, srcPoints, dstPoints, triangles) {
	for (const [i, j, k] of triangles) {
		const s0 = srcPoints[i], s1 = srcPoints[j], s2 = srcPoints[k], d0 = dstPoints[i], d1 = dstPoints[j], d2 = dstPoints[k];
		let m;
		try { m = triangleTransform(s0, s1, s2, d0, d1, d2); } catch { continue; }
		if (Math.abs(m.a * m.d - m.b * m.c) > MAX_MAGNIFY) continue;
		ctx.save();
		ctx.beginPath(); ctx.moveTo(d0[0], d0[1]); ctx.lineTo(d1[0], d1[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); ctx.clip();
		ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
	}
}
