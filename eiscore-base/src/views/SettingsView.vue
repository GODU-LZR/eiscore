<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <div>
            <h2>系统全局设置</h2>
            <p>主题色与登录门户展示内容</p>
          </div>
        </div>
      </template>

      <el-alert
        v-if="!canManage"
        title="仅超级管理员可修改系统设置"
        type="warning"
        show-icon
        style="margin-bottom: 16px;"
      />

      <el-form label-width="140px" class="settings-form" :disabled="!canManage">
        <el-divider content-position="left">基础配置</el-divider>
        <el-form-item label="系统标题">
          <el-input v-model="form.title" placeholder="请输入左上角显示标题" />
        </el-form-item>

        <el-form-item label="主题颜色">
          <div class="theme-row">
            <el-color-picker v-model="form.themeColor" />
            <div class="preset-colors">
              <button
                v-for="color in predefineColors"
                :key="color"
                type="button"
                class="color-block"
                :style="{ backgroundColor: color }"
                @click="form.themeColor = color"
              />
            </div>
          </div>
        </el-form-item>

        <el-form-item label="开启通知">
          <el-switch v-model="form.notifications" />
        </el-form-item>

        <el-form-item label="物料分类层级">
          <el-radio-group v-model="form.materialsCategoryDepth">
            <el-radio :label="2">二级</el-radio>
            <el-radio :label="3">三级</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider content-position="left">登录门户品牌信息</el-divider>
        <el-form-item label="企业名称">
          <el-input v-model="form.loginBranding.companyName" placeholder="例如：XX集团有限公司" />
        </el-form-item>

        <el-form-item label="主宣传语">
          <el-input v-model="form.loginBranding.slogan" placeholder="例如：数字驱动业务增长" />
        </el-form-item>

        <el-form-item label="企业介绍">
          <el-input
            v-model="form.loginBranding.description"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="用于登录页展示企业简介"
          />
        </el-form-item>

        <el-form-item label="背景图片">
          <div class="upload-row">
            <el-input
              v-model="form.loginBranding.backgroundImage"
              placeholder="可填图片 URL，或使用右侧上传"
            />
            <el-upload
              accept="image/*"
              :show-file-list="false"
              :auto-upload="false"
              :on-change="(file) => handleBackgroundUpload(file)"
            >
              <el-button>上传</el-button>
            </el-upload>
          </div>
        </el-form-item>

        <el-form-item label="轮播图片">
          <div class="dynamic-panel">
            <div
              v-for="(item, index) in form.loginBranding.carouselImages"
              :key="`carousel-${index}`"
              class="dynamic-item"
            >
              <el-input v-model="item.url" placeholder="图片 URL 或上传图片" />
              <el-input v-model="item.title" placeholder="标题（可选）" />
              <el-input v-model="item.subtitle" placeholder="副标题（可选）" />
              <div class="item-actions">
                <el-upload
                  accept="image/*"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleCarouselUpload(file, index)"
                >
                  <el-button>上传图片</el-button>
                </el-upload>
                <el-button type="danger" plain @click="removeCarousel(index)">删除</el-button>
              </div>
            </div>
            <el-button class="add-btn" @click="addCarousel">新增轮播图</el-button>
          </div>
        </el-form-item>

        <el-form-item label="领导介绍">
          <div class="dynamic-panel">
            <div
              v-for="(leader, index) in form.loginBranding.leaders"
              :key="`leader-${index}`"
              class="dynamic-item leader-item"
            >
              <el-input v-model="leader.name" placeholder="姓名" />
              <el-input v-model="leader.title" placeholder="职位" />
              <el-input
                v-model="leader.intro"
                type="textarea"
                :rows="2"
                maxlength="180"
                show-word-limit
                placeholder="一句话简介"
              />
              <div class="upload-row">
                <el-input v-model="leader.avatar" placeholder="头像 URL 或上传图片" />
                <el-upload
                  accept="image/*"
                  :show-file-list="false"
                  :auto-upload="false"
                  :on-change="(file) => handleLeaderUpload(file, index)"
                >
                  <el-button>上传头像</el-button>
                </el-upload>
              </div>
              <el-button type="danger" plain @click="removeLeader(index)">删除领导</el-button>
            </div>
            <el-button class="add-btn" @click="addLeader">新增领导介绍</el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="canManage">
          <el-button type="primary" @click="saveSettings">保存并生效</el-button>
          <el-button @click="resetSettings">重置默认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed, watch } from 'vue'
