export type Stroke = 'free'|'back'|'breast'|'fly';
export interface Swimmer { id: string; name: string; sex:'M'|'F'; dob:string; times:Record<string,number>; individualEntries:number }
export interface Meet { name:string; ageUpDate:string; relayLimitPerSwimmer:number; startSplitAdjustCs:number; lanes:4|6|8|10; laneOrder:number[]; circleHeats:0|2|3; minSlowestHeat:3; poolBooking:{start:string;end:string}; timing:{gapBetweenHeatsS:number;gapBetweenEventsS:number;pessimism:number} }
export interface RelayDef {id:string;name:string;kind:'free'|'medley';legDist:number;gender:'M'|'F'|'X';ageMin?:number;ageMax?:number;ageSumMin?:number;ageSumMax?:number;teams:1|2|3;priority:number}
export interface Team {relayId:string;slot:number}
export interface Lock {swimmerId:string;team:Team;leg:number;mode:'pin'|'ban'}
export interface Input {swimmers:Swimmer[];meet:Meet;relays:RelayDef[];locks:Lock[]}
export interface Lineup {team:Team;legs:{leg:number;swimmerId:string;cs:number}[];totalCs:number}
export interface Solution {status:'optimal'|'feasible'|'infeasible'|'no_solution_found';teams:Lineup[];stats:{weight:number;costCs:number;tie:number};diagnostics:string[]}
export const key = (t:Team) => `${t.relayId}:${t.slot}`;
export function age(dob:string,on:string) {return +on.slice(0,4)-+dob.slice(0,4)-(on.slice(5)<dob.slice(5)?1:0);}
export const strokes = (r:RelayDef):Stroke[] => r.kind==='free'?['free','free','free','free']:['back','breast','fly','free'];
export function hash(s:string) {let h=2166136261;for(const c of s) h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)%10;}
export function assertInput(p:Input) {
 const date=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!date(p.meet.ageUpDate)||!Number.isInteger(p.meet.relayLimitPerSwimmer)||p.meet.relayLimitPerSwimmer<0||!Number.isInteger(p.meet.startSplitAdjustCs)) throw Error('Invalid meet');
 if(new Set(p.swimmers.map(s=>s.id)).size!==p.swimmers.length||new Set(p.relays.map(r=>r.id)).size!==p.relays.length) throw Error('Duplicate IDs');
 for(const s of p.swimmers) if(!s.id||!['M','F'].includes(s.sex)||!date(s.dob)||s.dob>p.meet.ageUpDate||!Number.isInteger(s.individualEntries)||s.individualEntries<0||Object.values(s.times).some(t=>!Number.isSafeInteger(t)||t<=0)) throw Error(`Invalid swimmer ${s.id}`);
 for(const r of p.relays) if(!r.id||!['free','medley'].includes(r.kind)||!['M','F','X'].includes(r.gender)||![1,2,3].includes(r.teams)||!Number.isInteger(r.priority)||r.priority<1||r.priority>9||!Number.isInteger(r.legDist)||r.legDist<=0||[r.ageMin,r.ageMax,r.ageSumMin,r.ageSumMax].some(v=>v!==undefined&&(!Number.isInteger(v)||v<0))) throw Error(`Invalid relay ${r.id}`);
}
