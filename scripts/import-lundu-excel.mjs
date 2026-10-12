// Import the Lundu workbook into the local development database.
// This is intentionally explicit: dry-run is the default and replacement requires a confirmation token.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const requireFromRuntime = createRequire(resolve(repoRoot, 'realtime', 'package.json'))
const XLSX = requireFromRuntime('xlsx')
const { Client } = requireFromRuntime('pg')

const args = Object.fromEntries(process.argv.slice(2).map((entry) => {
  const [key, ...parts] = entry.replace(/^--/, '').split('=')
  return [key, parts.join('=') || true]
}))

const inputPath = resolve(String(args.input || ''))
const isApply = args.apply === true || args.apply === 'true'
const confirmation = String(args.confirm || '')
const confirmationToken = 'REPLACE-LUNDU-FAKE-DATA'
const reportPath = resolve(String(args.report || resolve(repoRoot, '.tmp', 'lundu-import-report.json')))

if (!inputPath || !readFileSafe(inputPath)) fail(`Workbook not found: ${inputPath}`)
if (isApply && confirmation !== confirmationToken) {
  fail(`Refusing database replacement. Re-run with --confirm=${confirmationToken}`)
}

const workbook = XLSX.readFile(inputPath, { cellDates: true, raw: true })
const sourceName = inputPath.replaceAll('\\', '/')
const now = new Date().toISOString()

const sheetRows = (sheetName) => {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) fail(`Missing worksheet: ${sheetName}`)
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
}

const findHeader = (rows, firstCell = '序号') => {
  const index = rows.findIndex((row) => row.some((value) => String(value ?? '').trim() === firstCell))
  if (index < 0) fail(`Header row not found for ${firstCell}`)
  const headers = rows[index].map((value, column) => String(value ?? '').trim() || `列${column + 1}`)
  const seen = new Map()
  const keys = headers.map((header) => {
    const count = (seen.get(header) || 0) + 1
    seen.set(header, count)
    return count === 1 ? header : `${header}__${count}`
  })
  return { index, headers, keys }
}

const recordsFrom = (sheetName, predicate) => {
  const rows = sheetRows(sheetName)
  const header = findHeader(rows)
  return rows.slice(header.index + 1).map((values, offset) => ({
    values,
    rowNumber: header.index + offset + 2,
    fields: Object.fromEntries(header.keys.map((key, index) => [key, clean(values[index])]))
  })).filter((record) => predicate(record.values))
}

const clean = (value) => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

const materialCategoryCode = (name) => {
  const text = clean(name)
  if (/(泡沫|纸箱|木箱|包装)/.test(text)) return '03'
  if (/(线盒|定子|转子|轴料|轴承|风叶|风罩|线圈|电机)/.test(text)) return '02'
  return '01'
}

const LUNDU_USER_ACCOUNTS = new Map([
  ['001', { username: 'zlh', department: '公司总部', role: 'super_admin' }],
  ['002', { username: 'hdr', department: '公司总部', role: 'dept_manager' }],
  ['003', { username: 'trg', department: '公司总部', role: 'dept_manager' }],
  ['004', { username: 'fh', department: '公司总部', role: 'dept_manager' }],
  ['005', { username: 'zxy', department: '销售部', role: 'dept_manager' }],
  ['006', { username: 'lsl', department: '销售部', role: 'employee' }],
  ['007', { username: 'jy', department: '财务部', role: 'dept_manager' }],
  ['008', { username: 'cah', department: '研发部', role: 'dept_manager' }],
  ['009', { username: 'lhw', department: '生产部', role: 'dept_manager' }],
  ['010', { username: 'zyc', department: '生产部', role: 'dept_manager' }],
  ['011', { username: 'lzw', department: '质量管理部', role: 'dept_manager' }],
  ['012', { username: 'lyy', department: '采购部', role: 'dept_manager' }],
  ['013', { username: 'jzb', department: '采购部', role: 'employee' }],
  ['014', { username: 'lz', department: '供应链中心', role: 'dept_manager' }],
  ['015', { username: 'tlq', department: '供应链中心', role: 'employee' }]
])

const LUNDU_USER_PERMISSIONS = ['module:home', 'module:hr', 'app:hr_employee', 'app:hr_org', 'op:hr_employee.view', 'op:hr_org.view']
const SUPER_ADMIN_ACCOUNT = { username: 'admin', fullName: '超级管理员', role: 'super_admin', password: '123456' }

