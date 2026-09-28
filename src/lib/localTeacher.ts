import type { ChatResponse, Profile, Step } from '../types';
const cities: Record<string,string> = {
  'البصرة':'البصرة','بصره':'البصرة','أقصى جنوب العراق':'البصرة','اقصى جنوب العراق':'البصرة','جنوب العراق':'البصرة',
  'بغداد':'بغداد','الموصل':'الموصل','نينوى':'نينوى','اربيل':'أربيل','أربيل':'أربيل','النجف':'النجف','كربلاء':'كربلاء',
  'ذي قار':'ذي قار','الناصرية':'ذي قار','ميسان':'ميسان','العمارة':'ميسان','الأنبار':'الأنبار','الانبار':'الأنبار',
  'ديالى':'ديالى','واسط':'واسط','الكوت':'واسط','كركوك':'كركوك','صلاح الدين':'صلاح الدين','الديوانية':'القادسية','بابل':'بابل','الحلة':'بابل'
};
const jokes = /^(ه+ا+|😂+|🤣+|هه+|lol|نسيت|ما ?اعرف|باتمان|قطة|كلب)$/i;
const names = /^[\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){0,2}$/;
const grades = /(اول|أول|ثاني|ثالث|رابع|خامس|سادس).*(متوسط|اعدادي|إعدادي)|^(1|2|3|4|5|6)$/;
const variants: Record<number,string[]> = {
  1:['خلّ نبدأ من البداية 😊 شنو اسمك؟','أهلًا بيك بسيف وقلم. أحب أعرفك أولًا، شنو اسمك؟'],
  2:['تشرفنا! من أي محافظة بالعراق؟','حلو، هسه خبرني من وين أنت؟'],
  3:['تمام. بأي صف تدرس حاليًا؟','زين، وصلنا للدراسة: شنو صفك؟'],
  4:['وآخر سؤال قريب للقلب: شنو حلمك بالمستقبل؟','إذا نطالع لقدّام، شتريد تصير بالمستقبل؟']
};
let n = 0;
const ask = (s:number) => variants[s][(n++) % variants[s].length];
export function opening(profile: Profile, step: Step) { return step === 5 ? `هلا ${profile.name ?? 'بطل'}، جاهز نكمل طريقنا؟` : ask(step); }
export function localReply(inputRaw:string, profile:Profile, step:Step):ChatResponse {
 const input=inputRaw.trim(); const next={...profile};
 if (!input || jokes.test(input)) return {reply: input.includes('نسيت') ? 'طالب شاطر مثلك ناسي؟ 😄 جرّب مرة ثانية.' : `هههه وصلتني 😄 بس ${ask(step)}`,profile:next,currentStep:step,accepted:false};
 if(step===1){ if(!names.test(input) || input.length>35) return {reply:'هذا اسم بطل خارق لو اسمك الحقيقي؟ 😄 اكتب لي اسمك مثل ما تحب أناديك.',profile:next,currentStep:step,accepted:false}; next.name=input; return {reply:`تشرفنا يا ${input}! من أي محافظة بالعراق؟`,profile:next,currentStep:2,accepted:true}; }
 if(step===2){ const exact=Object.entries(cities).find(([k])=>input.includes(k)); if(!exact) return {reply:'أعطني تلميح أو اسم المحافظة؛ أحب أحزرها صح من أول مرة 😉',profile:next,currentStep:step,accepted:false}; next.location=exact[1]; return {reply:`أهل ${exact[1]} على راسي. بأي صف تدرس حاليًا؟`,profile:next,currentStep:3,accepted:true}; }
 if(step===3){ if(!grades.test(input)) return {reply:'قربت، بس أحتاج الصف والمرحلة؛ مثل: الثالث المتوسط.',profile:next,currentStep:step,accepted:false}; next.grade=input; return {reply:'ممتاز. بقي سؤال واحد: شنو حلمك بالمستقبل؟',profile:next,currentStep:4,accepted:true}; }
 if(step===4){ if(input.length<3 || /ما ?اعرف|نسيت/.test(input)) return {reply:'حتى لو بعدك محتار، اختار حلمًا تحب تجرّبه… شنو أول شي إجا ببالك؟',profile:next,currentStep:step,accepted:false}; next.dream=input; return {reply:`حلم جميل يا ${next.name}. من اليوم نبني الطريق إله خطوة خطوة 🌱`,profile:next,currentStep:5,accepted:true,unlock:'curriculum'}; }
 return {reply:`أنا وياك يا ${next.name ?? 'بطل'}. اختر مسألة من دفتر التعلّم ونحلها سوا.`,profile:next,currentStep:5,accepted:true,unlock:'curriculum'};
}
