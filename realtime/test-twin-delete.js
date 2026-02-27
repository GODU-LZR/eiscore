// Quick test for twin session delete
const jwt = require('jsonwebtoken');

const secret = process.env.PGRST_JWT_SECRET || 'my_super_secret_key_for_eiscore_system_2025';
const token = jwt.sign({ role: 'web_user', app_role: 'super_admin', username: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, secret);

async function run() {
  const base = 'http://localhost:8078';

  // 1. List sessions
  console.log('--- 1. LIST SESSIONS ---');
  const listRes = await fetch(`${base}/twin/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  const listBody = await listRes.json();
  console.log(`Status: ${listRes.status}, Count: ${(listBody.sessions || []).length}`);
  if (!listBody.sessions || listBody.sessions.length === 0) {
    console.log('No sessions to delete. Creating a test session via chat...');
    // Create one by sending a chat message
    const chatRes = await fetch(`${base}/twin/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '你好', session_id: '' })
    });
    // Read SSE stream briefly
    const reader = chatRes.body.getReader();
    const decoder = new TextDecoder();
    let sessionId = null;
    const start = Date.now();
    while (Date.now() - start < 15000) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const m = text.match(/"session_id"\s*:\s*"([^"]+)"/);
      if (m) { sessionId = m[1]; console.log('Got session_id:', sessionId); }
    }
    try { reader.cancel(); } catch {}
    if (!sessionId) { console.log('Failed to create session'); return; }

    // Now list again
    const listRes2 = await fetch(`${base}/twin/sessions`, { headers: { Authorization: `Bearer ${token}` } });
    const listBody2 = await listRes2.json();
    console.log(`After chat - Sessions: ${(listBody2.sessions || []).length}`);
    listBody.sessions = listBody2.sessions;
  }

  // 2. Delete the first session
  const targetId = listBody.sessions[0]?.id;
  if (!targetId) { console.log('No session ID found'); return; }
  console.log(`\n--- 2. DELETE SESSION ${targetId} ---`);
  const delRes = await fetch(`${base}/twin/sessions?id=${targetId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const delBody = await delRes.text();
  console.log(`Status: ${delRes.status}, Body: ${delBody}`);

  // 3. List sessions after delete
  console.log('\n--- 3. LIST SESSIONS AFTER DELETE ---');
  const listRes3 = await fetch(`${base}/twin/sessions`, { headers: { Authorization: `Bearer ${token}` } });
  const listBody3 = await listRes3.json();
  console.log(`Status: ${listRes3.status}, Count: ${(listBody3.sessions || []).length}`);

  // 4. Load messages for a session (if any remain)
  if (listBody3.sessions && listBody3.sessions.length > 0) {
    const sid = listBody3.sessions[0].id;
    console.log(`\n--- 4. LOAD MESSAGES for ${sid} ---`);
    const msgRes = await fetch(`${base}/twin/messages?session_id=${sid}`, { headers: { Authorization: `Bearer ${token}` } });
    const msgBody = await msgRes.json();
    console.log(`Status: ${msgRes.status}, Messages: ${(msgBody.messages || []).length}`);
  }

  // 5. Knowledge list
  console.log('\n--- 5. KNOWLEDGE LIST ---');
  const kRes = await fetch(`${base}/twin/knowledge`, { headers: { Authorization: `Bearer ${token}` } });
  const kBody = await kRes.json();
  console.log(`Status: ${kRes.status}, Files: ${(kBody.files || []).length}`);

  // 6. Knowledge upload
  console.log('\n--- 6. KNOWLEDGE UPLOAD ---');
  const upRes = await fetch(`${base}/twin/knowledge/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileName: 'test-note.txt',
      fileType: 'text/plain',
      fileSize: 42,
      contentText: 'This is a test knowledge file for twin.',
      tags: ['test'],
      summary: 'Test file'
    })
  });
  const upBody = await upRes.json();
  console.log(`Status: ${upRes.status}, Body:`, JSON.stringify(upBody).slice(0, 200));

  // 7. Knowledge list again
  console.log('\n--- 7. KNOWLEDGE LIST AFTER UPLOAD ---');
  const kRes2 = await fetch(`${base}/twin/knowledge`, { headers: { Authorization: `Bearer ${token}` } });
  const kBody2 = await kRes2.json();
  console.log(`Status: ${kRes2.status}, Files: ${(kBody2.files || []).length}`);

  // 8. Knowledge delete (if we uploaded one)
  if (kBody2.files && kBody2.files.length > 0) {
    const fid = kBody2.files[kBody2.files.length - 1].id;
    console.log(`\n--- 8. KNOWLEDGE DELETE ${fid} ---`);
    const kdRes = await fetch(`${base}/twin/knowledge?id=${fid}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    const kdBody = await kdRes.text();
    console.log(`Status: ${kdRes.status}, Body: ${kdBody}`);
  }

  console.log('\n=== ALL TESTS COMPLETE ===');
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
