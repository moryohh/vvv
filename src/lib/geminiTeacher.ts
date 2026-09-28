import type { ChatResponse, Message, Profile, Step } from '../types';

const stepField = ['name', 'location', 'grade', 'dream'] as const;

function cleanJson(text: string) {
  return text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
}

export async function askGemini(
  key: string,
  message: string,
  profile: Profile,
  step: Step,
  messages: Message[]
): Promise<ChatResponse> {
  const field = step <= 4 ? stepField[step - 1] : 'learning';
  const recent = messages.slice(-8).map(({ role, text }) => ({ role, text }));
  const prompt = `أنتِ أستاذة نورة، معلمة عراقية ذكية ودافئة ومهنية داخل منصة سيف وقلم.

قواعد شخصيتك:
- اكتبي رسالة عربية قصيرة جدًا تشبه واتساب، بلهجة عراقية خفيفة مفهومة، وإيموجي واحد كحد أقصى.
- لا تقولي: قاعدة بيانات، تم استلام البيانات، تم التحديث، نموذج ذكاء اصطناعي، أو أي كلام تقني.
- لا تكرري نص رد سابق حرفيًا.
- كوني مرحة من دون مبالغة أو ألقاب مسرحية.

حالة الطالب الحالية:
- الملخص المحفوظ: ${JSON.stringify(profile)}
- رقم الخطوة: ${step}
- الحقل المطلوب الآن: ${field}
- آخر المحادثة: ${JSON.stringify(recent)}
- رسالة الطالب الجديدة: ${JSON.stringify(message)}

قواعد التحقق:
1. الخطوات بالترتيب: الاسم ثم المحافظة العراقية ثم الصف الدراسي ثم الحلم.
2. لا تقبلي الضحك، الرموز، التهرب، "نسيت"، اسم حيوان أو شخصية خيالية كإجابة.
3. إذا وصف موقعًا جغرافيًا بوضوح، استنتجي المحافظة. مثال: أقصى جنوب العراق = البصرة.
4. لا تزيدي الخطوة إلا إذا كانت إجابة الحقل الحالي صالحة.
5. إذا صحح معلومة سابقة، ضعي القيمة الصحيحة داخل corrections حتى لو كان يسأل عن خطوة أخرى.
6. بعد قبول الحلم افتحي curriculum.

أعيدي JSON صالحًا فقط بهذا الشكل:
{"valid":true,"value":"القيمة الموحدة أو null","reply":"رد أستاذة نورة","corrections":{},"unlock":null}
اجعلي valid خاصًا بإجابة الخطوة الحالية فقط.`;

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 500 }
        })
      }
    );
    if (!response.ok) throw new Error(`Gemini ${response.status}`);
    const body = await response.json();
    const parsed = JSON.parse(cleanJson(body.candidates?.[0]?.content?.parts?.[0]?.text ?? ''));
    const nextProfile: Profile = { ...profile, ...(parsed.corrections ?? {}) };
    let nextStep = step;
    if (parsed.valid && step <= 4) {
      nextProfile[stepField[step - 1]] = String(parsed.value ?? message).trim();
      nextStep = (step + 1) as Step;
    }
    return {
      reply: String(parsed.reply || 'احچيلي أكثر حتى أفهمك صح.'),
      profile: nextProfile,
      currentStep: nextStep,
      accepted: Boolean(parsed.valid),
      unlock: nextStep === 5 ? 'curriculum' : undefined
    };
  } finally {
    window.clearTimeout(timer);
  }
}
