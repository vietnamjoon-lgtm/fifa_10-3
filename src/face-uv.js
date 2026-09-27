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
// Two independently clipped triangles that share an edge can still leave a hairline gap along it (each
// clip path rasterizes its own antialiased edge, and the two don't line up to the sub-pixel), which reads
// as a fine dark mesh of seams over the whole warped patch. Nudging each clip vertex outward from the
// triangle's own centroid by a fixed pixel amount overlaps neighbouring triangles slightly along every
// shared edge and closes that gap; it only widens the CLIP region, not the source/destination correspondence
// the affine transform itself is built from, so alignment is unaffected.
const CLIP_EXPAND_PX = 1.25;
function expand(p, cx, cy) {
	const dx = p[0] - cx, dy = p[1] - cy, len = Math.hypot(dx, dy);
	return len > 1e-6 ? [p[0] + dx / len * CLIP_EXPAND_PX, p[1] + dy / len * CLIP_EXPAND_PX] : p;
}
/**
 * Draws `image` onto `ctx` warped triangle by triangle: each `triangles[i]` (3 landmark indices) is clipped
 * to its destination triangle in `dstPoints` (expanded slightly from its centroid, see CLIP_EXPAND_PX above)
 * and filled with the matching source triangle of `srcPoints` from `image`. Both point arrays are indexed by
 * the same landmark id (`[[x,y], ...]`, image/canvas pixels). Skips triangles with a degenerate source or
 * destination (can't happen with real landmarks, but a synthetic/corrupt point set should not throw
 * mid-bake), triangles that would magnify far past MAX_MAGNIFY (see above), and -- when `maxEdge` is given
 * (in the same pixel units as `dstPoints`) -- triangles with a destination edge longer than it. The
 * Rocketbox head UV has some eyelid landmarks' matching eyeball-surface landmark raycast onto the model's
 * separate eyeball texture swatch, nowhere near the face; the triangle joining them is a real, moderate-area
 * sliver (MAX_MAGNIFY alone doesn't catch it) reaching far outside the face -- composePhotoHead passes
 * maxEdge to drop those.
 */
export function warpTriangles(ctx, image, srcPoints, dstPoints, triangles, maxEdge = Infinity) {
	for (const [i, j, k] of triangles) {
		const s0 = srcPoints[i], s1 = srcPoints[j], s2 = srcPoints[k], d0 = dstPoints[i], d1 = dstPoints[j], d2 = dstPoints[k];
		const edge = Math.max(Math.hypot(d0[0] - d1[0], d0[1] - d1[1]), Math.hypot(d1[0] - d2[0], d1[1] - d2[1]), Math.hypot(d2[0] - d0[0], d2[1] - d0[1]));
		if (edge > maxEdge) continue;
		let m;
		try { m = triangleTransform(s0, s1, s2, d0, d1, d2); } catch { continue; }
		if (Math.abs(m.a * m.d - m.b * m.c) > MAX_MAGNIFY) continue;
		const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
		const e0 = expand(d0, cx, cy), e1 = expand(d1, cx, cy), e2 = expand(d2, cx, cy);
		ctx.save();
		ctx.beginPath(); ctx.moveTo(e0[0], e0[1]); ctx.lineTo(e1[0], e1[1]); ctx.lineTo(e2[0], e2[1]); ctx.closePath(); ctx.clip();
		ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
		ctx.drawImage(image, 0, 0);
		ctx.restore();
	}
}

/**
 * Separable box blur straight on a single-channel pixel array (a plain `Float32Array`, one value per pixel,
 * row-major, mutated and returned), `N` pixels square -- never a canvas API. src/human-kit.js's face-oval
 * blend mask needs this: `ctx.filter = 'blur()'` turned out to silently do nothing in some engines (observed
 * in headless Chromium -- the mask stayed a hard 0/255 edge, no error, no effect), and even `drawImage`
 * scaled between two canvases came back with no interpolation at all in the same engine
 * (imageSmoothingEnabled=true had no effect either), so that mask's softness cannot depend on either. Three
 * passes at `radius` approximate a gaussian-like falloff of about 2x `radius`.
 */
export function boxBlur1ch(a, N, radius) {
	const r = Math.max(1, Math.round(radius)), span = 2 * r + 1, tmp = new Float32Array(N * N);
	for (let pass = 0; pass < 3; pass++) {
		for (let y = 0; y < N; y++) {
			const row = y * N; let sum = 0;
			for (let k = -r; k <= r; k++) sum += a[row + Math.min(N - 1, Math.max(0, k))];
			tmp[row] = sum / span;
			for (let x = 1; x < N; x++) { sum += a[row + Math.min(N - 1, x + r)] - a[row + Math.max(0, x - r - 1)]; tmp[row + x] = sum / span; }
		}
		for (let x = 0; x < N; x++) {
			let sum = 0;
			for (let k = -r; k <= r; k++) sum += tmp[Math.min(N - 1, Math.max(0, k)) * N + x];
			a[x] = sum / span;
			for (let y = 1; y < N; y++) { sum += tmp[Math.min(N - 1, y + r) * N + x] - tmp[Math.max(0, y - r - 1) * N + x]; a[y * N + x] = sum / span; }
		}
	}
	return a;
}
