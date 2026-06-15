<template>
  <div class="hr-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>人事应用</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col
        v-for="app in visibleApps"
        :key="app.key"
        :xs="24"
        :sm="12"
        :md="12"
        :lg="8"
        :xl="8"
      >
        <el-card
          class="app-card"
          data-guide="app-card"
          :data-guide-key="app.key"
          :class="`attention-${app.card.attentionLevel || 'normal'}`"
          shadow="hover"
          @click="openApp(app)"
        >
          <div class="app-card-body">
            <div class="app-icon" :class="`tone-${app.tone}`">
              <el-icon size="20">
                <component :is="iconMap[app.icon]" />
              </el-icon>
            </div>
            <div class="app-info">
              <div class="app-title-line">
                <div class="app-name">{{ app.name }}</div>
                <span class="app-status" data-guide="app-card-status" :class="`status-${app.card.status}`">{{ app.card.statusText }}</span>
              </div>
              <div class="app-desc">{{ app.desc }}</div>
            </div>
          </div>
          <div class="app-metrics" data-guide="app-card-metrics">
            <div v-for="metric in app.card.metrics" :key="metric.label" class="metric-item">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div class="app-enter" data-guide="app-card-enter">
            <span>{{ app.card.brief }}</span>
            <span>进入</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { User, Document, Calendar, OfficeBuilding } from '@element-plus/icons-vue'
import { HR_APPS } from '@/utils/hr-apps'
import { hasPerm } from '@/utils/permission'
import request from '@/utils/request'
import {
  appendQuery,
  buildGenericCard,
  cardFromScore,
  daysBetween,
  numberValue,
  sortByAttention
} from '@shared/app-card-attention'
import {
  combineQueryParts,
  countStat,
  filterPart,
  loadAppCardStats,
  orFilter,
  statNumber
} from '@shared/app-card-server-stats'
import { isAppVisible, useDisplayVisibility } from '@shared/eis-display-control'

const router = useRouter()
const apps = HR_APPS
const { visibility: displayVisibility } = useDisplayVisibility()
const iconMap = { User, Document, Calendar, OfficeBuilding }
const appRows = ref({
  archives: [],
  attendance: [],
  departments: [],
  users: [],
  roles: [],
  userRoles: []
})
const serverStats = ref({})
const cardLoading = ref(false)

const rowsOf = (key) => appRows.value[key] || []
const statsOf = (key) => serverStats.value[key] || {}
const today = () => new Date().toISOString().slice(0, 10)
const offsetDate = (days) => {
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

const requestList = async (key, url, schema = 'hr') => {
  try {
    const rows = await request({
      url: appendQuery(url, { limit: 300 }),
      method: 'get',
      headers: { 'Accept-Profile': schema, 'Content-Profile': schema },
      silentError: true,
      suppressErrorMessage: true
    })
    return [key, Array.isArray(rows) ? rows : []]
  } catch (e) {
    return [key, rowsOf(key)]
  }
}

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const [statsResult, results] = await Promise.all([
      loadHrCardStats().catch(() => ({})),
      Promise.all([
        requestList('archives', '/archives?order=updated_at.desc', 'hr'),
        requestList('attendance', '/attendance_records?order=att_date.desc', 'hr'),
        requestList('departments', '/departments?order=name.asc', 'public'),
        requestList('users', '/users?order=id.desc', 'public'),
        requestList('roles', '/roles?order=sort.asc', 'public'),
        requestList('userRoles', '/user_roles?order=user_id.asc', 'public')
      ])
    ])
    appRows.value = results.reduce((acc, [key, rows]) => {
      acc[key] = rows
      return acc
    }, { ...appRows.value })
    serverStats.value = { ...serverStats.value, ...statsResult }
  } finally {
    cardLoading.value = false
  }
}

