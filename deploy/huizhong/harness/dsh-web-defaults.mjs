import { mkdir } from 'node:fs/promises'

const DEFAULT_WORKSPACE = () => String(
  process.env.DSH_DEFAULT_WORKSPACE
  || `${String(process.env.DSH_HOME || process.cwd()).replace(/[\\/]$/, '')}/workspaces/${String(process.env.HARNESS_PROFILE || 'business').trim().toLowerCase() || 'business'}`
).trim()

export const name = 'eiscore-dsh-web-defaults'
export const inject = ['workspaceRegistry']

export async function apply(ctx) {
  const path = DEFAULT_WORKSPACE()
  if (!path.startsWith('/')) throw new Error('DSH_DEFAULT_WORKSPACE must be an absolute path')
  await mkdir(path, { recursive: true })
  await ctx.workspaceRegistry.create(path, process.env.DSH_DEFAULT_WORKSPACE_TITLE || '业务助手工作区')
}
