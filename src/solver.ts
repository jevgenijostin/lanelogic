import type {Highs} from 'highs';
import {assertInput,type Input,type Solution,type Lineup} from './domain';
import {buildModel} from './model';
import {validate} from './validator';
export interface Limits {timeS?:number;nodes?:number}
export function solve(p:Input,highs:Highs,limits:Limits={},diagnose=true):Solution {
 assertInput(p);const m=buildModel(p);let best:Solution|undefined;let w:number|undefined,c:number|undefined;
 const empty=(status:Solution['status']):Solution=>({status,teams:[],stats:{weight:0,costCs:0,tie:0},diagnostics:[]});
 const start=performance.now();
 for(let stage=1;stage<=3;stage++){
  const remaining=limits.timeS===undefined?undefined:Math.max(0,limits.timeS-(performance.now()-start)/1000);
  const raw=highs.solve(m.lp(stage,w,c),{mip_rel_gap:0,mip_abs_gap:0,random_seed:0,threads:1,...(remaining===undefined?{}:{time_limit:remaining}),...(limits.nodes===undefined?{}:{mip_max_nodes:limits.nodes})});
  if(raw.Status==='Infeasible'){
   if(best)throw Error('Lexicographic stage unexpectedly infeasible');const out=empty('infeasible');
   if(diagnose)for(const family of ['locks','caps','age bands','eligibility']) {const q=structuredClone(p);if(family==='locks')q.locks=[];if(family==='caps'){q.meet.relayLimitPerSwimmer=999;q.swimmers.forEach(s=>s.individualEntries=0);}if(family==='age bands')q.relays.forEach(r=>{delete r.ageMin;delete r.ageMax;delete r.ageSumMin;delete r.ageSumMax;});if(family==='eligibility'){q.relays.forEach(r=>r.gender='X');q.swimmers.forEach(s=>q.relays.forEach(r=>['free','back','breast','fly'].forEach(st=>s.times[`${st}${r.legDist}`]??=10000)));}const relaxed=solve(q,highs,limits,false);if(['optimal','feasible'].includes(relaxed.status))out.diagnostics.push(family);}
   return out;
  }
  const val=(n:string)=>{const col=raw.Columns?.[n];return col&&'Primal' in col?col.Primal:NaN;};
  const teams:Lineup[]=m.teams.flatMap((team,t)=>val(`y${t}`)>0.5?[{team,legs:m.vars.filter(v=>v.t===t&&val(v.name)>0.5).map(v=>({leg:v.l,swimmerId:p.swimmers[v.i].id,cs:v.c})).sort((a,b)=>a.leg-b.leg),totalCs:0}]:[]);
  teams.forEach(t=>t.totalCs=t.legs.reduce((a,l)=>a+l.cs,0)-3*p.meet.startSplitAdjustCs);
  const selected=m.vars.filter(v=>val(v.name)>0.5);
  const valid=Number.isFinite(val('z'))&&validate(p,teams).length===0;
  if(valid)best={status:'feasible',teams,stats:{weight:teams.reduce((a,t)=>a+p.relays.find(r=>r.id===t.team.relayId)!.priority,0),costCs:selected.reduce((a,v)=>a+v.c,0),tie:selected.reduce((a,v)=>a+v.h,0)},diagnostics:[]};
  if(raw.Status!=='Optimal')return best??empty('no_solution_found');
  if(!best||!valid)throw Error(`Solver returned invalid optimum: ${validate(p,teams).join(', ')}`);
  w=best.stats.weight;c=stage>=2?best.stats.costCs:undefined;
 }
 best!.status='optimal';return best!;
}