const loadHrCardStats = async () => {
  const entries = await Promise.allSettled([
    request({
      url: '/rpc/eis_app_card_stats',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { payload: { stat_key: 'hr_overview' } },
      silentError: true,
      suppressErrorMessage: true
    }).then((value) => ['hrOverview', value || {}]),
    loadAppCardStats({
      request,
      profile: 'hr',
      apiUrl: '/archives',
      viewId: 'employee_list',
      stats: [
        countStat('total'),
        countStat('active', filterPart('status', 'in', ['在职', '待开通账号', '待入职', 'active'])),
        countStat('onboarding', filterPart('status', 'in', ['待开通账号', '待入职'])),
        countStat('recentJoin', combineQueryParts(filterPart('entry_date', 'gte', offsetDate(-30)), filterPart('entry_date', 'lte', today())))
      ]
    }).then((value) => ['archives', value]),
    loadAppCardStats({
      request,
      profile: 'hr',
      apiUrl: '/attendance_records',
      viewId: 'hr_attendance',
      stats: [
        countStat('total'),
        countStat('todayTotal', filterPart('att_date', 'eq', today())),
        countStat('abnormal', orFilter(filterPart('late_flag', 'eq', true), filterPart('early_flag', 'eq', true), filterPart('leave_flag', 'eq', true), filterPart('absent_flag', 'eq', true)))
      ]
    }).then((value) => ['attendance', value]),
    loadAppCardStats({
      request,
      profile: 'hr',
      apiUrl: '/attendance_records',
      viewId: 'hr_attendance_today',
      stats: [
        countStat('todayAbnormal', orFilter(filterPart('late_flag', 'eq', true), filterPart('early_flag', 'eq', true), filterPart('leave_flag', 'eq', true), filterPart('absent_flag', 'eq', true)))
      ],
      baseFilter: filterPart('att_date', 'eq', today())
    }).then((value) => ['attendanceToday', value]),
    loadAppCardStats({
      request,
      profile: 'public',
      apiUrl: '/departments',
      viewId: 'departments',
      stats: [countStat('total')]
    }).then((value) => ['departments', value]),
    loadAppCardStats({
      request,
      profile: 'public',
      apiUrl: '/users',
      viewId: 'users',
      stats: [
        countStat('total'),
        countStat('disabled', filterPart('status', 'in', ['disabled', 'locked', '停用', '禁用']))
      ]
    }).then((value) => ['users', value]),
    loadAppCardStats({
      request,
      profile: 'public',
      apiUrl: '/roles',
      viewId: 'roles',
      stats: [countStat('total')]
    }).then((value) => ['roles', value]),
    loadAppCardStats({
      request,
      profile: 'public',
      apiUrl: '/user_roles',
      viewId: 'user_roles',
      stats: [countStat('total')]
    }).then((value) => ['userRoles', value])
  ])

  return entries.reduce((acc, item) => {
    if (item.status === 'fulfilled') {
      const [key, value] = item.value
      acc[key] = value || {}
    }
    return acc
  }, {})
}

const cardMap = computed(() => {
  const archives = rowsOf('archives')
  const attendance = rowsOf('attendance')
  const departments = rowsOf('departments')
  const users = rowsOf('users')
  const roles = rowsOf('roles')
  const userRoles = rowsOf('userRoles')
  const archiveStats = statsOf('archives')
  const attendanceStats = statsOf('attendance')
  const attendanceTodayStats = statsOf('attendanceToday')
  const departmentStats = statsOf('departments')
  const userStats = statsOf('users')
  const roleStats = statsOf('roles')
  const hrOverviewStats = statsOf('hrOverview')

  const activeEmployees = statNumber(archiveStats, 'active', archives.filter((row) => ['在职', '待开通账号', '待入职', 'active'].includes(String(row.status || '').trim())).length)
  const onboarding = statNumber(archiveStats, 'onboarding', archives.filter((row) => ['待开通账号', '待入职'].includes(String(row.status || '').trim())).length)
  const missingDept = statNumber(hrOverviewStats, 'missingDept', archives.filter((row) => !String(row.department || '').trim()).length)
  const recentJoinFallback = archives.filter((row) => {
    const delta = daysBetween(row.entry_date)
    return delta !== null && delta >= -30 && delta <= 0
  }).length
  const recentJoin = statNumber(archiveStats, 'recentJoin', recentJoinFallback)
  const todayAttendance = attendance.filter((row) => daysBetween(row.att_date) === 0)
  const attendanceAbnormal = statNumber(attendanceStats, 'abnormal', attendance.filter((row) => row.late_flag || row.early_flag || row.leave_flag || row.absent_flag).length)
  const todayAbnormal = statNumber(attendanceTodayStats, 'todayAbnormal', todayAttendance.filter((row) => row.late_flag || row.early_flag || row.leave_flag || row.absent_flag).length)
  const roleCodes = new Set(roles.map((row) => row.id).filter(Boolean))
  const usersWithoutRoleFallback = users.filter((row) => {
    const userId = row.id
    if (!userId) return false
    return !userRoles.some((rel) => rel.user_id === userId && (!rel.role_id || roleCodes.has(rel.role_id)))
  }).length
  const usersWithoutRole = statNumber(hrOverviewStats, 'usersWithoutRole', usersWithoutRoleFallback)
  const disabledUsers = statNumber(userStats, 'disabled', users.filter((row) => ['disabled', 'locked', '停用', '禁用'].includes(String(row.status || '').trim())).length)
  const userTotal = statNumber(userStats, 'total', users.length)
  const roleTotal = statNumber(roleStats, 'total', roles.length)
  const departmentCount = statNumber(departmentStats, 'total', departments.length || new Set(archives.map((row) => row.department).filter(Boolean)).size)
  const positionCount = statNumber(hrOverviewStats, 'positionCount', new Set(archives.map((row) => row.position).filter(Boolean)).size)

  return {
    a: cardFromScore({
      score: missingDept > 0 ? 62 : (onboarding > 0 ? 48 : 28),
      metrics: [
        { label: '在职/待入职', value: `${activeEmployees}/${onboarding}` },
        { label: '信息缺口', value: `${missingDept}` }
      ],
      brief: missingDept > 0 ? '补齐员工部门信息' : (onboarding > 0 ? '跟进入职资料与账号' : '维护员工档案')
    }),
    org: cardFromScore({
      score: missingDept > 0 ? 58 : (departmentCount ? 28 : 50),
      metrics: [
        { label: '部门数', value: `${departmentCount}` },
        { label: '岗位数', value: `${positionCount}` }
      ],
      brief: missingDept > 0 ? '组织归属存在缺口' : '查看组织和成员'
    }),
    acl: cardFromScore({
      score: usersWithoutRole > 0 ? 78 : (roles.length ? 30 : 55),
      metrics: [
        { label: '角色数', value: `${roleTotal}` },
        { label: '未绑角色', value: `${usersWithoutRole}` }
      ],
      brief: usersWithoutRole > 0 ? '优先处理无角色用户' : '维护权限与数据范围'
    }),
    user: cardFromScore({
      score: usersWithoutRole > 0 ? 72 : (disabledUsers > 0 ? 42 : 28),
      metrics: [
        { label: '用户数', value: `${userTotal}` },
        { label: '停用/无角', value: `${disabledUsers}/${usersWithoutRole}` }
      ],
      brief: usersWithoutRole > 0 ? '为用户绑定角色' : '维护账号状态'
    }),
    b: cardFromScore({
      score: recentJoin > 0 ? 45 : 24,
      metrics: [
        { label: '近30天入职', value: `${recentJoin}` },
        { label: '部门岗位', value: `${departmentCount}/${positionCount}` }
      ],
      brief: '跟踪岗位与组织变动'
    }),
    c: cardFromScore({
      score: todayAbnormal > 0 ? 80 : (attendanceAbnormal > 0 ? 60 : 28),
      metrics: [
        { label: '今日异常', value: `${todayAbnormal}` },
        { label: '异常记录', value: `${attendanceAbnormal}` }
      ],
      brief: todayAbnormal > 0 ? '优先处理今日考勤异常' : (attendanceAbnormal > 0 ? '复核异常考勤记录' : '查看出勤台账')
    })
  }
})

