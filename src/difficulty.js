// AI difficulty (match centre: 편안하게 / 스탠다드 / 챌린지). Applies only to a team the AI plays: a human's team, and both
// teams in an online duel, always use `neutral`. Our own tuning (docs/GAME-FEEL-PLAN.md stage 4), not EA/Nexon values.
//  decision   seconds between an AI carrier's decisions (shorter: quicker play)
//  tackle     chance per decision that an engaged AI presser tries a tackle on a shielded ball
//  shotError / passError  factor on the kick error of AI shots and passes
//  keeperReaction         seconds added to the AI keeper's reaction
//  beat       chance per decision (about 6 per second) that a carrier held up by a defender, with no safe pass,
//             tries to beat him with a skill move or a sharp cut
export const DIFFICULTY={
 easy:{decision:.95,tackle:.3,shotError:1.35,passError:1.3,keeperReaction:.05,beat:.03},
 normal:{decision:.65,tackle:.45,shotError:1,passError:1,keeperReaction:0,beat:.08},
 hard:{decision:.45,tackle:.6,shotError:.78,passError:.75,keeperReaction:-.035,beat:.16}
};
export const NEUTRAL=Object.freeze({decision:.65,tackle:.45,shotError:1,passError:1,keeperReaction:0,beat:.08});
export function aiLevel(match,team){return match.isHumanTeam?.(team)?NEUTRAL:DIFFICULTY[match.settings?.difficulty]||DIFFICULTY.normal;}
