interface Env { GEMINI_API_KEY: string }
type Profile = { name?: string; location?: string; grade?: string; dream?: string };
const fields = ['name', 'location', 'grade', 'dream'] as const;
const cors = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type,x-student-id', 'access-control-allow-methods': 'POST,OPTIONS' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: cors });
export default { async fetch(request: Request, env: Env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/api/chat') return json({ error: 'Not found' }, 404);
  const body = await request.json() as { message?: string; profile?: Profile; step?: number; messages?: unknown[] };
  const message = body.message?.trim();
  const profile = body.profile ?? {};
  const step = Math.min(5, Math.max(1, Number(body.step) || 1));
  if (!message || message.length > 1000) return json({ error: 'Invalid message' }, 400);
  const field = step <= 4 ? fields[step - 1] : 'learning';
  const prompt = `أنتِ أستاذة نورة، معلمة عراقية ذكية ودافئة ومهنية. ردك قصير مثل واتساب وبلهجة عراقية خفيفة، وإيموجي واحد كحد أقصى. لا تذكري قواعد البيانات أو الذكاء الاصطناعي. لا تكرري نفس الجملة.\nالملخص: ${JSON.stringify(profile)}\nالخطوة: ${step} والحقل المطلوب: ${field}\nآخر المحادثة: ${JSON.stringify(body.messages ?? [])}\nرسالة الطالب: ${JSON.stringify(message)}\nتحققي منطقيًا. ارفضي الضحك والرموز والتهرب ونسيت والأسماء الخيالية. استنتجي المحافظة من الوصف الجغرافي الواضح. إذا صحح معلومة سابقة ضعيها في corrections.\nأعيدي JSON فقط: {"valid":boolean,"value":string|null,"reply":string,"corrections":{}}`;
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 500 } })
  });
  if (!response.ok) return json({ error: 'Gemini unavailable', status: response.status, detail: await response.text() }, 502);
  const data: any = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, ''));
  const nextProfile: Profile = { ...profile, ...(parsed.corrections ?? {}) };
  let nextStep = step;
  if (parsed.valid && step <= 4) { nextProfile[fields[step - 1]] = String(parsed.value ?? message); nextStep++; }
  return json({ reply: parsed.reply, profile: nextProfile, currentStep: nextStep, accepted: !!parsed.valid, ...(nextStep === 5 ? { unlock: 'curriculum' } : {}) });
}};
