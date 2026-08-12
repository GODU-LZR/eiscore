// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const DEFAULT_MODULE = 'eiscore-base'

export const buildCollectorUserContext = (userInfo = {}, appModule = DEFAULT_MODULE) => {
  const info = userInfo && typeof userInfo === 'object' ? userInfo : {}
  const tenant = info.tenant && typeof info.tenant === 'object' ? info.tenant : {}
  const enterprise = info.enterprise && typeof info.enterprise === 'object' ? info.enterprise : {}
  const department = info.department && typeof info.department === 'object' ? info.department : {}
  const organization = info.organization && typeof info.organization === 'object' ? info.organization : {}
  const org = info.org && typeof info.org === 'object' ? info.org : {}
  const company = info.company && typeof info.company === 'object' ? info.company : {}
  const dept = info.dept && typeof info.dept === 'object' ? info.dept : {}
  return {
    appModule,
    userId: info.id || info.userId || info.user_id || info.uid || info.sub ||
      info.employeeId || info.employee_id || info.employeeNo || info.employee_no ||
      info.staffId || info.staff_id || info.staffNo || info.staff_no ||
      info.workerId || info.worker_id || info.username || '',
    username: info.username || info.name || info.displayName || info.display_name ||
      info.realName || info.real_name || info.full_name || info.fullName ||
      info.employeeName || info.employee_name || info.staffName || info.staff_name ||
      info.nickName || info.nick_name || info.nickname || '',
    role: info.sop_role || info.sopRole || info.app_role || info.appRole || info.roleName || info.role_name || info.role || info.dbRole ||
      info.position || info.positionName || info.position_name ||
      info.post || info.postName || info.post_name ||
      info.jobTitle || info.job_title ||
      info.departmentName || info.department_name || department.name || info.department || '',
    tenantId: info.tenantId || info.tenant_id || info.enterpriseId || info.enterprise_id || info.enterpriseCode || info.enterprise_code ||
      info.companyCode || info.company_code || info.orgCode || info.org_code || info.organizationCode || info.organization_code ||
      tenant.id || tenant.tenantId || tenant.code || tenant.enterpriseCode ||
      enterprise.id || enterprise.code || company.id || company.code || org.id || org.code || organization.id || organization.code || '',
    tenantName: info.tenantName || info.tenant_name || info.enterpriseName || info.enterprise_name ||
      info.companyName || info.company_name || info.orgName || info.org_name || info.organizationName || info.organization_name ||
      tenant.name || enterprise.name || company.name || org.name || organization.name || '',
    enterpriseCode: info.enterpriseCode || info.enterprise_code || info.tenantId || info.tenant_id ||
      info.companyCode || info.company_code || info.orgCode || info.org_code || info.organizationCode || info.organization_code ||
      tenant.code || enterprise.code || company.code || org.code || organization.code || '',
    enterpriseName: info.enterpriseName || info.enterprise_name || info.tenantName || info.tenant_name ||
      info.companyName || info.company_name || info.orgName || info.org_name || info.organizationName || info.organization_name ||
      enterprise.name || tenant.name || company.name || org.name || organization.name || '',
    departmentId: info.departmentId || info.department_id || info.departmentCode || info.department_code ||
      info.deptId || info.dept_id || info.deptCode || info.dept_code || department.id || department.code || dept.id || dept.code || '',
    departmentName: info.departmentName || info.department_name || info.deptName || info.dept_name ||
      department.name || dept.name || (typeof info.department === 'string' ? info.department : '') || ''
  }
}

export const syncCollectorUserContext = (userInfo = {}, appModule = DEFAULT_MODULE) => {
  try {
    if (typeof window === 'undefined') return false
    const collectorLog = window.eiscoreCollectorLog
    if (!collectorLog || typeof collectorLog.setContext !== 'function') return false
    collectorLog.setContext(buildCollectorUserContext(userInfo, appModule))
    return true
  } catch (e) {
    return false
  }
}

export const clearCollectorUserContext = (appModule = DEFAULT_MODULE) => {
  return syncCollectorUserContext({
    id: '',
    userId: '',
    username: '',
    employeeId: '',
    employee_id: '',
    employeeNo: '',
    employee_no: '',
    employeeName: '',
    employee_name: '',
    staffId: '',
    staff_id: '',
    staffNo: '',
    staff_no: '',
    staffName: '',
    staff_name: '',
    workerId: '',
    worker_id: '',
    name: '',
    full_name: '',
    fullName: '',
    role: '',
    roleName: '',
    role_name: '',
    sop_role: '',
    sopRole: '',
    app_role: '',
    appRole: '',
    dbRole: '',
    position: '',
    positionName: '',
    position_name: '',
    post: '',
    postName: '',
    post_name: '',
    jobTitle: '',
    job_title: '',
    tenantId: '',
    tenant_id: '',
    tenantName: '',
    tenant_name: '',
    enterpriseId: '',
    enterprise_id: '',
    enterpriseCode: '',
    enterprise_code: '',
    enterpriseName: '',
    enterprise_name: '',
    companyCode: '',
    company_code: '',
    orgCode: '',
    org_code: '',
    organizationCode: '',
    organization_code: '',
    departmentId: '',
    department_id: '',
    departmentCode: '',
    department_code: '',
    deptId: '',
    dept_id: '',
    deptCode: '',
    dept_code: '',
    departmentName: '',
    department_name: '',
    department: ''
  }, appModule)
}
