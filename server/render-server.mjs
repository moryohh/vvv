import http from 'node:http';

const fields = ['name', 'location', 'grade', 'dream'];
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': 'https://moryohh.github.io',
  'access-control-allow-headers': 'content-type,x-student-id',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};
const send = (response, status, value) => {
  response.writeHead(status, headers);
  response.end(JSON.stringify(value));
};
const readBody = request => new Promise((resolve, reject) => {
  let body = '';
  request.on('data', chunk => {
    body += chunk;
    if (body.length > 100_000) request.destroy();
  });
  request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch (error) { reject(error); } });
  request.on('error', reject);
});

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return send(response, 204, {});
  const url = new URL(request.url, 'http://localhost');
  if (request.method === 'GET' && url.pathname === '/health') return send(response, 200, { status: 'ok', service: 'saif-qalam-teacher' });
  if (request.method !== 'POST' || url.pathname !== '/api/chat') return send(response, 404, { error: 'Not found' });
  try {
    const body = await readBody(request);
    const message = body.message?.trim();
    const profile = body.profile ?? {};
    const step = Math.min(5, Math.max(1, Number(body.step) || 1));
    if (!message || message.length > 1000) return send(response, 400, { error: 'Invalid message' });
    const geminiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2, process.env.GEMINI_API_KEY3].filter(Boolean);
    if (!geminiKeys.length) return send(response, 503, { error: 'Gemini secret is missing' });
    const field = step <= 4 ? fields[step - 1] : 'learning';
    const prompt = `أنتِ أستاذة نورة، معلمة عراقية ذكية ودافئة ومهنية. ردك قصير مثل واتساب وبلهجة عراقية خفيفة، وإيموجي واحد كحد أقصى. لا تذكري قاعدة البيانات أو الذكاء الاصطناعي. لا تكرري نفس الجملة.\nالملخص: ${JSON.stringify(profile)}\nالخطوة: ${step} والحقل المطلوب: ${field}\nآخر المحادثة: ${JSON.stringify(body.messages ?? [])}\nرسالة الطالب: ${JSON.stringify(message)}\nتحققي منطقيًا. ارفضي الضحك والرموز والتهرب ونسيت والأسماء الخيالية. استنتجي المحافظة من الوصف الجغرافي الواضح. إذا صحح معلومة سابقة ضعيها في corrections.\nأعيدي JSON فقط: {"valid":boolean,"value":string|null,"reply":string,"corrections":{}}`;
    let data;
    let lastStatus = 502;
    for (const key of geminiKeys) {
      const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 500 } })
      });
      if (aiResponse.ok) { data = await aiResponse.json(); break; }
      lastStatus = aiResponse.status;
    }
    if (!data) return send(response, 502, { error: 'Gemini unavailable', status: lastStatus });
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
    const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/, ''));
    const nextProfile = { ...profile, ...(parsed.corrections ?? {}) };
    let nextStep = step;
    if (parsed.valid && step <= 4) {
      nextProfile[fields[step - 1]] = String(parsed.value ?? message).trim();
      nextStep += 1;
    }
    return send(response, 200, { reply: parsed.reply, profile: nextProfile, currentStep: nextStep, accepted: Boolean(parsed.valid), ...(nextStep === 5 ? { unlock: 'curriculum' } : {}) });
  } catch (error) {
    console.error(error);
    return send(response, 500, { error: 'Unexpected server error' });
  }
});

server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => console.log('Saif & Qalam AI server is ready'));
