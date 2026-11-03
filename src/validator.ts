import type {Input,Lineup} from './domain';
// Intentionally does not import model-builder eligibility or constraint helpers.
export function validate(p:Input,teams:Lineup[]):string[] {
 const errors:string[]=[]; const counts=new Map<string,number>();const events=new Set<string>(); const seen=new Set<string>();
 for(const t of teams) {
  const r=p.relays.find(r=>r.id===t.team.relayId);const tk=`${t.team.relayId}:${t.team.slot}`;
  if(!r||t.team.slot<0||t.team.slot>=r.teams||!Number.isInteger(t.team.slot)||seen.has(tk)){errors.push('C1: unknown/duplicate team');continue;}seen.add(tk);
  if(t.legs.length!==4||new Set(t.legs.map(l=>l.leg)).size!==4||t.legs.some(l=>![0,1,2,3].includes(l.leg)))errors.push('C1: four legs required');
  const ids=new Set<string>();let male=0,sumAge=0,total=0;
  for(const l of t.legs){
   const s=p.swimmers.find(s=>s.id===l.swimmerId);if(!s){errors.push('eligibility: unknown swimmer');continue;}
   const a=Number(p.meet.ageUpDate.substring(0,4))-Number(s.dob.substring(0,4))-(p.meet.ageUpDate.substring(5)<s.dob.substring(5)?1:0);
   const stroke=r.kind==='free'?'free':['back','breast','fly','free'][l.leg];const time=s.times[`${stroke}${r.legDist}`];
   if((r.gender!=='X'&&s.sex!==r.gender)||a<(r.ageMin??0)||a>(r.ageMax??Infinity)||time===undefined)errors.push('eligibility: sex/age/NT');
   if(l.cs!==time)errors.push('reporting: split');total+=time??0;sumAge+=a;male+=s.sex==='M'?1:0;
   if(ids.has(s.id))errors.push('C2: duplicate swimmer');ids.add(s.id);
   const ek=`${r.id}/${s.id}`;if(events.has(ek))errors.push('C3: duplicate event');events.add(ek);
   counts.set(s.id,(counts.get(s.id)??0)+1);
  }
  if(r.gender==='X'&&male!==2)errors.push('C6: mixed balance');
  if(sumAge<(r.ageSumMin??0)||sumAge>(r.ageSumMax??Infinity))errors.push('C7: age sum');
  if(t.totalCs!==total-3*p.meet.startSplitAdjustCs)errors.push('reporting: total');
 }
 for(const t of teams)if(t.team.slot>0&&!seen.has(`${t.team.relayId}:${t.team.slot-1}`))errors.push('C5: team gap');
 for(const s of p.swimmers)if((counts.get(s.id)??0)>Math.max(0,p.meet.relayLimitPerSwimmer-s.individualEntries))errors.push('C4: caps');
 for(const lock of p.locks){const present=teams.some(t=>t.team.relayId===lock.team.relayId&&t.team.slot===lock.team.slot&&t.legs.some(l=>l.leg===lock.leg&&l.swimmerId===lock.swimmerId));if(lock.mode==='pin'?!present:present)errors.push('C8: locks');}
 return [...new Set(errors)];
}
