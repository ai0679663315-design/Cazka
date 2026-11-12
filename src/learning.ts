export type SkillProgress = { attempts: number; correct: number; streak: number; lastPracticed: string };
export type LearningRecord = { reading: SkillProgress; arithmetic: SkillProgress };
export type MathTask = { terms: number[]; result: number; spoken: string };
const empty = (): SkillProgress => ({attempts:0,correct:0,streak:0,lastPracticed:''});
export const newRecord = (): LearningRecord => ({reading:empty(),arithmetic:empty()});
export function recordAttempt(record: LearningRecord, skill: keyof LearningRecord, success: boolean, date = new Date().toISOString()): LearningRecord {
 const old=record[skill]; return {...record,[skill]:{attempts:old.attempts+1,correct:old.correct+(success?1:0),streak:success?old.streak+1:0,lastPracticed:date}};
}
export function nextDifficulty(skill: SkillProgress): 'easy'|'medium'|'hard' {
 if(skill.attempts<5) return 'easy';
 const rate=skill.correct/skill.attempts;
 return rate>=0.85 && skill.streak>=3?'hard':rate>=0.65?'medium':'easy';
}
const words=['нуль','один','два','три','чотири','п’ять','шість','сім','вісім','дев’ять','десять'];
export function makeMathTask(max=10,count=3,random=Math.random):MathTask {
 if(max<2||count<2||count>6) throw new Error('Invalid task settings');
 const terms:number[]=[];let sum=0;
 for(let i=0;i<count;i++){const remaining=max-sum;const value=Math.floor(random()*(Math.min(remaining,10)+1));terms.push(value);sum+=value;}
 return {terms,result:sum,spoken:terms.map((n,i)=>(i?'плюс ':'')+(words[n]??String(n))).join(', ')};
}
export function normalizeAnswer(value:string):number|null {
 const clean=value.trim().toLowerCase();
 const n=Number(clean); if(clean!==''&&Number.isInteger(n)) return n;
 const normalized=clean.replace(/[’'`ʼ]/g,'’').replace(/[.!?]/g,'').trim();
 const extra=['одинадцять','дванадцять','тринадцять','чотирнадцять','п’ятнадцять','шістнадцять','сімнадцять','вісімнадцять','дев’ятнадцять'];
 const index=words.indexOf(normalized);if(index>=0)return index;
 const teen=extra.indexOf(normalized);if(teen>=0)return teen+11;
 if(normalized==='двадцять')return 20;if(normalized==='тридцять')return 30;
 if(normalized.startsWith('двадцять ')){const unit=words.indexOf(normalized.slice(9));if(unit>0)return 20+unit;}
 return null;
}
