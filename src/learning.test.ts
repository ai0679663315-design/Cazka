import { describe,it,expect } from 'vitest';
import { makeMathTask,newRecord,recordAttempt,nextDifficulty,normalizeAnswer } from './learning';
describe('learning',()=>{
 it('generates bounded solvable tasks',()=>{for(let i=0;i<100;i++){const t=makeMathTask(10,3,Math.random);expect(t.terms.reduce((a,b)=>a+b,0)).toBe(t.result);expect(t.result).toBeLessThanOrEqual(10);}});
 it('tracks attempts and streak',()=>{let p=newRecord();p=recordAttempt(p,'arithmetic',true);p=recordAttempt(p,'arithmetic',false);expect(p.arithmetic).toMatchObject({attempts:2,correct:1,streak:0});});
 it('adapts difficulty from evidence',()=>{let p=newRecord();for(let i=0;i<5;i++)p=recordAttempt(p,'reading',true);expect(nextDifficulty(p.reading)).toBe('hard');});
 it('parses Ukrainian speech answers',()=>{expect(normalizeAnswer('сім')).toBe(7);expect(normalizeAnswer(' 7 ')).toBe(7);expect(normalizeAnswer('невідомо')).toBeNull();});
});
