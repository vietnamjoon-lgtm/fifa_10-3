import test from 'node:test';
import assert from 'node:assert/strict';
import {CLUBS,applyClubs,matchKits,clubById,crestSVG,chestText,DEFAULT_CLUBS} from '../src/clubs.js';
import {TEAMS} from '../src/config.js';
test('twelve K League 1 clubs with Bucheon FC 1995 as the default home side',()=>{assert.equal(CLUBS.length,12);assert.equal(new Set(CLUBS.map(c=>c.id)).size,12);assert.equal(DEFAULT_CLUBS.home,'bucheon');applyClubs();assert.equal(TEAMS[0].name,'부천 FC 1995');assert.equal(TEAMS[0].kit.pattern,2);for(const c of CLUBS){assert.match(c.home.shirt,/^#[0-9a-f]{6}$/i);assert.ok(chestText(c).length>=4);assert.ok(crestSVG(c).startsWith('<svg'));}});
test('the away side changes kit when the home shirts clash, and keepers differ from both outfield kits',()=>{
 const [h,a]=matchKits(clubById('bucheon'),clubById('seoul'));assert.equal(h,clubById('bucheon').home);assert.equal(a,clubById('seoul').away);
 const [u,j]=matchKits(clubById('ulsan'),clubById('jeonbuk'));assert.equal(j,clubById('jeonbuk').home,'blue and green do not clash');
 applyClubs('gwangju','bucheon');assert.notEqual(TEAMS[0].keeper,TEAMS[1].keeper);assert.notEqual(TEAMS[0].keeper.toLowerCase(),'#ffc600');
 applyClubs('pohang','pohang');assert.notEqual(TEAMS[0].club.id,TEAMS[1].club.id,'a club never plays itself');applyClubs();});
