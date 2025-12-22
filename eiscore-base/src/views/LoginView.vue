<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-left">
        <div class="logo-box">
          <img src="https://element-plus.org/images/element-plus-logo.svg" alt="logo" class="logo-img">
          <span class="logo-text">企业信息化系统</span>
        </div>
        <div class="illustration">
          <img src="https://cdni.iconscout.com/illustration/premium/thumb/warehouse-management-illustration-download-in-svg-png-gif-file-formats--inventory-logistics-distribution-delivery-pack-business-illustrations-4440618.png" alt="login-bg">
        </div>
        <div class="tips">
          <h2>构建高效的企业数字化引擎</h2>
          <p>微前端架构 · 统一身份认证 · 极致用户体验</p>
        </div>
      </div>

      <div class="login-right">
        <div class="form-wrapper">
          <h2 class="welcome-title">欢迎登录</h2>
          <p class="welcome-subtitle">请输入您的账号密码访问系统</p>

          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            class="login-form"
            size="large"
          >
            <el-form-item prop="username">
              <el-input 
                v-model="loginForm.username" 
                placeholder="用户名 / 手机号" 
                prefix-icon="User"
              />
            </el-form-item>
            
            <el-form-item prop="password">
              <el-input 
                v-model="loginForm.password" 
                type="password" 
                placeholder="密码" 
                prefix-icon="Lock" 
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <el-form-item>
              <div class="flex-row">
                <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
                <el-link type="primary" :underline="false">忘记密码？</el-link>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button 
                type="primary" 
                class="login-btn" 
                :loading="loading" 
                @click="handleLogin"
              >
                立即登录
              </el-button>
            </el-form-item>
          </el-form>
          
          <div class="footer-links">
            <span>还没有账号？</span>
            <el-link type="primary" :underline="false">联系管理员注册</el-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const loginFormRef = ref(null)

const loginForm = reactive({
  username: 'zhangsan', // 默认填个能用的账号
  password: '',
  remember: false
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      
      try {
        // 🟢 1. 发送真实请求给 PostgREST 登录接口
        // /api/rpc/login 会被 Vite 代理转发到后端
        const response = await fetch('/api/rpc/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 告诉后端返回单个 JSON 对象，而不是数组
            'Prefer': 'params=single-object' 
          },
          body: JSON.stringify({
            username: loginForm.username,
            password: loginForm.password
          })
        })

        // 处理 HTTP 错误 (比如 400, 403, 500)
        if (!response.ok) {
           const errData = await response.json().catch(() => ({}))
           throw new Error(errData.message || '登录失败，账号或密码错误')
        }

        // 🟢 2. 获取真实的 Token
        const data = await response.json() 
        // PostgREST 返回格式: { "token": "eyJ..." }
        const realToken = data.token 

        if (!realToken) {
          throw new Error('服务器未返回有效 Token')
        }

        // 🟢 3. 构造 Store 需要的用户信息
        // (在真实项目中，这里通常会用 Token 再去调一次 /me 接口获取详情，
        // 这里为了简单，我们直接用前端填的用户名，权限先写死)
        const userData = {
          token: realToken, // ✅ 这里必须是刚才获取的真实 Token
          user: {
            id: 1, // 暂时写死
            name: loginForm.username, 
            role: 'admin', 
            avatar: 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png',
            permissions: ['hr:employee:edit', 'material:stock:view'] 
          }
        }

        // 🟢 4. 存入 Store (持久化到 localStorage)
        userStore.login(userData)
        
        ElMessage.success(`登录成功！`)
        router.push('/') // 跳转到首页
        
      } catch (error) {
        console.error(error)
        ElMessage.error(error.message || '登录出现异常')
      } finally {
        loading.value = false
      }
    }
  })
}
</script>

<style scoped lang="scss">
.login-container {
  height: 100vh;
  width: 100vw;
  background-color: #f0f2f5;
  display: flex;
  justify-content: center;
  align-items: center;
  background-image: radial-gradient(#e1e6eb 1px, transparent 1px);
  background-size: 20px 20px;
}

.login-box {
  width: 1000px;
  height: 600px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  display: flex;
  overflow: hidden;
  
  .login-left {
    width: 50%;
    background: linear-gradient(135deg, #001529 0%, #003a70 100%);
    padding: 40px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    color: white;
    
    .logo-box {
      display: flex;
      align-items: center;
      gap: 10px;
      .logo-img { height: 32px; filter: brightness(100); }
      .logo-text { font-size: 20px; font-weight: bold; }
    }
    
    .illustration {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      img { width: 80%; max-width: 350px; opacity: 0.9; }
    }
    
    .tips {
      h2 { font-size: 24px; margin-bottom: 10px; }
      p { opacity: 0.7; font-size: 14px; }
    }
  }

  .login-right {
    width: 50%;
    padding: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .form-wrapper {
      width: 100%;
      max-width: 360px;
      
      .welcome-title { font-size: 28px; font-weight: bold; color: #303133; margin-bottom: 10px; }
      .welcome-subtitle { color: #909399; margin-bottom: 30px; font-size: 14px; }
      .login-btn { width: 100%; font-weight: bold; padding: 20px 0; font-size: 16px; }
      .flex-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
      .footer-links { margin-top: 20px; text-align: center; font-size: 14px; color: #606266; }
    }
  }
}

@media (max-width: 768px) {
  .login-box {
    width: 90%;
    height: auto;
    flex-direction: column;
    .login-left { display: none; }
    .login-right { width: 100%; padding: 30px 20px; }
  }
}
</style>