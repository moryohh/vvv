import http from 'node:http';

const fields = ['name', 'location', 'grade', 'dream'];
const deniedKeys = new Set();
const workingModels = new Map();
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
    const geminiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY2].filter(Boolean);
    const deepSeekKey = process.env.GEMINI_API_KEY3;
    if (!geminiKeys.length && !deepSeekKey) return send(response, 503, { error: 'AI secret is missing' });
    const field = step <= 4 ? fields[step - 1] : 'learning';
    const prompt = `أنتِ أستاذة نورة، معلمة عراقية ذكية ودافئة ومهنية. ردك قصير مثل واتساب وبلهجة عراقية خفيفة، وإيموجي واحد كحد أقصى. لا تذكري قاعدة البيانات أو الذكاء الاصطناعي. لا تكرري نفس الجملة.\nالملخص: ${JSON.stringify(profile)}\nالخطوة: ${step} والحقل المطلوب: ${field}\nآخر المحادثة: ${JSON.stringify(body.messages ?? [])}\nرسالة الطالب: ${JSON.stringify(message)}\nتحققي منطقيًا. ارفضي الضحك والرموز والتهرب ونسيت والأسماء الخيالية. استنتجي المحافظة من الوصف الجغرافي الواضح. إذا صحح معلومة سابقة ضعيها في corrections.\nأعيدي JSON فقط: {"valid":boolean,"value":string|null,"reply":string,"corrections":{}}`;
    let data;
    let lastStatus = 502;
    for (const [index, key] of geminiKeys.entries()) {
      if (deniedKeys.has(index)) continue;
      const keyName = index === 0 ? 'GEMINI_API_KEY' : 'GEMINI_API_KEY2';
      const preferred = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
      let available = workingModels.has(index) ? [workingModels.get(index)] : [];
      if (!available.length) try {
        const listing = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', {
          headers: { 'x-goog-api-key': key },
          signal: AbortSignal.timeout(8000)
        });
        if (listing.ok) {
          available = (await listing.json()).models
            ?.filter(item => item.supportedGenerationMethods?.includes('generateContent'))
            .map(item => item.name?.replace(/^models\//, '')) ?? [];
        }
        console.info('Gemini model listing', { keyName, status: listing.status, flashModels: available.filter(name => name?.includes('flash') && !name.includes('image') && !name.includes('audio')) });
      } catch (error) {
        console.warn('Gemini model listing failed', { keyName, error: error.name });
      }
      const flash = available.filter(name => /^gemini-\d[\w.-]*flash(?:-lite)?$/.test(name) && !name.includes('preview'));
      const candidates = [...new Set([...preferred.filter(name => available.includes(name)), ...flash])].slice(0, 2);
      for (const model of candidates) {
        try {
          const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 500 } }),
            signal: AbortSignal.timeout(12000)
          });
          console.info('Gemini request', { keyName, model, status: aiResponse.status });
          if (aiResponse.ok) { data = await aiResponse.json(); workingModels.set(index, model); break; }
          const failure = await aiResponse.json().catch(() => ({}));
          console.warn('Gemini provider error', {
            keyName, model, code: failure.error?.status,
            message: String(failure.error?.message ?? '').replaceAll(key, '[REDACTED]').slice(0, 300)
          });
          lastStatus = aiResponse.status;
          if (aiResponse.status === 403 && failure.error?.message?.includes('project has been denied access')) { deniedKeys.add(index); break; }
        } catch (error) {
          console.warn('Gemini request failed', { keyName, model, error: error.name });
        }
      }
      if (data) break;
    }
    if (!data && deepSeekKey) {
      const deepSeekResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${deepSeekKey}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.7, max_tokens: 500 })
      });
      lastStatus = deepSeekResponse.status;
      if (deepSeekResponse.ok) {
        const deepSeekData = await deepSeekResponse.json();
        data = { candidates: [{ content: { parts: [{ text: deepSeekData.choices?.[0]?.message?.content ?? '{}' }] } }] };
      }
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