import { useSystemStore } from '@/stores/system'
import { useUserStore } from '@/stores/user'
import { ElMessage } from 'element-plus'

const systemStore = useSystemStore()
const userStore = useUserStore()

const predefineColors = [
  '#409EFF',
  '#1455d9',
  '#0f766e',
  '#1d4ed8',
  '#dc2626',
  '#ca8a04',
  '#4f46e5'
]

const defaultForm = () => ({
  title: '海边姑娘管理系统',
  themeColor: '#409EFF',
  notifications: true,
  materialsCategoryDepth: 2,
  loginBranding: {
    companyName: '广东南派食品有限公司',
    slogan: '深耕热带水果全产业链，打造高品质水果制品方案',
    description: '根据企业官网公开信息：公司成立于 2009 年，注册资金 1000 万元，总部位于中国雷州半岛；拥有湛江、广西两大加工基地和多条水果加工生产线，面向茶饮、烘焙、饮料与生鲜客户提供一站式水果制品解决方案。',
    backgroundImage: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgx6CtnwYoh8fKtgcwgA84vAU!1500x1500.jpg',
    carouselImages: [
      {
        url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg5uqnnwYoiNO9CjDcCziIBQ.jpg',
        title: '热带水果全产业链布局',
        subtitle: '覆盖种植、加工、研发、销售与服务'
      },
      {
        url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3-CwnwYo_qL0ggIwjgI4nwM.jpg',
        title: '加工与品控能力',
        subtitle: '支持多品类水果制品的规模化生产'
      },
      {
        url: 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAgheiwnwYoj7jo0QQwjgI4nwM.jpg',
        title: '面向多场景客户',
        subtitle: '服务茶饮、烘焙、饮料与生鲜渠道'
      }
    ],
    leaders: []
  }
})

const form = reactive(defaultForm())

const canManage = computed(() => {
  const role = String(userStore.userInfo?.role || '').toLowerCase()
  const dbRole = String(userStore.userInfo?.dbRole || '').toLowerCase()
  const username = String(userStore.userInfo?.username || '').toLowerCase()
  return role === 'super_admin'
    || role === 'admin'
    || role === '超级管理员'
    || dbRole === 'super_admin'
    || dbRole === 'admin'
    || username === 'admin'
})

const syncFromStore = (cfg) => {
  const source = cfg && typeof cfg === 'object' ? cfg : {}
  const branding = source.loginBranding && typeof source.loginBranding === 'object'
    ? source.loginBranding
    : {}
  const next = defaultForm()

  form.title = String(source.title || next.title)
  form.themeColor = String(source.themeColor || next.themeColor)
  form.notifications = source.notifications !== false
  form.materialsCategoryDepth = Number(source.materialsCategoryDepth) === 3 ? 3 : 2

  form.loginBranding.companyName = String(branding.companyName || next.loginBranding.companyName)
  form.loginBranding.slogan = String(branding.slogan || next.loginBranding.slogan)
  form.loginBranding.description = String(branding.description || next.loginBranding.description)
  form.loginBranding.backgroundImage = String(branding.backgroundImage || '')
  form.loginBranding.carouselImages = Array.isArray(branding.carouselImages)
    ? branding.carouselImages.map((item) => ({
      url: String(item?.url || ''),
      title: String(item?.title || ''),
      subtitle: String(item?.subtitle || '')
    })).filter((item) => item.url)
    : []
  form.loginBranding.leaders = Array.isArray(branding.leaders)
    ? branding.leaders.map((item) => ({
      name: String(item?.name || ''),
      title: String(item?.title || ''),
      intro: String(item?.intro || ''),
      avatar: String(item?.avatar || '')
    })).filter((item) => item.name)
    : []
}

