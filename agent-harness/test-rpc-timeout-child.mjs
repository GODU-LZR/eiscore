import process from 'node:process'

process.stdin.setEncoding('utf8')
let buffer = ''
let prompts = 0

const write = (frame) => process.stdout.write(`${JSON.stringify(frame)}\n`)

process.stdin.on('data', (chunk) => {
  buffer += chunk
  let index
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index)
    buffer = buffer.slice(index + 1)
    if (!line.trim()) continue
    const frame = JSON.parse(line)
    if (frame.method === 'initialize') {
      write({ jsonrpc: '2.0', id: frame.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: '0.0.1' } } })
      continue
    }
    if (frame.method === 'session/prompt') {
      prompts += 1
      const sessionId = frame.params.sessionId
      if (prompts === 1) {
        setTimeout(() => write({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'idle' } }), 450)
        continue
      }
      write({ jsonrpc: '2.0', id: frame.id, result: { messageId: 'after-rpc-timeout' } })
      write({ jsonrpc: '2.0', method: 'session.event', params: { sessionId, event: { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'ok-after-rpc-timeout' }] } } } } })
      write({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'idle' } })
      continue
    }
    if (frame.method === 'shutdown') write({ jsonrpc: '2.0', id: frame.id, result: {} })
  }
})