const visibleApps = computed(() => apps
  .filter((app) => isAppVisible(displayVisibility.value, 'hr', app.key))
  .filter(app => !app.perm || hasPerm(app.perm))
  .map((app) => ({
    ...app,
    card: cardLoading.value && !rowsOf('archives').length
      ? buildGenericCard(app, [], true)
      : (cardMap.value[app.key] || buildGenericCard(app, rowsOf('archives'), cardLoading.value))
  }))
  .sort(sortByAttention))

const openApp = (app) => {
  if (!app?.route) return
  router.push(app.route)
}

onMounted(loadCardData)
</script>

<style scoped>
.hr-apps {
  position: relative;
  padding: 20px;
  min-height: 100vh;
  box-sizing: border-box;
  background: #f5f7fb;
}

.apps-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.app-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 168px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
}

.app-card :deep(.el-card__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(var(--el-color-primary-rgb), 0.15);
}

.app-card-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 48px;
}

.app-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.tone-blue { background: var(--el-color-primary); }
.tone-orange { background: #e6a23c; }
.tone-green { background: #67c23a; }

.app-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.app-title-line {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.app-desc {
  display: -webkit-box;
  overflow: hidden;
  font-size: 12px;
  line-height: 18px;
  color: #909399;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.app-status {
  flex: 0 0 auto;
  min-width: 48px;
  max-width: 58px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  background: #eef2ff;
  color: #475569;
}

.status-ok {
  background: #dcfce7;
  color: #16a34a;
}

.status-warn {
  background: #fef3c7;
  color: #d97706;
}

.status-danger {
  background: #fee2e2;
  color: #dc2626;
}

.status-info {
  background: #e0f2fe;
  color: #0284c7;
}

.app-metrics {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-item {
  min-width: 0;
  height: 42px;
  padding: 0 10px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #f6f8fb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metric-item strong {
  min-width: 52px;
  overflow: visible;
  color: #303133;
  font-size: 17px;
  line-height: 1;
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
}

.metric-item span {
  min-width: 0;
  flex: 1;
  color: #909399;
  font-size: 11px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-enter {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
}

.app-enter span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #909399;
}

.app-enter span:last-child {
  flex: 0 0 auto;
}

.attention-critical {
  border-color: rgba(239, 68, 68, 0.45);
}

.attention-warning {
  border-color: rgba(245, 158, 11, 0.42);
}

.attention-focus {
  border-color: rgba(14, 165, 233, 0.36);
}

@media (min-width: 1500px) {
  .hr-apps {
    max-width: 1480px;
    margin: 0 auto;
  }
}

:global(#app.dark) .hr-apps {
  background-color: #0b0f14;
}
:global(#app.dark) .header-text h2,
:global(#app.dark) .header-text p {
  color: #f3f4f6;
}
:global(#app.dark) .app-card {
  background-color: #111827;
  border-color: #1f2937;
}
:global(#app.dark) .metric-item {
  background: #0f172a;
}
:global(#app.dark) .app-name,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #f3f4f6;
}
:global(#app.dark) .metric-item strong,
:global(#app.dark) .app-enter span:first-child {
  color: #f3f4f6;
}
:global(#app.dark) .metric-item span {
  color: #9ca3af;
}
</style>
