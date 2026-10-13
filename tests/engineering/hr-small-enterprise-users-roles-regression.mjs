import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const seed = readFileSync(resolve(root, 'eiscore-hr/sql/hr_small_enterprise_users_roles_seed.sql'), 'utf8')
const doc = readFileSync(resolve(root, 'docs/engineering/HR_SMALL_ENTERPRISE_USERS_ROLES_SEED.md'), 'utf8')

assert.match(seed, /begin;[\s\S]*commit;/i)
assert.match(seed, /on conflict \(code\) do update/i)
assert.match(seed, /on conflict \(username\) do update/i)
assert.match(seed, /on conflict \(user_id, role_id\) do nothing/i)
assert.match(seed, /role_data_scopes/i)
assert.match(seed, /'123456'/g)
assert.match(seed, /本地演示账号/)
for (const name of [
  '公司总部', '行政人事中心', '研发技术中心', '生产运营中心', '供应链中心', '市场客户中心',
  '行政部', '人力资源部', '研发部', '信息化/IT部', '生产部', '质量管理部',
  '设备维护部', '采购部', '仓储物流部', '销售部', '客服部', '财务部'
]) assert.match(seed, new RegExp(name))
for (const permission of ['module:home', 'module:hr', 'app:hr_employee', 'app:hr_org', 'op:hr_employee.view', 'op:hr_org.view']) {
  assert.match(seed, new RegExp(permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}
assert.match(doc, /18 个部门各创建一组账号/)
assert.match(doc, /123456/)
console.log('PASS: small enterprise department users and roles seed is explicit and idempotent')
