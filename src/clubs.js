import {TEAMS} from './config.js';
// K League 1 2026 clubs. Names and colours follow the real clubs; the crests are original shield designs in the club
// colours (not the clubs' registered emblems), and players stay fictional. Kit colours are approximations of each
// club's recent home and away shirts: pattern 0 solid, 1 vertical stripes, 2 top-to-bottom gradient, 3 hoops,
// 4 diamond weave. Bucheon FC 1995 2026: home red to black gradient ("1995 : GLORY of RED"), away white diamond.
const kit=(shirt,second,pattern,sleeves,shorts,socks,text)=>({shirt,second,pattern,sleeves,shorts,socks,text});
export const CLUBS=[
 {id:'bucheon',name:'부천 FC 1995',en:'BUCHEON FC 1995',short:'BFC',city:'부천',stadium:'부천종합운동장',founded:2007,crest:{shape:'shield',a:'#d71920',b:'#111111',glyph:'B'},
  home:kit('#d71920','#141414',2,'#141414','#141414','#141414','#ffffff'),away:kit('#f3f3f0','#d9d6d0',4,'#f3f3f0','#f3f3f0','#f3f3f0','#c8141c')},
 {id:'seoul',name:'FC 서울',en:'FC SEOUL',short:'SEO',city:'서울',stadium:'서울월드컵경기장',founded:1983,crest:{shape:'round',a:'#c8102e',b:'#101010',glyph:'S'},
  home:kit('#c8102e','#141414',1,'#c8102e','#141414','#141414','#ffffff'),away:kit('#f4f4f2','#f4f4f2',0,'#f4f4f2','#f4f4f2','#f4f4f2','#c8102e')},
 {id:'ulsan',name:'울산 HD',en:'ULSAN HD',short:'ULS',city:'울산',stadium:'울산문수축구경기장',founded:1983,crest:{shape:'shield',a:'#0a4ea3',b:'#f5c400',glyph:'U'},
  home:kit('#0a4ea3','#0a4ea3',0,'#0a4ea3','#0a4ea3','#0a4ea3','#ffffff'),away:kit('#f4f5f7','#f4f5f7',0,'#f4f5f7','#f4f5f7','#f4f5f7','#0a4ea3')},
 {id:'jeonbuk',name:'전북 현대 모터스',en:'JEONBUK HYUNDAI',short:'JBH',city:'전주',stadium:'전주월드컵경기장',founded:1994,crest:{shape:'shield',a:'#0b6b3a',b:'#e6c34a',glyph:'J'},
  home:kit('#0b6b3a','#0b6b3a',0,'#0b6b3a','#0b6b3a','#0b6b3a','#ffffff'),away:kit('#f3f5f2','#f3f5f2',0,'#f3f5f2','#f3f5f2','#f3f5f2','#0b6b3a')},
 {id:'pohang',name:'포항 스틸러스',en:'POHANG STEELERS',short:'POH',city:'포항',stadium:'포항 스틸야드',founded:1973,crest:{shape:'round',a:'#d6202c',b:'#121212',glyph:'P'},
  home:kit('#d6202c','#121212',1,'#121212','#121212','#121212','#ffffff'),away:kit('#f4f4f4','#f4f4f4',0,'#f4f4f4','#f4f4f4','#f4f4f4','#121212')},
 {id:'incheon',name:'인천 유나이티드',en:'INCHEON UNITED',short:'INC',city:'인천',stadium:'인천축구전용경기장',founded:2003,crest:{shape:'shield',a:'#1b58b8',b:'#141414',glyph:'I'},
  home:kit('#1b58b8','#141414',1,'#141414','#141414','#1b58b8','#ffffff'),away:kit('#f4f4f4','#f4f4f4',0,'#f4f4f4','#f4f4f4','#f4f4f4','#1b58b8')},
 {id:'gangwon',name:'강원 FC',en:'GANGWON FC',short:'GWN',city:'강릉·춘천',stadium:'강릉종합운동장',founded:2008,crest:{shape:'round',a:'#f47b20',b:'#1f3a64',glyph:'G'},
  home:kit('#f47b20','#f47b20',0,'#f47b20','#f47b20','#f47b20','#1f3a64'),away:kit('#f5f5f5','#f5f5f5',0,'#f5f5f5','#1f3a64','#f5f5f5','#f47b20')},
 {id:'daejeon',name:'대전하나시티즌',en:'DAEJEON HANA CITIZEN',short:'DJN',city:'대전',stadium:'대전월드컵경기장',founded:1997,crest:{shape:'shield',a:'#6a1f4c',b:'#00a88f',glyph:'D'},
  home:kit('#6a1f4c','#00a88f',3,'#6a1f4c','#6a1f4c','#6a1f4c','#ffffff'),away:kit('#f5f5f5','#f5f5f5',0,'#f5f5f5','#f5f5f5','#f5f5f5','#6a1f4c')},
 {id:'jeju',name:'제주 SK',en:'JEJU SK FC',short:'JEJ',city:'제주',stadium:'제주월드컵경기장',founded:1982,crest:{shape:'round',a:'#ef6c1a',b:'#d11f2d',glyph:'J'},
  home:kit('#ef6c1a','#ef6c1a',0,'#ef6c1a','#ef6c1a','#ef6c1a','#ffffff'),away:kit('#f5f5f5','#f5f5f5',0,'#f5f5f5','#f5f5f5','#f5f5f5','#ef6c1a')},
 {id:'gwangju',name:'광주 FC',en:'GWANGJU FC',short:'GWJ',city:'광주',stadium:'광주축구전용구장',founded:2010,crest:{shape:'shield',a:'#ffc600',b:'#c8102e',glyph:'G'},
  home:kit('#ffc600','#ffc600',0,'#ffc600','#ffc600','#ffc600','#c8102e'),away:kit('#f5f5f5','#f5f5f5',0,'#f5f5f5','#f5f5f5','#f5f5f5','#c8102e')},
 {id:'anyang',name:'FC 안양',en:'FC ANYANG',short:'ANY',city:'안양',stadium:'안양종합운동장',founded:2013,crest:{shape:'round',a:'#5b2c86',b:'#f2f2f2',glyph:'A'},
  home:kit('#5b2c86','#5b2c86',0,'#5b2c86','#5b2c86','#5b2c86','#ffffff'),away:kit('#f5f5f5','#f5f5f5',0,'#f5f5f5','#f5f5f5','#f5f5f5','#5b2c86')},
 {id:'gimcheon',name:'김천 상무',en:'GIMCHEON SANGMU',short:'GIM',city:'김천',stadium:'김천종합운동장',founded:2021,crest:{shape:'shield',a:'#1d2d5c',b:'#c8102e',glyph:'K'},
  home:kit('#1d2d5c','#c8102e',0,'#1d2d5c','#1d2d5c','#1d2d5c','#ffffff'),away:kit('#f4f4f4','#f4f4f4',0,'#f4f4f4','#f4f4f4','#f4f4f4','#1d2d5c')}
];
export const DEFAULT_CLUBS={home:'bucheon',away:'seoul'};
export const clubById=id=>CLUBS.find(c=>c.id===id)||CLUBS[0];
export function cleanClub(id,fallback){return CLUBS.some(c=>c.id===id)?id:fallback;}
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
// Perceived distance between two kits' dominant colours (redmean approximation), 0..~765.
export function colourDistance(a,b){const [r1,g1,b1]=rgb(a),[r2,g2,b2]=rgb(b),rm=(r1+r2)/2,dr=r1-r2,dg=g1-g2,db=b1-b2;return Math.sqrt((2+rm/256)*dr*dr+4*dg*dg+(2+(255-rm)/256)*db*db);}
// Latin chest text: the club name without the generic parts (FC, founding year, company names).
export const chestText=club=>club.en.replace(/\b(FC|1995|HD|SK|HYUNDAI|MOTORS|UNITED|STEELERS|HANA|CITIZEN|SANGMU)\b/g,'').trim().split(/\s+/)[0];
export const light=hex=>{const [r,g,b]=rgb(hex);return .299*r+.587*g+.114*b>200;};
const dominant=k=>k.pattern===1||k.pattern===2?[k.shirt,k.second]:[k.shirt];
// The away side changes into its away kit when the two home shirts would be hard to tell apart.
export function matchKits(home,away){const h=home.home,a=away.home;const clash=dominant(h).some(x=>dominant(a).some(y=>colourDistance(x,y)<150));return [h,clash?away.away:a];}
// Keepers wear a colour far from both outfield kits.
const KEEPER_COLOURS=['#ecc842','#3fb8e8','#7ee06a','#ff8a3d','#d85cf2','#2b2b2b'];
export function keeperColours(kits){const used=kits.flatMap(k=>[k.shirt,k.second]),pick=[];for(const c of KEEPER_COLOURS){if(pick.length===2)break;if(used.every(u=>colourDistance(c,u)>190)&&pick.every(p=>colourDistance(c,p)>190))pick.push(c);}while(pick.length<2)pick.push(KEEPER_COLOURS[pick.length]);return pick;}
// Point the two match sides at the chosen clubs (names, badges, kits). The rest of the game reads TEAMS.
export function applyClubs(homeId=DEFAULT_CLUBS.home,awayId=DEFAULT_CLUBS.away){
 const home=clubById(homeId),away=clubById(awayId===homeId?CLUBS.find(c=>c.id!==homeId).id:awayId),kits=matchKits(home,away),keepers=keeperColours(kits);
 [home,away].forEach((club,i)=>Object.assign(TEAMS[i],{name:club.name,short:club.short,en:club.en,color:light(kits[i].shirt)?club.crest.a:kits[i].shirt,chest:chestText(club),club,kit:kits[i],keeper:keepers[i]}));
 return TEAMS;
}
// An original crest: a shield or roundel split in the two club colours with the club initial.
export function crestSVG(club,size=64){
 const {shape,a,b,glyph}=club.crest,id='c'+club.id;
 const outline=shape==='round'?'<circle cx="32" cy="32" r="29"/>':'<path d="M8 6h48v26c0 14-11 22-24 27C19 54 8 46 8 32Z"/>';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><clipPath id="${id}">${outline}</clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g clip-path="url(#${id})"><rect width="64" height="64" fill="${a}"/><path d="M32 0h32v64H32Z" fill="${b}" opacity=".92"/><rect y="40" width="64" height="5" fill="#fff" opacity=".85"/><rect width="64" height="64" fill="url(#${id}g)"/></g><g fill="none" stroke="#fff" stroke-width="2.4" opacity=".95">${outline}</g><text x="32" y="36" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="24" fill="#fff" stroke="#000" stroke-opacity=".25" stroke-width="1">${glyph}</text><text x="32" y="54" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="6.5" fill="#fff" letter-spacing=".5">${club.founded}</text></svg>`;
}
