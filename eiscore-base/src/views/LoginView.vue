<template>
  <div class="login-page" :style="pageStyle">
    <div class="bg-mask" />
    <div class="login-shell">
      <section class="brand-panel">
        <header class="brand-header">
          <p class="brand-tag">Enterprise Portal</p>
          <h1>{{ branding.companyName || systemStore.config?.title || '企业信息化系统' }}</h1>
          <p class="brand-slogan">{{ branding.slogan }}</p>
        </header>

        <p class="brand-intro">{{ branding.description }}</p>

        <el-carousel
          v-if="carouselItems.length"
          class="brand-carousel"
          indicator-position="outside"
          height="220px"
          :interval="4500"
          arrow="hover"
        >
          <el-carousel-item v-for="(item, index) in carouselItems" :key="`carousel-${index}`">
            <div class="carousel-card">
              <img :src="item.url" alt="企业轮播图" class="carousel-image" />
              <div class="carousel-overlay">
                <h3 v-if="item.title">{{ item.title }}</h3>
                <p v-if="item.subtitle">{{ item.subtitle }}</p>
              </div>
            </div>
          </el-carousel-item>
        </el-carousel>
        <div v-else class="brand-placeholder">
          <p>在系统设置中可配置企业轮播图、领导介绍和背景图片</p>
        </div>

        <div v-if="leaderItems.length" class="leader-grid">
          <article v-for="(leader, index) in leaderItems" :key="`leader-${index}`" class="leader-card">
            <el-avatar :size="46" :src="leader.avatar || ''">
              {{ (leader.name || '').slice(0, 1) }}
            </el-avatar>
            <div>
              <h4>{{ leader.name }}</h4>
              <p class="leader-title">{{ leader.title }}</p>
              <p class="leader-intro">{{ leader.intro }}</p>
            </div>
          </article>
        </div>
      </section>

      <section class="auth-panel">
        <div class="auth-card">
          <h2>欢迎登录</h2>
          <p class="auth-subtitle">请输入账号和密码</p>

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
              <div class="form-meta">
                <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
                <el-link type="primary" underline="never">忘记密码？</el-link>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
                登录系统
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useSystemStore } from '@/stores/system'
import { mix } from '@/utils/theme'

const router = useRouter()
const userStore = useUserStore()
const systemStore = useSystemStore()
const loading = ref(false)
const loginFormRef = ref(null)

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const safeThemeColor = computed(() => {
  const color = String(systemStore.config?.themeColor || '#409EFF').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#409EFF'
})

const branding = computed(() => {
  const source = systemStore.config?.loginBranding || {}
  return {
    companyName: String(source.companyName || ''),
    slogan: String(source.slogan || '让企业管理更高效、更透明、更智能'),
    description: String(source.description || '面向制造与供应链场景，提供从人事、物料、流程到应用构建的一体化协同能力。'),
    backgroundImage: String(source.backgroundImage || ''),
    carouselImages: Array.isArray(source.carouselImages) ? source.carouselImages : [],
    leaders: Array.isArray(source.leaders) ? source.leaders : []
  }
})

const carouselItems = computed(() => branding.value.carouselImages
  .map((item) => ({
    url: String(item?.url || '').trim(),
    title: String(item?.title || '').trim(),
    subtitle: String(item?.subtitle || '').trim()
  }))
  .filter((item) => item.url))

const leaderItems = computed(() => branding.value.leaders
  .map((item) => ({
    name: String(item?.name || '').trim(),
    title: String(item?.title || '').trim(),
    intro: String(item?.intro || '').trim(),
    avatar: String(item?.avatar || '').trim()
  }))
  .filter((item) => item.name)
  .slice(0, 3))

const pageStyle = computed(() => {
  const theme = safeThemeColor.value
  const tintDark = mix(theme, '#0a1226', 0.74)
  const tintLight = mix(theme, '#ffffff', 0.2)
  const background = branding.value.backgroundImage
    ? `linear-gradient(120deg, ${tintDark}D9, ${theme}B8), url(${branding.value.backgroundImage})`
    : `radial-gradient(circle at 18% 18%, ${mix(theme, '#ffffff', 0.3)}88 0, transparent 32%),
       radial-gradient(circle at 80% 30%, ${mix(theme, '#0f172a', 0.5)}66 0, transparent 40%),
       linear-gradient(125deg, ${tintDark}, ${mix(theme, '#0f172a', 0.55)})`

  return {
    '--login-theme': theme,
    '--login-theme-light': tintLight,
    backgroundImage: background
  }
})

onMounted(async () => {
  await systemStore.loadConfig()
  systemStore.initTheme()
})

function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map((char) => (
      '%' + ('00' + char.charCodeAt(0).toString(16)).slice(-2)
    )).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    return {}
  }
}

