import { FormEvent, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, GraduationCap, Mic, MoreVertical, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { ChatResponse, Message, Profile, Step } from './types';
import { localReply, opening } from './lib/localTeacher';
import { askGemini } from './lib/geminiTeacher';
import { CurriculumDrawer } from './components/CurriculumDrawer';
const now=()=>new Intl.DateTimeFormat('ar-IQ',{hour:'2-digit',minute:'2-digit'}).format(new Date());
const id=()=>crypto.randomUUID();
const stored=()=>{try{return JSON.parse(localStorage.getItem('saif-qalam-session')||'null')}catch{return null}};
export default function App(){
 const previous=stored();
 const [profile,setProfile]=useState<Profile>(previous?.profile||{}); const [step,setStep]=useState<Step>(previous?.step||1);
 const [messages,setMessages]=useState<Message[]>(previous?.messages||[{id:id(),role:'teacher',text:opening(previous?.profile||{},previous?.step||1),time:now()}]);
 const [input,setInput]=useState(''); const [thinking,setThinking]=useState(false); const [drawer,setDrawer]=useState(false); const bottom=useRef<HTMLDivElement>(null);
 const progress=useMemo(()=>Math.min(100,((step-1)/4)*100),[step]);
 const save=(m:Message[],p:Profile,s:Step)=>localStorage.setItem('saif-qalam-session',JSON.stringify({messages:m,profile:p,step:s}));
 async function submit(e:FormEvent){e.preventDefault();const text=input.trim();if(!text||thinking)return;const mine={id:id(),role:'student' as const,text,time:now()};const base=[...messages,mine];setMessages(base);setInput('');setThinking(true);setTimeout(()=>bottom.current?.scrollIntoView({behavior:'smooth'}),30);
  let result:ChatResponse;
  try{const api=import.meta.env.VITE_API_BASE; const encoded=[import.meta.env.VITE_GEMINI_A,import.meta.env.VITE_GEMINI_B,import.meta.env.VITE_GEMINI_C].filter(Boolean).join(''); const geminiKey=encoded?atob(encoded):''; if(api){const userId=localStorage.getItem('saif-qalam-user')||id();localStorage.setItem('saif-qalam-user',userId);const res=await fetch(`${api}/api/chat`,{method:'POST',headers:{'content-type':'application/json','x-student-id':userId},body:JSON.stringify({message:text})});if(!res.ok)throw new Error('api');result=await res.json();}else if(geminiKey){result=await askGemini(geminiKey,text,profile,step,base)}else{result=localReply(text,profile,step)}}catch{result={...localReply('',profile,step),reply:'صار عندي تأخير بسيط بالاتصال. أرسل جوابك مرة ثانية بعد لحظة 🌿'}}
  const reply={id:id(),role:'teacher' as const,text:result.reply,time:now(),audioUrl:result.audioUrl};const next=[...base,reply];setProfile(result.profile);setStep(result.currentStep);setMessages(next);save(next,result.profile,result.currentStep);setThinking(false);if(result.unlock)setTimeout(()=>setDrawer(true),500);setTimeout(()=>bottom.current?.scrollIntoView({behavior:'smooth'}),30);
 }
 return <main className="app-shell"><section className="phone-frame"><header className="topbar"><div className="brand"><div className="crest">ن</div><div><h1>أستاذة نورة <Check size={14}/></h1><p><span/> متصلة الآن</p></div></div><div className="top-actions"><button onClick={()=>setDrawer(true)} className="icon-button" aria-label="دفتر التعلم"><BookOpen/></button><button className="icon-button" aria-label="المزيد"><MoreVertical/></button></div></header>
 <div className="journey"><div className="journey-row"><span><Sparkles size={15}/> رحلة التعارف</span><strong>{Math.min(step-1,4)} من 4</strong></div><div className="progress"><i style={{width:`${progress}%`}}/></div><p>{step<5?'كل جواب يساعدني أصمّم تعلّمك بطريقة تناسبك':'اكتمل ملفك، نبدأ التعلّم الآن'}</p></div>
 <div className="privacy"><ShieldCheck size={17}/><span>حديثك محفوظ بأمان، وأستخدمه حتى ما أعيد عليك الأسئلة.</span></div>
 <section className="messages" aria-live="polite"><div className="day-chip">اليوم</div>{messages.map(m=><div key={m.id} className={`message-row ${m.role}`}><div className="bubble">{m.text}{m.audioUrl&&<button className="voice-note"><Mic size={16}/> رسالة صوتية خاصة</button>}<time>{m.time}{m.role==='student'&&<Check size={13}/>}</time></div></div>)}{thinking&&<div className="message-row teacher"><div className="bubble typing"><i/><i/><i/></div></div>}<div ref={bottom}/></section>
 <form className="composer" onSubmit={submit}><button type="button" className="round-button" aria-label="صوت"><Mic/></button><input value={input} onChange={e=>setInput(e.target.value)} placeholder={step===5?'اسأل أستاذة نورة…':'اكتب جوابك هنا…'} aria-label="رسالتك"/><button className="send-button" aria-label="إرسال" disabled={!input.trim()||thinking}><Send/></button></form><footer><GraduationCap size={15}/> سيف وقلم · تعلّم يفهمك</footer></section><CurriculumDrawer open={drawer} onClose={()=>setDrawer(false)}/>{drawer&&<button className="backdrop" onClick={()=>setDrawer(false)} aria-label="إغلاق"/>}</main>
}