onMounted(() => {
  syncFromStore(systemStore.config)
})

watch(() => systemStore.config, (val) => {
  syncFromStore(val)
}, { deep: true })

const toDataUrl = (rawFile) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result || ''))
  reader.onerror = reject
  reader.readAsDataURL(rawFile)
})

const handleBackgroundUpload = async (uploadFile) => {
  if (!uploadFile?.raw) return
  form.loginBranding.backgroundImage = await toDataUrl(uploadFile.raw)
}

const handleCarouselUpload = async (uploadFile, index) => {
  if (!uploadFile?.raw || !form.loginBranding.carouselImages[index]) return
  form.loginBranding.carouselImages[index].url = await toDataUrl(uploadFile.raw)
}

const handleLeaderUpload = async (uploadFile, index) => {
  if (!uploadFile?.raw || !form.loginBranding.leaders[index]) return
  form.loginBranding.leaders[index].avatar = await toDataUrl(uploadFile.raw)
}

const addCarousel = () => {
  form.loginBranding.carouselImages.push({ url: '', title: '', subtitle: '' })
}

const removeCarousel = (index) => {
  form.loginBranding.carouselImages.splice(index, 1)
}

const addLeader = () => {
  form.loginBranding.leaders.push({ name: '', title: '', intro: '', avatar: '' })
}

const removeLeader = (index) => {
  form.loginBranding.leaders.splice(index, 1)
}

const saveSettings = async () => {
  if (!canManage.value) return
  const payload = {
    title: form.title,
    themeColor: form.themeColor,
    notifications: form.notifications,
    materialsCategoryDepth: form.materialsCategoryDepth === 3 ? 3 : 2,
    loginBranding: {
      companyName: form.loginBranding.companyName,
      slogan: form.loginBranding.slogan,
      description: form.loginBranding.description,
      backgroundImage: form.loginBranding.backgroundImage,
      carouselImages: form.loginBranding.carouselImages.filter((item) => item.url),
      leaders: form.loginBranding.leaders.filter((item) => item.name)
    }
  }
  const ok = await systemStore.saveConfig(payload)
  if (ok) ElMessage.success('设置已保存并生效')
  else ElMessage.error('保存失败，请稍后重试')
}

const resetSettings = () => {
  const next = defaultForm()
  form.title = next.title
  form.themeColor = next.themeColor
  form.notifications = next.notifications
  form.materialsCategoryDepth = next.materialsCategoryDepth
  form.loginBranding.companyName = next.loginBranding.companyName
  form.loginBranding.slogan = next.loginBranding.slogan
  form.loginBranding.description = next.loginBranding.description
  form.loginBranding.backgroundImage = next.loginBranding.backgroundImage
  form.loginBranding.carouselImages = next.loginBranding.carouselImages.map((item) => ({ ...item }))
  form.loginBranding.leaders = next.loginBranding.leaders.map((item) => ({ ...item }))
  saveSettings()
}
</script>

<style scoped lang="scss">
.settings-page {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  box-sizing: border-box;
}

.settings-card :deep(.el-card__header) {
  border-bottom: 1px solid var(--el-border-color-light);
}

.card-header h2 {
  margin: 0;
  font-size: 20px;
}

.card-header p {
  margin: 6px 0 0;
  color: var(--el-text-color-secondary);
}

.settings-form {
  max-width: 980px;
}

.theme-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preset-colors {
  display: flex;
  gap: 8px;
}

.color-block {
  width: 22px;
  height: 22px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
}

.upload-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  width: 100%;
}

.dynamic-panel {
  display: grid;
  gap: 12px;
  width: 100%;
}

.dynamic-item {
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 10px;
  background: var(--el-fill-color-extra-light);
}

.leader-item {
  background: color-mix(in srgb, var(--el-color-primary) 6%, #ffffff);
}

.item-actions {
  display: flex;
  gap: 10px;
}

.add-btn {
  width: fit-content;
}

@media (max-width: 768px) {
  .upload-row {
    grid-template-columns: 1fr;
  }
}
</style>
