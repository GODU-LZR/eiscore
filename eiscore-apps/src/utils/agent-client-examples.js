/**
 * Agent API Usage Examples
 * Demonstrates how to interact with the AI Agent Runtime via WebSocket
 */

// ========================================
// Example 1: Basic Flash App Generation
// ========================================

class AgentClient {
  constructor() {
    this.ws = null
    this.connected = false
    this.messageHandlers = new Map()
  }

  connect(token) {
    return new Promise((resolve, reject) => {
      const wsUrl = `ws://${window.location.hostname}:8078/ws`
      this.ws = new WebSocket(wsUrl, ['bearer', token])

      this.ws.onopen = () => {
        this.connected = true
        console.log('✅ Connected to Agent Runtime')
        resolve()
      }

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        reject(error)
      }

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      }

      this.ws.onclose = () => {
        this.connected = false
        console.log('🔌 Disconnected from Agent Runtime')
      }
    })
  }

  handleMessage(data) {
    const handlers = this.messageHandlers.get(data.type) || []
    handlers.forEach(handler => handler(data))
  }

  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, [])
    }
    this.messageHandlers.get(messageType).push(handler)
  }

  send(message) {
    if (!this.connected) {
      throw new Error('Not connected to Agent Runtime')
    }
    this.ws.send(JSON.stringify(message))
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

// ========================================
// Example 2: Generate a Contact Form
// ========================================

async function generateContactForm() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  await agent.connect(token)

  // Listen for status updates
  agent.on('agent:status', (data) => {
    console.log('📡 Status:', data.message)
  })

  // Listen for file changes
  agent.on('agent:file_change', (data) => {
    console.log('📝 File changed:', data.data.path)
  })

  // Listen for task completion
  agent.on('agent:result', (data) => {
    if (data.success) {
      console.log('✅ Task completed successfully')
      console.log('Execution log:', data.executionLog)
    } else {
      console.warn('⚠️ Task did not complete fully')
    }
  })

  // Send task to agent
  agent.send({
    type: 'agent:task',
    prompt: `
      Create a contact form component with the following features:
      - Name field (required)
      - Email field (required, with validation)
      - Phone number field
      - Message textarea
      - Submit button that calls POST /api/contacts
      - Use Element Plus components
      - Add proper form validation
      - Show success/error messages using ElMessage
    `,
    projectPath: 'eiscore-apps'
  })
}

// ========================================
// Example 3: Generate a Data Table View
// ========================================

async function generateDataTableView() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  await agent.connect(token)

  agent.on('agent:result', (data) => {
    console.log('Generated files:', data.executionLog)
    agent.disconnect()
  })

  agent.send({
    type: 'agent:task',
    prompt: `
      Create an employee list view component that:
      - Fetches data from /api/hr.employees
      - Displays in an el-table with columns: name, email, department, status
      - Includes search/filter functionality
      - Has pagination
      - Allows inline editing
      - Uses the existing data grid component pattern if available
    `,
    projectPath: 'eiscore-apps'
  })
}

// ========================================
// Example 4: Execute a Specific Tool
// ========================================

async function executeReadFile() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  await agent.connect(token)

  agent.on('agent:tool_result', (data) => {
    console.log('Tool result:', data.result)
    agent.disconnect()
  })

  agent.send({
    type: 'agent:tool_use',
    toolCall: {
      tool: 'read_file',
      parameters: {
        path: 'src/router/index.js'
      }
    }
  })
}

// ========================================
// Example 5: List Project Directory
// ========================================

async function listProjectFiles() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  await agent.connect(token)

  agent.on('agent:tool_result', (data) => {
    if (data.result.success) {
      console.log('Files:', data.result.files)
    }
    agent.disconnect()
  })

  agent.send({
    type: 'agent:tool_use',
    toolCall: {
      tool: 'list_directory',
      parameters: {
        path: 'src/views'
      }
    }
  })
}

// ========================================
// Example 6: Safe Terminal Command
// ========================================

