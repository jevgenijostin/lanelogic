import loadHighs from 'highs';
import assert from 'node:assert/strict';
import {solve} from '../src/solver';
import {oracle} from './oracle';
import {random} from './fixtures';
const highs=await loadHighs();
const start=performance.now();
for(let i=1;i<=500;i++) {const p=random(i);const expected=oracle(p);const actual=solve(p,highs,{},false);assert.equal(actual.status==='infeasible',expected===null,`seed ${i}`);if(expected){assert.equal(actual.status,'optimal');assert.equal(actual.stats.weight,expected.weight,`weight seed ${i}`);assert.equal(actual.stats.costCs,expected.costCs,`cost seed ${i}`);}if(i%100===0)console.log(`G3 progress ${i}/500`);}
console.log(`G3 PASS: 500/500 oracle objectives and verdicts matched (${Math.round(performance.now()-start)} ms)`);