const handleLogin = async () => {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true

    try {
      const response = await fetch('/api/rpc/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginForm.username?.trim(),
          password: loginForm.password?.trim()
        })
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || '登录失败，账号或密码错误')
      }

      const data = await response.json()
      const realToken = data.token
      if (!realToken) throw new Error('服务器未返回有效 Token')

      const payload = parseJwt(realToken)
      let roleId = ''
      let avatarUrl = ''

      if (payload.app_role) {
        try {
          const roleRes = await fetch(`/api/roles?code=eq.${payload.app_role}`, {
            method: 'GET',
            headers: {
              'Accept-Profile': 'public',
              'Content-Profile': 'public',
              Authorization: `Bearer ${realToken}`
            }
          })
          if (roleRes.ok) {
            const roleList = await roleRes.json()
            if (Array.isArray(roleList) && roleList.length > 0) roleId = roleList[0].id
          }
        } catch (e) {}
      }

      const resolveAvatarUrl = async (avatar, token) => {
        if (!avatar || typeof avatar !== 'string') return ''
        if (!avatar.startsWith('file:')) return avatar
        const fileId = avatar.replace('file:', '')
        try {
          const fileRes = await fetch(`/api/files?id=eq.${fileId}&select=content_base64,mime_type`, {
            headers: {
              'Accept-Profile': 'public',
              Authorization: `Bearer ${token}`
            }
          })
          if (!fileRes.ok) return ''
          const fileList = await fileRes.json()
          const row = Array.isArray(fileList) ? fileList[0] : null
          if (!row?.content_base64) return ''
          const mime = row.mime_type || 'application/octet-stream'
          return `data:${mime};base64,${row.content_base64}`
        } catch (e) {
          return ''
        }
      }

      try {
        const userRes = await fetch(`/api/v_users_manage?username=eq.${payload.username}&select=username,full_name,avatar,role_id`, {
          method: 'GET',
          headers: {
            'Accept-Profile': 'public',
            'Content-Profile': 'public',
            Authorization: `Bearer ${realToken}`
          }
        })

        if (userRes.ok) {
          let userList = await userRes.json()
          let row = Array.isArray(userList) ? userList[0] : null
          if (!row) {
            const fallback = await fetch(`/api/users?username=eq.${payload.username}&select=username,full_name,avatar,role`, {
              method: 'GET',
              headers: {
                'Accept-Profile': 'public',
                'Content-Profile': 'public',
                Authorization: `Bearer ${realToken}`
              }
            })
            if (fallback.ok) {
              const fallbackList = await fallback.json()
              row = Array.isArray(fallbackList) ? fallbackList[0] : null
            }
          }
          if (row) {
            avatarUrl = await resolveAvatarUrl(row.avatar || '', realToken)
            if (!roleId && row.role_id) roleId = row.role_id
          }
        }
      } catch (e) {}

      const userData = {
        token: realToken,
        user: {
          id: payload.username,
          name: payload.username,
          username: payload.username,
          role: payload.app_role || payload.role || 'user',
          role_id: roleId,
          dbRole: payload.role || 'web_user',
          permissions: payload.permissions || [],
          avatar: avatarUrl || payload.avatar || 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
        }
      }

      userStore.login(userData)
      ElMessage.success(`登录成功，欢迎 ${userData.user.name}`)
      router.push('/')
    } catch (error) {
      ElMessage.error(error.message || '登录出现异常')
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped lang="scss">
.login-page {
  position: relative;
  min-height: 100vh;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  overflow: hidden;
}

.bg-mask {
  position: absolute;
  inset: 0;
  background: linear-gradient(140deg, rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.36));
  backdrop-filter: blur(1px);
}

.login-shell {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(560px, 1fr) 420px;
  gap: 24px;
  padding: 28px clamp(24px, 3.2vw, 52px);
}

.brand-panel {
  color: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px 8px 12px;
}

.brand-tag {
  width: fit-content;
  padding: 6px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--login-theme) 40%, #ffffff);
  color: #0f172a;
  font-weight: 700;
  font-size: 12px;
  margin: 0 0 10px;
}

.brand-header h1 {
  margin: 0;
  font-size: clamp(32px, 4.5vw, 48px);
  font-weight: 800;
  letter-spacing: 0.4px;
}

.brand-slogan {
  margin: 10px 0 0;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.86);
}

.brand-intro {
  margin: 0;
  max-width: 860px;
  font-size: 15px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.88);
}

.brand-carousel {
  margin-top: 6px;
  max-width: 860px;
}

.carousel-card {
  position: relative;
  width: 100%;
  height: 220px;
  border-radius: 16px;
  overflow: hidden;
}

.carousel-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.carousel-overlay {
  position: absolute;
  inset: auto 0 0;
  padding: 14px 16px;
  background: linear-gradient(180deg, transparent 0%, rgba(2, 6, 23, 0.72) 80%);
}

.carousel-overlay h3 {
  margin: 0;
  font-size: 18px;
}

.carousel-overlay p {
  margin: 6px 0 0;
  color: rgba(255, 255, 255, 0.85);
}

.brand-placeholder {
  max-width: 860px;
  border: 1px dashed rgba(255, 255, 255, 0.45);
  border-radius: 14px;
  padding: 18px;
  background: rgba(15, 23, 42, 0.22);
  color: rgba(255, 255, 255, 0.88);
}

.leader-grid {
  max-width: 860px;
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.leader-card {
  border-radius: 14px;
  padding: 12px;
  display: flex;
  gap: 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.leader-card h4 {
  margin: 2px 0 2px;
  font-size: 15px;
  font-weight: 700;
}

.leader-title {
  margin: 0;
  color: rgba(255, 255, 255, 0.78);
}

.leader-intro {
  margin: 5px 0 0;
  line-height: 1.5;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.auth-panel {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  padding: 28px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(14px);
  box-shadow: 0 20px 48px rgba(2, 6, 23, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.65);
}

.auth-card h2 {
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  color: #111827;
}

.auth-subtitle {
  margin: 8px 0 20px;
  color: #6b7280;
}

.form-meta {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

@media (max-width: 1280px) {
  .login-shell {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .auth-panel {
    justify-content: flex-start;
  }

  .auth-card {
    max-width: 460px;
  }
}
</style>