const numberOrNull = (value) => {
  const text = clean(value).replaceAll(',', '')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

const slugify = (value, fallback) => {
  const slug = clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || fallback
}

const sourceFields = (record) => ({
  worksheet: record.sheetName,
  source_row: record.rowNumber,
  headers: record.headers,
  values: record.values.map((value) => value instanceof Date ? value.toISOString() : value)
})

const withSource = (record, sheetName, headers) => ({
  ...record,
  sheetName,
  headers,
  fields: Object.fromEntries(headers.map((header, index) => [header || `列${index + 1}`, clean(record.values[index])]))
})

const parseDate = (value) => {
  const text = clean(value)
  if (!text) return null
  const normalized = text.replace(/[年./]/g, '-').replace('月', '-').replace('日', '')
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return null
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function readFileSafe(path) {
  try { readFileSync(path); return true } catch { return false }
}

function fail(message) {
  console.error(`lundu excel import: ${message}`)
  process.exit(1)
}

const buildData = () => {
  const orgRows = recordsFrom('组织与权限', (row) => /^\d+$/.test(clean(row[0])) && clean(row[3]))
  const orgHeader = findHeader(sheetRows('组织与权限'))
  const employees = orgRows.map((raw) => {
    const record = withSource(raw, '组织与权限', orgHeader.headers)
    return {
      name: clean(raw.values[3]),
      employeeNo: clean(raw.values[4]) || `LUNDU-${String(raw.values[0]).padStart(3, '0')}`,
      department: clean(raw.values[1]) || '待分配',
      position: clean(raw.values[2]),
      responsibility: clean(raw.values[7]),
      properties: sourceFields(record)
    }
  })

  const pumpRows = recordsFrom('产品数据（水泵）', (row) => /^\d+$/.test(clean(row[0])) && clean(row[6]))
  const pumpHeader = findHeader(sheetRows('产品数据（水泵）'))
  const pumps = pumpRows.map((raw, index) => {
    const record = withSource(raw, '产品数据（水泵）', pumpHeader.headers)
    const model = clean(raw.values[6])
    return productFrom(record, `LUNDU-P-PUMP-${String(index + 1).padStart(3, '0')}`, model, 'pump', model ? 'review' : 'draft')
  })

  const motorRows = recordsFrom('产品数据（电机）', (row) => /^\d+$/.test(clean(row[0])))
  const motorHeader = findHeader(sheetRows('产品数据（电机）'))
  const motors = motorRows.map((raw, index) => {
    const record = withSource(raw, '产品数据（电机）', motorHeader.headers)
    const model = clean(raw.values[5])
    return productFrom(record, `LUNDU-P-MOTOR-${String(index + 1).padStart(3, '0')}`, model, 'motor', model ? 'review' : 'draft')
  })

  const materialRows = recordsFrom('物料主数据', (row) => clean(row[2]))
  const materialHeader = findHeader(sheetRows('物料主数据'))
  const materials = materialRows.map((raw, index) => {
    const record = withSource(raw, '物料主数据', materialHeader.headers)
    return {
      batchNo: `LUNDU-MAT-${String(index + 1).padStart(3, '0')}`,
      name: clean(raw.values[2]),
      category: materialCategoryCode(raw.values[2]),
      properties: sourceFields(record),
      raw: record
    }
  })

  const inventoryRows = recordsFrom('仓储与库存', (row) => /^\d+$/.test(clean(row[0])) && (clean(row[2]) || clean(row[6])))
  const inventoryHeader = findHeader(sheetRows('仓储与库存'))
  const inventory = inventoryRows.map((raw) => {
    const record = withSource(raw, '仓储与库存', inventoryHeader.headers)
    return {
      row: Number(clean(raw.values[0])),
      warehouseName: clean(raw.values[2]) || '待确认仓库',
      floor: clean(raw.values[3]) || '待确认区域',
      location: clean(raw.values[4]) || '待确认库位',
      sourceCode: clean(raw.values[5]),
      itemName: clean(raw.values[6]) || `待补物料-${clean(raw.values[5]) || raw.values[0]}`,
      unit: clean(raw.values[9]) || '只',
      availableQty: numberOrNull(raw.values[11]) ?? numberOrNull(raw.values[10]) ?? 0,
      lockedQty: numberOrNull(raw.values[12]) ?? 0,
      productionDate: parseDate(raw.values[16]),
      safetyStock: numberOrNull(raw.values[13]),
      properties: sourceFields(record),
      raw: record
    }
  })

  return { employees, pumps, motors, products: [...pumps, ...motors], materials, inventory }
}

function productFrom(record, productCode, model, kind, status) {
  const values = record.values
  const name = clean(values[2]) || (kind === 'pump' ? '水泵' : '三相异步电机')
  const category = clean(values[3]) || (kind === 'pump' ? clean(values[4]) || '水泵' : '电机')
  const applications = [clean(values[kind === 'pump' ? 26 : 25])].filter(Boolean)
  const description = model ? `${name}，型号 ${model}。规格以伦度机电产品资料和订单确认文件为准。` : `${name}，型号及关键参数待补资料。`
  return {
    productCode,
    model,
    name,
    category,
    applications,
    status,
    slug: `${kind}-${slugify(model, productCode.toLowerCase())}-${productCode.toLowerCase()}`,
    specifications: { model, sourceFields: sourceFields(record) },
    delivery: {
      packaging: clean(values[kind === 'pump' ? 27 : 26]),
      manualPath: clean(values[kind === 'pump' ? 28 : 27]),
      imagePath: clean(values[kind === 'pump' ? 29 : 28]),
      publicFlag: clean(values[kind === 'pump' ? 31 : 30]) || '待确认'
    },
    summary: model ? `${category}｜${model}` : `${category}｜型号待补`,
    description
  }
}

const data = buildData()
const counts = {
  employees: data.employees.length,
  pumps: data.pumps.length,
  motors: data.motors.length,
  motorsReview: data.motors.filter((item) => item.status === 'review').length,
  motorsDraft: data.motors.filter((item) => item.status === 'draft').length,
  materials: data.materials.length,
  inventory: data.inventory.length
}

const report = {
  source: sourceName,
  importedAt: now,
  mode: isApply ? 'apply' : 'dry-run',
  counts,
  decisions: [
    '产品使用 LUNDU 来源编码；物料按 LUNDU-MAT-### 生成正式编码，并在 sourceFields 保留原始列。',
    '产品公开字段为空，完整型号产品为 review，缺型号电机为 draft，不直接公开。',
    '库存按仓库/楼层/库位建立树；库存补充物料按名称写入 01/02/03 分类编码。',
    '组织表未提供系统账号、角色或密码；按姓名拼音首字母写入伦度登录名，初始密码按示例统一为 123456，并关联员工档案。',
    '保留 admin/123456 作为受保护的超级管理员账号，导入时幂等恢复全量权限。'
  ]
}

mkdirSync(dirname(reportPath), { recursive: true })
writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

if (!isApply) {
  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

const client = new Client({
  host: process.env.EISCORE_DB_HOST || process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.EISCORE_DB_PORT || process.env.PGPORT || 5432),
  user: process.env.EISCORE_DB_USER || 'postgres',
  password: process.env.EISCORE_DB_PASSWORD || process.env.PGPASSWORD,
  database: process.env.EISCORE_DB_NAME || 'eiscore'
})

if (!client.options.password) fail('Set EISCORE_DB_PASSWORD or PGPASSWORD before applying the import')

await client.connect()
try {
  await client.query('BEGIN')
  await assertReplaceableFakeData(client)
  await replaceHr(client, data.employees)
  await replaceUsers(client, data.employees)
  await replaceCompanySite(client, data)
  const materialIds = await replaceMaterials(client, data.materials)
  await replaceInventory(client, data.inventory, materialIds)
  await client.query('COMMIT')
  report.applied = true
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  console.error(`lundu excel import rolled back: ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}

async function assertReplaceableFakeData(db) {
  const archives = await db.query(`SELECT id, name, employee_no FROM hr.archives`)
  const unexpectedArchives = archives.rows.filter((row) => (
    row.name !== '新员工' &&
    !String(row.employee_no || '').startsWith('EMP') &&
    !/^\d{3}$/.test(String(row.employee_no || ''))
  ))
  if (unexpectedArchives.length) fail(`Refusing to replace non-demo HR archives: ${JSON.stringify(unexpectedArchives)}`)
  const attendance = await db.query(`SELECT employee_name, employee_no FROM hr.attendance_records`)
  const unexpectedAttendance = attendance.rows.filter((row) => (
    row.employee_name !== '新员工' &&
    !String(row.employee_no || '').startsWith('EMP') &&
    !/^\d{3}$/.test(String(row.employee_no || ''))
  ))
  if (unexpectedAttendance.length) fail(`Refusing to replace non-demo attendance: ${JSON.stringify(unexpectedAttendance)}`)
  const site = await db.query(`SELECT legal_name, brand_name, domain FROM company_site.site_config WHERE site_key='primary'`)
  if (!site.rowCount) fail('company_site.site_config primary row is missing')
}

async function replaceHr(db, employees) {
  await db.query(`DELETE FROM hr.attendance_records`)
  await db.query(`DELETE FROM hr.payroll WHERE archive_id IN (SELECT id FROM hr.archives)`)
  await db.query(`DELETE FROM hr.user_employee_links WHERE archive_id IN (SELECT id FROM hr.archives)`)
  await db.query(`DELETE FROM hr.archives`)
  for (const employee of employees) {
    await db.query(
      `INSERT INTO hr.archives (name, employee_no, department, position, phone, status, base_salary, entry_date, properties)
       VALUES ($1,$2,$3,$4,NULL,'在职',NULL,NULL,$5::jsonb)`,
      [employee.name, employee.employeeNo, employee.department, employee.position,
        JSON.stringify({ ...employee.properties, responsibility: employee.responsibility })]
    )
  }
}

async function replaceUsers(db, employees) {
  const accounts = employees.map((employee) => ({
    ...employee,
    account: LUNDU_USER_ACCOUNTS.get(String(employee.employeeNo))
  }))
  const missing = accounts.filter((item) => !item.account)
  if (missing.length) fail(`伦度员工缺少账号映射: ${missing.map((item) => item.employeeNo).join(', ')}`)

  await db.query(`
    DELETE FROM public.users
     WHERE username IN ('hr_admin', 'hr_clerk', 'dept_manager', 'employee')
        OR sop_role IN ('small_enterprise_department_account', 'lundu_excel_import')
  `)

  const allPermissions = (await db.query(`SELECT array_agg(code ORDER BY code) AS permissions FROM public.permissions`)).rows[0].permissions
  const admin = await db.query(
    `INSERT INTO public.users (username,password,role,full_name,permissions,dept_id,status,sop_role,tenant_id)
     VALUES ($1,$2,$3,$4,$5,NULL,'active','system_super_admin','default')
     ON CONFLICT (username) DO UPDATE SET password=EXCLUDED.password,role=EXCLUDED.role,full_name=EXCLUDED.full_name,
       permissions=EXCLUDED.permissions,dept_id=NULL,status='active',sop_role=EXCLUDED.sop_role,tenant_id=EXCLUDED.tenant_id
     RETURNING id`,
    [SUPER_ADMIN_ACCOUNT.username, SUPER_ADMIN_ACCOUNT.password, SUPER_ADMIN_ACCOUNT.role, SUPER_ADMIN_ACCOUNT.fullName, allPermissions]
  )
  const superAdminRole = await db.query(`SELECT id FROM public.roles WHERE code = 'super_admin' LIMIT 1`)
  if (!superAdminRole.rowCount) fail('超级管理员角色不存在')
  await db.query(
    `DELETE FROM public.user_roles WHERE user_id = $1 AND role_id <> $2`,
    [admin.rows[0].id, superAdminRole.rows[0].id]
  )
  await db.query(
    `INSERT INTO public.user_roles (user_id,role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
    [admin.rows[0].id, superAdminRole.rows[0].id]
  )

  for (const employee of accounts) {
    const permissions = employee.account.role === 'super_admin'
      ? (await db.query(`SELECT array_agg(code ORDER BY code) AS permissions FROM public.permissions`)).rows[0].permissions
      : LUNDU_USER_PERMISSIONS
    const department = await db.query(
      `SELECT id FROM public.departments WHERE name = $1 LIMIT 1`,
      [employee.account.department]
    )
    if (!department.rowCount) fail(`伦度目标部门不存在: ${employee.account.department}`)
    const user = await db.query(
      `INSERT INTO public.users (username,password,role,full_name,permissions,dept_id,status,sop_role,tenant_id)
       VALUES ($1,'123456',$2,$3,$4,$5,'active','lundu_excel_import','default')
       RETURNING id`,
      [employee.account.username, employee.account.role, employee.name, permissions, department.rows[0].id]
    )
    const role = await db.query(`SELECT id FROM public.roles WHERE code = $1 LIMIT 1`, [employee.account.role])
    if (!role.rowCount) fail(`伦度用户角色不存在: ${employee.account.role}`)
    await db.query(
      `INSERT INTO public.user_roles (user_id,role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [user.rows[0].id, role.rows[0].id]
    )
    const archive = await db.query(`SELECT id FROM hr.archives WHERE employee_no = $1 LIMIT 1`, [employee.employeeNo])
    if (!archive.rowCount) fail(`伦度员工档案不存在: ${employee.employeeNo}`)
    await db.query(
      `INSERT INTO hr.user_employee_links (user_id,archive_id,linked_by)
       VALUES ($1,$2,$1)
       ON CONFLICT (archive_id) DO UPDATE SET user_id=EXCLUDED.user_id,linked_at=now(),updated_at=now(),linked_by=EXCLUDED.linked_by`,
      [user.rows[0].id, archive.rows[0].id]
    )
  }
}

async function replaceCompanySite(db, imported) {
  // Remove old public content while retaining audit/event rows for traceability.
  await db.query(`DELETE FROM company_site.product_locales WHERE product_id IN (SELECT id FROM company_site.products WHERE site_key='primary')`)
  for (const table of [
    'products', 'content_pages', 'content_revisions', 'site_locales',
    'evidence_records', 'solutions', 'cases', 'knowledge_documents', 'seo_metadata',
    'seo_keywords', 'seo_checks', 'certificates', 'media_assets', 'geo_answer_snapshots',
    'agent_qualification_rules', 'sync_jobs'
  ]) await db.query(`DELETE FROM company_site.${table} WHERE site_key='primary'`)

  const site = {
    legalName: '伦度机电有限公司',
    brandName: '伦度机电',
    shortName: '伦度',
    factoryName: '伦度机电制造基地',
    domain: 'lundu.eiscore.top',
    address: '浙江省台州市温岭市大溪镇沈岙村',
    enabledLocales: ['zh-CN', 'en-US']
  }
  const theme = { accent: '#1d4ed8', accentStrong: '#1e40af', surface: '#ffffff', text: '#172033' }
  const settings = { sourceWorkbook: sourceName, publicClaimsStatus: '待确认', productPublicFlagsStatus: '待确认' }
  const seo = { title: '伦度机电｜电机与水泵制造', description: '伦度机电有限公司，位于浙江台州温岭，提供电机与水泵产品资料及合作入口。' }
  const snapshot = { legal_name: site.legalName, brand_name: site.brandName, domain: site.domain, imported_from: sourceName, imported_at: now }
  await db.query(
    `UPDATE company_site.site_config SET legal_name=$1,brand_name=$2,brand_short_name=$3,factory_name=$4,domain=$5,
      default_locale='zh-CN',enabled_locales=$6::jsonb,theme=$7::jsonb,contact=$8::jsonb,settings=$9::jsonb,seo=$10::jsonb,
      status='published',published_version=published_version+1,published_at=now(),published_by='lundu-excel-import',published_snapshot=$11::jsonb,updated_at=now()
     WHERE site_key='primary'`,
    [site.legalName, site.brandName, site.shortName, site.factoryName, site.domain, JSON.stringify(site.enabledLocales),
      JSON.stringify(theme), JSON.stringify({ address: site.address }), JSON.stringify(settings), JSON.stringify(seo), JSON.stringify(snapshot)]
  )
  for (const locale of site.enabledLocales) {
    await db.query(`INSERT INTO company_site.site_locales (site_key,locale,fallback_locale,status,translation_owner) VALUES ('primary',$1,$2,'published','lundu-excel-import')`, [locale, locale === 'zh-CN' ? '' : 'zh-CN'])
  }
  const evidence = await db.query(
    `INSERT INTO company_site.evidence_records (site_key,claim,source_type,source_ref,evidence,verified_by,status)
     VALUES ('primary',$1,'internal_document',$2,$3::jsonb,'伦度机电资料采集表','published') RETURNING id`,
    ['伦度机电主体、员工、产品、物料和库存数据来自本次资料采集工作簿', sourceName, JSON.stringify({ workbook: sourceName, counts: imported.products.length + imported.materials.length + imported.inventory.length })]
  )
  const evidenceId = evidence.rows[0].id
  for (const product of imported.products) {
    const result = await db.query(
      `INSERT INTO company_site.products (site_key,product_code,slug,category,applications,specifications,delivery,evidence_ids,status,created_by,updated_by)
       VALUES ('primary',$1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7::jsonb,$8,'lundu-excel-import','lundu-excel-import') RETURNING id`,
      [product.productCode, product.slug, product.category, JSON.stringify(product.applications), JSON.stringify(product.specifications), JSON.stringify(product.delivery), JSON.stringify([evidenceId]), product.status]
    )
    await db.query(
      `INSERT INTO company_site.product_locales (product_id,locale,name,summary,description,image_urls,seo,faq,status)
       VALUES ($1,'zh-CN',$2,$3,$4,'[]'::jsonb,$5::jsonb,'[]'::jsonb,$6)`,
      [result.rows[0].id, product.model ? `${product.name} ${product.model}` : `${product.name}（待补型号）`, product.summary, product.description, JSON.stringify({ source: sourceName }), product.status]
    )
  }
  const blocks = [
    { type: 'hero', eyebrow: '伦度机电有限公司', title: '电机与水泵制造', summary: '浙江台州温岭制造基地，产品资料与合作信息以企业确认版本为准。' },
    { type: 'company-facts', title: '企业概况', items: [{ label: '企业主体', value: site.legalName }, { label: '制造基地', value: site.address }] },
    { type: 'product-catalog', title: '产品资料', productCodes: imported.products.filter((item) => item.status === 'review').map((item) => item.productCode), note: '产品公开范围和规格以确认资料为准。' },
    { type: 'contact', title: '合作与询单', action: '采购单' }
  ]
  await db.query(
    `INSERT INTO company_site.content_pages (site_key,locale,slug,page_type,title,summary,blocks,seo,status,version,published_at,published_by,created_by,updated_by)
     VALUES ('primary','zh-CN','home','home',$1,$2,$3::jsonb,$4::jsonb,'published',1,now(),'lundu-excel-import','lundu-excel-import','lundu-excel-import'),
            ('primary','en-US','home','home',$5,$6,$7::jsonb,$8::jsonb,'published',1,now(),'lundu-excel-import','lundu-excel-import','lundu-excel-import')`,
    ['伦度机电｜电机与水泵制造', '伦度机电有限公司，浙江台州温岭制造基地。', JSON.stringify(blocks), JSON.stringify({ title: seo.title, description: seo.description }),
      'Lundu Electromechanical | Motors and Pumps', 'Lundu Electromechanical Co., Ltd. in Wenling, Taizhou. Product details and cooperation information follow confirmed company records.', JSON.stringify(blocks), JSON.stringify({ title: 'Lundu Electromechanical | Motors and Pumps', description: 'Lundu Electromechanical Co., Ltd. in Wenling, Taizhou.' })]
  )
  await db.query(`INSERT INTO company_site.seo_metadata (site_key,locale,path,title,description,canonical,robots,keywords,structured_data,status,updated_by) VALUES ('primary','zh-CN','/',$1,$2,$3,'index,follow','["电机","水泵","温岭制造"]'::jsonb,'{}'::jsonb,'published','lundu-excel-import'),('primary','en-US','/',$4,$5,$6,'index,follow','["motor","pump","Wenling manufacturing"]'::jsonb,'{}'::jsonb,'published','lundu-excel-import')`, [seo.title, seo.description, 'https://lundu.eiscore.top/', 'Lundu Electromechanical | Motors and Pumps', 'Lundu Electromechanical Co., Ltd. in Wenling, Taizhou.', 'https://lundu.eiscore.top/'])
}

async function replaceMaterials(db, sourceMaterials) {
  await db.query(`DELETE FROM scm.inventory_batches`)
  await db.query(`DELETE FROM public.raw_materials`)
  await db.query(`
    INSERT INTO public.system_configs (key,value,description)
    VALUES ('materials_categories', $1::jsonb, '物料分类编码')
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, description=EXCLUDED.description
  `, [JSON.stringify([
    { id: '01', label: '泵体结构件' },
    { id: '02', label: '机电与传动件' },
    { id: '03', label: '包装材料' }
  ])])
  const ids = new Map()
  for (const material of sourceMaterials) {
    const result = await db.query(
      `INSERT INTO public.raw_materials (batch_no,name,category,weight_kg,entry_date,created_by,properties,version)
       VALUES ($1,$2,$3,NULL,NULL,'lundu-excel-import',$4::jsonb,1) RETURNING id`,
      [material.batchNo, material.name, material.category, JSON.stringify(material.properties)]
    )
    ids.set(material.name, result.rows[0].id)
  }
  return ids
}

async function replaceInventory(db, rows, materialIds) {
  const warehouseIds = new Map()
  const rootIds = new Map()
  for (const row of rows) {
    if (!rootIds.has(row.warehouseName)) {
      const result = await db.query(`INSERT INTO scm.warehouses (code,name,parent_id,level,sort,status,properties,created_by) VALUES ($1,$2,NULL,1,$3,'启用',$4::jsonb,'lundu-excel-import') RETURNING id`, [`LUNDU-WH-${slugify(row.warehouseName, 'WAREHOUSE').toUpperCase()}`, row.warehouseName, rootIds.size + 1, JSON.stringify({ source: sourceName })])
      rootIds.set(row.warehouseName, result.rows[0].id)
    }
    const floorKey = `${row.warehouseName}|${row.floor}`
    if (!warehouseIds.has(floorKey)) {
      const result = await db.query(`INSERT INTO scm.warehouses (code,name,parent_id,level,sort,status,properties,created_by) VALUES ($1,$2,$3,2,$4,'启用',$5::jsonb,'lundu-excel-import') RETURNING id`, [`LUNDU-WH-AREA-${String(warehouseIds.size + 1).padStart(3, '0')}`, `${row.warehouseName}-${row.floor}`, rootIds.get(row.warehouseName), warehouseIds.size + 1, JSON.stringify({ source: sourceName, floor: row.floor })])
      warehouseIds.set(floorKey, result.rows[0].id)
    }
    const locationKey = `${floorKey}|${row.location}`
    if (!warehouseIds.has(locationKey)) {
      const result = await db.query(`INSERT INTO scm.warehouses (code,name,parent_id,level,sort,status,properties,created_by) VALUES ($1,$2,$3,3,$4,'启用',$5::jsonb,'lundu-excel-import') RETURNING id`, [`LUNDU-LOC-${String(warehouseIds.size + 1).padStart(3, '0')}`, row.location, warehouseIds.get(floorKey), warehouseIds.size + 1, JSON.stringify({ source: sourceName, location: row.location })])
      warehouseIds.set(locationKey, result.rows[0].id)
    }
    let materialId = materialIds.get(row.itemName)
    if (!materialId) {
      const code = `LUNDU-MAT-${String(materialIds.size + 1).padStart(3, '0')}`
      const result = await db.query(`INSERT INTO public.raw_materials (batch_no,name,category,created_by,properties,version) VALUES ($1,$2,$3,'lundu-excel-import',$4::jsonb,1) RETURNING id`, [code, row.itemName, materialCategoryCode(row.itemName), JSON.stringify({ source: sourceName, source_code: row.sourceCode, source_row: row.row })])
      materialId = result.rows[0].id
      materialIds.set(row.itemName, materialId)
    }
    await db.query(
      `INSERT INTO scm.inventory_batches (material_id,batch_no,warehouse_id,available_qty,locked_qty,unit,production_date,expiry_date,supplier,purchase_price,status,properties,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,NULL,NULL,'正常',$8::jsonb,'lundu-excel-import')`,
      [materialId, `LUNDU-INV-${String(row.row).padStart(3, '0')}`, warehouseIds.get(locationKey), row.availableQty, row.lockedQty, row.unit, row.productionDate, JSON.stringify({ ...row.properties, source_code: row.sourceCode, safety_stock: row.safetyStock })]
    )
  }
}
