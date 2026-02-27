const jwt = require('jsonwebtoken');
const http = require('http');

const token = jwt.sign(
  { username: 'admin', role: 'web_user', app_role: 'super_admin' },
  'my_super_secret_key_for_eiscore_system_2025',
  { expiresIn: '1h' }
);

// Test 1: Sessions
function testEndpoint(method, path, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8078,
      path,
      method: method || 'GET',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // 1. Sessions
  const s = await testEndpoint('GET', '/twin/sessions');
  console.log('[sessions]', s.status, s.data.slice(0, 200));

  // 2. Knowledge list
  const k = await testEndpoint('GET', '/twin/knowledge');
  console.log('[knowledge]', k.status, k.data.slice(0, 200));

  // 3. Knowledge upload
  const u = await testEndpoint('POST', '/twin/knowledge/upload', {
    fileName: 'test_note.txt',
    fileType: 'text/plain',
    fileSize: 42,
    contentText: '这是一份测试知识库文件，包含一些工作笔记。',
    tags: ['测试', '笔记']
  });
  console.log('[upload]', u.status, u.data.slice(0, 200));

  // 4. Knowledge list again
  const k2 = await testEndpoint('GET', '/twin/knowledge');
  console.log('[knowledge-after]', k2.status, k2.data.slice(0, 300));

  // 5. Chat (SSE test - read first 500 bytes)
  console.log('[chat] starting...');
  const chatRes = await new Promise((resolve, reject) => {
    const body = JSON.stringify({ message: '你好，我是谁？' });
    const req = http.request({
      hostname: 'localhost', port: 8078, path: '/twin/chat',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: 60000
    }, (res) => {
      let data = '';
      const timer = setTimeout(() => {
        req.destroy();
        resolve({ status: res.statusCode, data });
      }, 30000);
      res.on('data', (chunk) => {
        data += chunk;
        if (data.length > 2000) {
          clearTimeout(timer);
          req.destroy();
          resolve({ status: res.statusCode, data: data.slice(0, 2000) });
        }
      });
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('error', (e) => resolve({ status: 0, data: 'Error: ' + e.message }));
    req.write(body);
    req.end();
  });
  console.log('[chat]', chatRes.status, chatRes.data.slice(0, 1000));
}

main().catch(console.error);
