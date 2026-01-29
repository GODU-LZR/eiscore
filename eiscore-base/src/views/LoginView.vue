<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-left">
        <div class="logo-box">
          <img src="https://element-plus.org/images/element-plus-logo.svg" alt="logo" class="logo-img">
          <span class="logo-text">企业信息化系统</span>
        </div>
        <div class="illustration">
          <img src="https://element-plus.org/images/element-plus-logo.svg" alt="login-bg" style="opacity: 0.5; transform: scale(1.5);">
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

          <el-form ref="loginFormRef" :model="loginForm" :rules="loginRules" class="login-form" size="large">
            <el-form-item prop="username">
              <el-input v-model="loginForm.username" placeholder="用户名" prefix-icon="User" />
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
                <el-link type="primary" underline="never">忘记密码？</el-link>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
                立即登录
              </el-button>
            </el-form-item>
          </el-form>
          
          <div class="footer-links">
            <span>还没有账号？</span>
            <el-link type="primary" underline="never">联系管理员注册</el-link>
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
  username: '', // 默认账号
  password: '',
  remember: false
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// 🟢 辅助函数：解析 JWT Token (无需安装 jwt-decode 库)
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return {}
  }
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      
      try {
        // 1. 调用 PostgREST 登录函数 (public.login)
        const response = await fetch('/api/rpc/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: loginForm.username?.trim(),
            password: loginForm.password?.trim()
          })
        })

        if (!response.ok) {
           // 处理 403/400 错误
           const errData = await response.json().catch(() => ({}))
           throw new Error(errData.message || '登录失败，账号或密码错误')
        }

        const data = await response.json() 
        const realToken = data.token 

        if (!realToken) throw new Error('服务器未返回有效 Token')

        // 🟢 2. 解析 Token 中的真实信息
        const payload = parseJwt(realToken)
        console.log('Token Payload:', payload)

        let roleId = ''
        if (payload.app_role) {
          try {
            const roleRes = await fetch(`/api/roles?code=eq.${payload.app_role}`, {
              method: 'GET',
              headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
            })
            if (roleRes.ok) {
              const roleList = await roleRes.json()
              if (Array.isArray(roleList) && roleList.length > 0) {
                roleId = roleList[0].id
              }
            }
          } catch (e) {
            roleId = ''
          }
        }

        // 🟢 3. 构造用户信息 (使用真实权限)
        const userData = {
          token: realToken,
          user: {
            id: payload.username, // 这里暂时用 username 当 id
            name: payload.username,
            username: payload.username,
            role: payload.app_role || payload.role || 'user',
            role_id: roleId,
            dbRole: payload.role || 'web_user',
            // 关键：从 Token 里拿到数据库定义的 permissions 数组
            permissions: payload.permissions || [], 
            avatar: payload.avatar || 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
          }
        }

        // 4. 存入 Store
        userStore.login(userData)
        
        ElMessage.success(`登录成功！欢迎 ${userData.user.name}`)
        router.push('/')
        
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
