// Test streaming for digital twin chat
const jwt = require('jsonwebtoken');

const secret = process.env.PGRST_JWT_SECRET || 'my_super_secret_key_for_eiscore_system_2025';
const token = jwt.sign({ role: 'web_user', app_role: 'super_admin', username: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);

async function run() {
  const base = 'http://localhost:8078';

  console.log('--- STREAMING TEST: Simple question (no tools) ---');
  const start1 = Date.now();
  let chunkCount1 = 0;
  let firstChunkAt1 = 0;
  const res1 = await fetch(`${base}/twin/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '你好', session_id: '' })
  });

  const reader1 = res1.body.getReader();
  const decoder = new TextDecoder();
  let totalText1 = '';

  while (true) {
    const { done, value } = await reader1.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n').filter(l => l.startsWith('data:'));
    for (const line of lines) {
      const json = line.replace('data:', '').trim();
      if (!json || json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        if (parsed.choices?.[0]?.delta?.content) {
          chunkCount1++;
          if (!firstChunkAt1) firstChunkAt1 = Date.now() - start1;
          totalText1 += parsed.choices[0].delta.content;
        }
      } catch {}
    }
  }
  const elapsed1 = Date.now() - start1;
  console.log(`  Total time: ${elapsed1}ms`);
  console.log(`  First chunk at: ${firstChunkAt1}ms`);
  console.log(`  Chunks: ${chunkCount1}`);
  console.log(`  Text length: ${totalText1.length}`);
  console.log(`  Preview: ${totalText1.slice(0, 100)}...`);

  console.log('\n--- STREAMING TEST: Tool-using question ---');
  const start2 = Date.now();
  let chunkCount2 = 0;
  let firstContentAt2 = 0;
  let toolEvents = [];
  const res2 = await fetch(`${base}/twin/chat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '查一下我的个人信息', session_id: '' })
  });

  const reader2 = res2.body.getReader();
  let totalText2 = '';

  while (true) {
    const { done, value } = await reader2.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n').filter(l => l.startsWith('data:'));
    for (const line of lines) {
      const json = line.replace('data:', '').trim();
      if (!json || json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        if (parsed.type === 'tool_start' || parsed.type === 'tool_done') {
          toolEvents.push(`${parsed.type}:${parsed.tool}@${Date.now() - start2}ms`);
        }
        if (parsed.choices?.[0]?.delta?.content) {
          chunkCount2++;
          if (!firstContentAt2) firstContentAt2 = Date.now() - start2;
          totalText2 += parsed.choices[0].delta.content;
        }
      } catch {}
    }
  }
  const elapsed2 = Date.now() - start2;
  console.log(`  Total time: ${elapsed2}ms`);
  console.log(`  First content chunk at: ${firstContentAt2}ms`);
  console.log(`  Content chunks: ${chunkCount2}`);
  console.log(`  Text length: ${totalText2.length}`);
  console.log(`  Tool events: ${toolEvents.join(' → ')}`);
  console.log(`  Preview: ${totalText2.slice(0, 100)}...`);

  console.log('\n=== ALL STREAMING TESTS COMPLETE ===');
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
