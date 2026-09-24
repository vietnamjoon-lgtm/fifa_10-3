import {engineValue,overallRating} from './player-ratings.js';
import {cleanProfile} from './squads.js';
// 실제 선수 이름만 사용하고 능력치·등급명은 자체 제작입니다. FC 온라인의 비공개 수치나 고유 등급명은 쓰지 않습니다.
export const TIERS={
 bronze:{id:'bronze',name:'브론즈',min:0,max:64,color:'#c9a35f',walkout:false},
 silver:{id:'silver',name:'실버',min:65,max:74,color:'#cfd4da',walkout:false},
 gold:{id:'gold',name:'골드',min:75,max:84,color:'#e8c15a',walkout:false},
 special:{id:'special',name:'스페셜',min:85,max:99,color:'#d96bd1',walkout:true}
};
export const TIER_ORDER=['bronze','silver','gold','special'];
export function tierOf(overall){return TIER_ORDER.findLast(id=>overall>=TIERS[id].min)||'bronze';}
const FWD=(name,club,nation,number,foot,height,weight,pac,sho,pas,dri,def,phy)=>({name,club,nation,role:'FWD',number,foot,height,weight,pac,sho,pas,dri,def,phy});
const MID=(name,club,nation,number,foot,height,weight,pac,sho,pas,dri,def,phy)=>({name,club,nation,role:'MID',number,foot,height,weight,pac,sho,pas,dri,def,phy});
const DEF=(name,club,nation,number,foot,height,weight,pac,sho,pas,dri,def,phy)=>({name,club,nation,role:'DEF',number,foot,height,weight,pac,sho,pas,dri,def,phy});
const GK=(name,club,nation,number,foot,height,weight,ref,reach,dri)=>({name,club,nation,role:'GK',number,foot,height,weight,ref,reach,dri,pac:56,sho:26,pas:58,def:26,phy:70});
export const CARD_POOL=[
 FWD('리오넬 메시','인터 마이애미','아르헨티나',10,'left',1.70,72,76,88,91,94,34,64),
 FWD('킬리안 음바페','레알 마드리드','프랑스',9,'right',1.78,75,97,90,80,92,36,78),
 FWD('엘링 홀란','맨체스터 시티','노르웨이',9,'left',1.95,88,89,93,68,80,45,93),
 FWD('라민 야말','바르셀로나','스페인',10,'left',1.80,72,88,84,84,93,35,66),
 FWD('우스만 뎀벨레','파리 생제르맹','프랑스',10,'right',1.78,67,92,85,80,90,40,68),
 FWD('크리스티아누 호날두','알 나스르','포르투갈',7,'right',1.87,84,82,92,74,82,34,75),
 FWD('비니시우스 주니오르','레알 마드리드','브라질',7,'right',1.76,73,93,78,76,87,29,68),
 FWD('플로리안 비르츠','리버풀','독일',7,'right',1.76,70,80,78,86,88,52,65),
 FWD('해리 케인','바이에른 뮌헨','잉글랜드',9,'right',1.88,86,70,91,83,81,47,83),
 FWD('손흥민','로스앤젤레스 FC','대한민국',7,'right',1.83,78,86,86,78,83,42,71),
 FWD('콜 파머','첼시','잉글랜드',10,'left',1.85,72,68,72,74,76,44,65),
 FWD('케난 이을드즈','유벤투스','튀르키예',10,'right',1.80,70,74,70,72,78,40,62),
 FWD('제오바니 켄다','첼시','포르투갈',47,'right',1.78,68,70,56,60,66,38,55),
 MID('로드리','바르셀로나','스페인',16,'right',1.91,82,66,72,86,82,84,84),
 MID('주드 벨링엄','레알 마드리드','잉글랜드',5,'right',1.86,75,76,82,82,86,72,82),
 MID('페드리','바르셀로나','스페인',8,'right',1.74,60,70,72,84,84,66,60),
 MID('데클란 라이스','아스널','잉글랜드',41,'right',1.85,80,72,74,80,78,85,84),
 MID('페데리코 발베르데','레알 마드리드','우루과이',15,'right',1.82,78,82,80,82,80,78,80),
 MID('자말 무시알라','바이에른 뮌헨','독일',10,'right',1.84,70,78,80,80,90,50,62),
 MID('엔소 페르난데스','맨체스터 시티','아르헨티나',8,'right',1.78,76,72,76,84,80,76,76),
 MID('이강인','파리 생제르맹','대한민국',19,'left',1.73,68,64,70,72,74,52,60),
 MID('파비안 루이스','파리 생제르맹','스페인',8,'left',1.89,70,60,68,76,74,70,72),
 MID('가비','바르셀로나','스페인',6,'right',1.73,68,68,66,72,76,72,70),
 MID('프렝키 더용','바르셀로나','네덜란드',21,'right',1.80,74,62,66,74,76,68,72),
 MID('모건 로저스','첼시','잉글랜드',27,'right',1.85,75,74,70,70,74,56,70),
 MID('엘리엇 앤더슨','맨체스터 시티','잉글랜드',8,'right',1.80,70,62,58,64,62,64,66),
 MID('티아고 피타르치','레알 마드리드','스페인',36,'right',1.75,66,58,54,62,60,58,58),
 DEF('비르질 반 다이크','리버풀','네덜란드',4,'right',1.95,92,76,62,74,72,88,90),
 DEF('윌리엄 살리바','아스널','프랑스',2,'right',1.92,84,84,50,72,72,87,86),
 DEF('아슈라프 하키미','파리 생제르맹','모로코',2,'right',1.81,73,94,72,80,84,78,76),
 DEF('파우 쿠바르시','바르셀로나','스페인',5,'right',1.86,76,76,48,78,74,84,78),
 DEF('김민재','바이에른 뮌헨','대한민국',3,'right',1.90,88,74,50,60,62,74,78),
 DEF('누누 멘데스','파리 생제르맹','포르투갈',25,'left',1.80,70,80,58,70,76,70,72),
 DEF('마르키뉴스','파리 생제르맹','브라질',5,'right',1.83,75,70,52,70,68,76,74),
 DEF('가브리에우 마갈량이스','아스널','브라질',6,'left',1.90,84,68,60,62,64,78,80),
 DEF('알레산드로 바스토니','인터 밀란','이탈리아',95,'left',1.90,80,72,52,72,68,76,76),
 DEF('레비 콜윌','첼시','잉글랜드',6,'left',1.87,79,62,44,60,58,66,64),
 GK('잔루이지 돈나룸마','맨체스터 시티','이탈리아',1,'right',1.96,90,90,88,58),
 GK('티보 쿠르투아','레알 마드리드','벨기에',1,'left',1.99,96,89,90,54),
 GK('에밀리아노 마르티네스','아스톤 빌라','아르헨티나',23,'right',1.95,88,76,72,52),
 GK('얀 오블라크','아틀레티코 마드리드','슬로베니아',13,'right',1.88,87,80,74,50),
 GK('알리송 베커','리버풀','브라질',1,'right',1.93,91,80,76,52)
];
const statDisplay=card=>({pace:card.pac,acceleration:card.pac,shooting:card.sho,power:card.sho,passing:card.pas,longPass:card.pas,control:card.dri,agility:card.dri,balance:card.dri,tackling:card.def,strength:card.phy,reflexes:card.ref??38,reach:card.reach??60,weakFoot:card.weak??62});
const SKIN=['#bf8561','#976143','#deb18a','#74482f','#c89572','#e1ad88'];
export function cardProfile(card,uid){
 const raw={uid:uid||`card-${card.name}-${Date.now()}`,name:card.name,number:card.number,role:card.role,foot:card.foot,height:card.height,weight:card.weight,build:card.role==='GK'?1.02:.96,skin:SKIN[card.name.length%6],hairStyle:card.number%3===0?'crest':'short'};
 for(const [key,value] of Object.entries(statDisplay(card)))raw[key]=engineValue(key,value);
 return cleanProfile(raw);
}
export function cardOverall(card){return overallRating(cardProfile(card,'preview'));}
export function cardTier(card){return tierOf(cardOverall(card));}
export function poolByTier(){const groups={bronze:[],silver:[],gold:[],special:[]};for(const card of CARD_POOL)groups[cardTier(card)].push(card);return groups;}
