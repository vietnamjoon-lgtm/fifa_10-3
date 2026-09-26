import {assistanceDefaults} from './control-assist.js';
import {cleanGameplay,gameplayDefaults} from './gameplay-settings.js';
import {cleanClub,DEFAULT_CLUBS} from './clubs.js';
export const defaults={...assistanceDefaults,gameplay:gameplayDefaults,quality:'high',adaptiveQuality:true,camera:0,volume:.5,sound:false,halfSeconds:120,difficulty:'normal',userTeam:0,deadzone:.15,sensitivity:1,shadows:true,crowd:true,scale:1,helpers:true,controls:'online',defence:'basic',homeClub:DEFAULT_CLUBS.home,awayClub:DEFAULT_CLUBS.away};
export function loadSettings(){try{const raw=JSON.parse(localStorage.getItem('touchline-settings')||'{}');return {...defaults,...raw,gameplay:cleanGameplay(raw?.gameplay),homeClub:cleanClub(raw?.homeClub,DEFAULT_CLUBS.home),awayClub:cleanClub(raw?.awayClub,DEFAULT_CLUBS.away)}}catch{return {...defaults,gameplay:cleanGameplay()}}}
export function saveSettings(settings){try{localStorage.setItem('touchline-settings',JSON.stringify(settings))}catch{}}
