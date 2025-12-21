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
import axios from 'axios'

const router = useRouter()
const loading = ref(false)
const loginFormRef = ref(null)

const loginForm = reactive({
  username: '', // 建议默认空，或者写 'admin' 方便调试
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
        // 模拟登录请求 (后面我们会接真实的后端 /rpc/login)
        // const res = await axios.post('/rpc/login', { ... })
        
        // 👇 暂时模拟成功
        setTimeout(() => {
          localStorage.setItem('auth_token', 'mock_token_123456')
          localStorage.setItem('user_info', JSON.stringify({ name: loginForm.username }))
          
          ElMessage.success('登录成功，欢迎回来！')
          router.push('/') // 跳转到首页
          
          loading.value = false
        }, 1000)
        
      } catch (error) {
        ElMessage.error('登录失败，请检查账号密码')
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
  /* 背景图纹理 */
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
    position: relative;
    
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
      
      .flex-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
      }
      
      .footer-links {
        margin-top: 20px;
        text-align: center;
        font-size: 14px;
        color: #606266;
      }
    }
  }
}

/* 移动端适配 */
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