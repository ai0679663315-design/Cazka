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
 const index=words.indexOf(clean.replace("'",'’'));return index>=0?index:null;
}