async function installPackage() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  await agent.connect(token)

  agent.on('agent:terminal_result', (data) => {
    console.log('Command output:', data.result)
    agent.disconnect()
  })

  agent.send({
    type: 'agent:terminal',
    command: 'npm install lodash'
  })
}

// ========================================
// Example 7: Multi-turn Conversation
// ========================================

async function multiTurnTask() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  await agent.connect(token)

  let turn = 0

  agent.on('agent:status', (data) => {
    console.log(`Turn ${++turn}: ${data.message}`)
  })

  agent.on('agent:result', (data) => {
    console.log('Total turns:', data.totalTurns)
    console.log('Execution log:', JSON.stringify(data.executionLog, null, 2))
    agent.disconnect()
  })

  // Complex task requiring multiple steps
  agent.send({
    type: 'agent:task',
    prompt: `
      Create a complete user profile page with:
      1. A UserProfile.vue component in src/views/
      2. Fetch user data from /api/hr.sys_user?id=eq.<user_id>
      3. Display avatar, name, email, department, role
      4. Add an edit mode with form validation
      5. Style with Element Plus components
      6. Add proper error handling and loading states
    `,
    projectPath: 'eiscore-apps'
  })
}

// ========================================
// Example 8: Subscribe to Database Notifications
// ========================================

async function subscribeToDatabaseNotifications() {
  const token = localStorage.getItem('auth_token')
  const ws = new WebSocket('ws://localhost:8078/ws', ['bearer', token])

  ws.onopen = () => {
    // Subscribe to specific channels
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['eis_events', 'app_center_updates']
    }))
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    
    if (data.type === 'db_notify') {
      console.log('Database notification:', {
        channel: data.channel,
        id: data.id,
        timestamp: data.ts
      })
    }
  }
}

// ========================================
// Example 9: Error Handling
// ========================================

async function robustAgentCall() {
  const token = localStorage.getItem('auth_token')
  const agent = new AgentClient()
  
  try {
    await agent.connect(token)

    agent.on('agent:error', (data) => {
      console.error('Agent error:', data.error)
      agent.disconnect()
    })

    agent.on('error', (data) => {
      console.error('General error:', data.message)
      agent.disconnect()
    })

    agent.send({
      type: 'agent:task',
      prompt: 'Create a login page',
      projectPath: 'eiscore-apps'
    })

    // Timeout after 2 minutes
    setTimeout(() => {
      console.warn('Task timeout')
      agent.disconnect()
    }, 120000)

  } catch (error) {
    console.error('Connection failed:', error)
  }
}

// ========================================
// Example 10: Vue Component Integration
// ========================================

// In a Vue component:
export default {
  data() {
    return {
      agent: null,
      connected: false,
      taskRunning: false,
      chatMessages: []
    }
  },
  
  mounted() {
    this.connectAgent()
  },
  
  beforeUnmount() {
    if (this.agent) {
      this.agent.disconnect()
    }
  },
  
  methods: {
    async connectAgent() {
      const token = localStorage.getItem('auth_token')
      this.agent = new AgentClient()
      
      await this.agent.connect(token)
      this.connected = true
      
      this.agent.on('agent:status', (data) => {
        this.chatMessages.push({
          type: 'status',
          content: data.message
        })
      })
      
      this.agent.on('agent:file_change', (data) => {
        this.$message.success(`文件已更新: ${data.data.path}`)
      })
      
      this.agent.on('agent:result', (data) => {
        this.taskRunning = false
        if (data.success) {
          this.$message.success('任务完成')
        }
      })
    },
    
    async sendTask(prompt) {
      if (!this.connected) {
        this.$message.error('未连接到 Agent')
        return
      }
      
      this.taskRunning = true
      this.chatMessages.push({
        type: 'user',
        content: prompt
      })
      
      this.agent.send({
        type: 'agent:task',
        prompt,
        projectPath: 'eiscore-apps'
      })
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentClient }
}
