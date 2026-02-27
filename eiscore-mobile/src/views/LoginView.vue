<template>
  <div class="mobile-login">
    <!-- 顶部装饰区 -->
    <div class="login-header">
      <div class="header-bg"></div>
      <div class="header-content">
        <div class="logo-circle">
          <van-icon name="apps-o" size="36" color="#fff" />
        </div>
        <h1 class="app-title">企业信息化系统</h1>
        <p class="app-subtitle">移动工作平台</p>
      </div>
    </div>

    <!-- 登录表单 -->
    <div class="login-card">
      <van-form @submit="handleLogin" ref="formRef">
        <van-cell-group inset>
          <van-field
            v-model="form.username"
            name="username"
            label="账号"
            placeholder="请输入用户名"
            left-icon="manager-o"
            :rules="[{ required: true, message: '请输入用户名' }]"
            autocomplete="username"
          />
          <van-field
            v-model="form.password"
            name="password"
            label="密码"
            placeholder="请输入密码"
            left-icon="lock"
            :type="showPassword ? 'text' : 'password'"
            :right-icon="showPassword ? 'eye-o' : 'closed-eye'"
            @click-right-icon="showPassword = !showPassword"
            :rules="[{ required: true, message: '请输入密码' }]"
            autocomplete="current-password"
          />
        </van-cell-group>

        <div class="form-actions">
          <van-checkbox v-model="form.remember" shape="square" icon-size="16px">
            记住登录
          </van-checkbox>
        </div>

        <div class="submit-area">
          <van-button
            round
            block
            type="primary"
            native-type="submit"
            :loading="loading"
            loading-text="登录中..."
            size="large"
          >
            登 录
          </van-button>
        </div>
      </van-form>

      <!-- 切换到桌面版 -->
      <div class="switch-desktop" @click="goDesktop">
        <van-icon name="desktop-o" />
        <span>切换到桌面版</span>
      </div>
    </div>

    <!-- 底部版权 -->
    <div class="login-footer">
      <p>© {{ new Date().getFullYear() }} EISCore · 企业数字化引擎</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showFailToast } from 'vant'
import { setAuth, parseJwt, isAuthenticated } from '@/utils/auth'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const showPassword = ref(false)

const form = reactive({
  username: '',
  password: '',
  remember: false
})

onMounted(() => {
  // 已登录时直接跳首页
  if (isAuthenticated()) {
    const redirect = route.query.redirect || '/'
    router.replace(redirect)
  }

  // 恢复记住的用户名
  const saved = localStorage.getItem('mobile_remembered_user')
  if (saved) {
    form.username = saved
    form.remember = true
  }
})

async function handleLogin() {
  loading.value = true
  try {
    const res = await fetch('/api/rpc/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: form.username.trim(),
        password: form.password.trim()
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || '账号或密码错误')
    }

    const data = await res.json()
    const token = data.token
    if (!token) throw new Error('服务器未返回有效凭证')

    // 解析 JWT 获取用户信息
    const payload = parseJwt(token)

    // 尝试获取用户详细信息
    let userInfo = {
      username: payload?.username || form.username,
      full_name: '',
      avatar: '',
      role: payload?.app_role || '',
      permissions: []
    }

    try {
      const userRes = await fetch(`/api/v_users_manage?username=eq.${payload.username}&select=username,full_name,avatar,role_id`, {
        headers: {
          'Accept-Profile': 'public',
          'Content-Profile': 'public',
          'Authorization': `Bearer ${token}`
        }
      })
      if (userRes.ok) {
        const list = await userRes.json()
        if (Array.isArray(list) && list.length > 0) {
          userInfo = { ...userInfo, ...list[0] }
        }
      }
    } catch {
      // 用户详情获取失败不影响登录
    }

    // 保存鉴权信息（与基座格式一致）
    setAuth(token, userInfo)

    // 记住用户名
    if (form.remember) {
      localStorage.setItem('mobile_remembered_user', form.username)
    } else {
      localStorage.removeItem('mobile_remembered_user')
    }

    showToast({ message: '登录成功', type: 'success', duration: 1000 })

    // 跳转
    const redirect = route.query.redirect || '/'
    setTimeout(() => router.replace(redirect), 500)
  } catch (e) {
    showFailToast(e.message || '登录失败')
  } finally {
    loading.value = false
  }
}

function goDesktop() {
  window.location.href = '/'
}
</script>

<style scoped>
.mobile-login {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--eis-bg);
}

/* 顶部装饰 */
.login-header {
  position: relative;
  height: 260px;
  overflow: hidden;
  flex-shrink: 0;
}

.header-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #1677ff 0%, #0958d9 50%, #003eb3 100%);
  border-radius: 0 0 40% 40% / 0 0 60px 60px;
}

.header-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding-top: 20px;
}

.logo-circle {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.app-title {
  color: #fff;
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 1px;
}

.app-subtitle {
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  margin-top: 6px;
}

/* 登录卡片 */
.login-card {
  flex: 1;
  margin: -30px 16px 0;
  background: var(--eis-card-bg);
  border-radius: 16px;
  padding: 32px 8px 24px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 2;
}

.form-actions {
  padding: 12px 24px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.submit-area {
  padding: 24px 16px 16px;
}

.switch-desktop {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--eis-text-secondary);
  font-size: 13px;
  padding: 12px;
  cursor: pointer;
}

.switch-desktop:active {
  opacity: 0.6;
}

/* 底部 */
.login-footer {
  padding: 24px 16px env(safe-area-inset-bottom);
  text-align: center;
}

.login-footer p {
  color: var(--eis-text-secondary);
  font-size: 12px;
  margin: 0;
}
</style>
