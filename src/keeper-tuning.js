// Middle ground between the original near-perfect tracking and the over-nerfed release. Game feel 3 (docs/GAME-FEEL-PLAN.md):
// a quicker reaction (0.2 s base), a faster lateral dive (3.4 m/s) and a dive that reaches out sooner, measured by
// tools/feel/drills.mjs keeper: save share of on-target shots 11 m 0.30 -> 0.42, 16 m 0.60 -> 0.74, 22 m 0.80 -> 0.89.
export const KEEPER={reactionBase:.2,reactionSpread:.21,catchBase:8.7625,catchReflex:4.7625,
 standingRange:.325,diveRange:.49,heightPadding:.13125,forwardReach:.67,behindReach:.1275,
 diveStartReach:.55,diveExtension:.16,verticalTolerance:.3825,verticalReflex:.12,
 moveSpeed:2.65,diveSpeed:3.4,diveDuration:.575,diveCooldown:1.35625,diveTriggerTime:.42,diveTriggerDistance:.6125,
 readError:.2175,readErrorReflex:.575};
