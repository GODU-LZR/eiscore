<template>
  <div class="enterprise-profile-panel">
    <el-alert
      title="企业公开资料已合并到企业站点运营"
      description="这里仅展示已发布结果。企业名称、Logo、联系方式、公开站地址和 SEO 信息请在企业站点运营中统一修改并发布。"
      type="success"
      show-icon
      :closable="false"
      class="section-alert"
    />
    <div class="enterprise-profile-heading">
      <span v-if="summary.logoUrl" class="enterprise-profile-logo">
        <img :src="summary.logoUrl" alt="企业 Logo" />
      </span>
      <div>
        <h3>{{ summary.displayName }}</h3>
        <p>{{ summary.description }}</p>
      </div>
    </div>
    <el-descriptions :column="2" border class="enterprise-profile-summary">
      <el-descriptions-item label="企业法定名称">{{ summary.legalName }}</el-descriptions-item>
      <el-descriptions-item label="站点标识">{{ summary.siteKey }}</el-descriptions-item>
      <el-descriptions-item label="公开站地址">
        <el-link v-if="summary.publicSiteUrl" type="primary" :href="summary.publicSiteUrl" target="_blank">
          {{ summary.publicSiteUrl }}
        </el-link>
        <span v-else>—</span>
      </el-descriptions-item>
      <el-descriptions-item label="联系方式">{{ summary.contact }}</el-descriptions-item>
      <el-descriptions-item label="发布语言">{{ summary.locales }}</el-descriptions-item>
      <el-descriptions-item label="发布版本">v{{ summary.publishedVersion }}</el-descriptions-item>
    </el-descriptions>
    <div class="enterprise-profile-actions">
      <el-button type="primary" @click="$emit('open-operations')">进入企业站点运营</el-button>
      <el-button :disabled="!summary.publicSiteUrl" @click="$emit('open-public-site')">打开企业独立站</el-button>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

defineProps({
  summary: { type: Object, required: true }
})

defineEmits(['open-operations', 'open-public-site'])
</script>

<style scoped>
.enterprise-profile-panel { padding-top: 16px; }
.enterprise-profile-heading { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
.enterprise-profile-heading h3 { margin: 0; font-size: 20px; }
.enterprise-profile-heading p { margin: 6px 0 0; color: var(--el-text-color-secondary); line-height: 1.6; }
.enterprise-profile-logo { display: inline-flex; align-items: center; justify-content: center; width: 76px; height: 76px; flex: 0 0 auto; padding: 8px; box-sizing: border-box; border: 1px solid var(--el-border-color); border-radius: 10px; background: #fff; }
.enterprise-profile-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
.enterprise-profile-actions { display: flex; gap: 10px; margin-top: 18px; }
</style>
