// Test streaming for tool-using question
const jwt = require('jsonwebtoken');

const secret = process.env.PGRST_JWT_SECRET || 'my_super_secret_key_for_eiscore_system_2025';
const token = jwt.sign({ role: 'web_user', app_role: 'super_admin', username: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);

async function run() {
  const base = 'http://localhost:8078';
  const start = Date.now();
  const log = (msg) => console.log(`[${Date.now() - start}ms] ${msg}`);

  log('Sending chat with tool-using question...');
  const res = await fetch(`${base}/twin/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '查一下我的个人信息', session_id: '' })
  });

  log(`Response status: ${res.status}, content-type: ${res.headers.get('content-type')}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let totalText = '';
  let chunkCount = 0;

  const timeout = setTimeout(() => {
    log('TIMEOUT - 45s reached, cancelling reader');
    reader.cancel();
  }, 45000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { log('Stream ended (done=true)'); break; }
      const raw = decoder.decode(value, { stream: true });
      const lines = raw.split('\n').filter(l => l.startsWith('data:'));
      for (const line of lines) {
        const json = line.replace('data:', '').trim();
        if (json === '[DONE]') { log('Got [DONE]'); continue; }
        if (!json) continue;
        try {
          const parsed = JSON.parse(json);
          if (parsed.type) {
            log(`EVENT: ${parsed.type} ${parsed.tool || parsed.message || parsed.session_id || ''}`);
          }
          if (parsed.choices?.[0]?.delta?.content) {
            chunkCount++;
            const delta = parsed.choices[0].delta.content;
            totalText += delta;
            if (chunkCount <= 5 || chunkCount % 10 === 0) {
              log(`CHUNK #${chunkCount}: "${delta.slice(0, 50)}${delta.length > 50 ? '...' : ''}"`);
            }
          }
        } catch {}
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  log(`Total chunks: ${chunkCount}, text length: ${totalText.length}`);
  log(`Preview: ${totalText.slice(0, 200)}`);
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
