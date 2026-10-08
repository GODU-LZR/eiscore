// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

export const publishedDb6Revision = 'b9a3831d08aeb7056ee8a5997ca8b57ae270ca08'
export const publishedDb6Path = 'database/releases/eiscore-db-v6/manifest.json'
// The freeze commit follows its source commit; the descriptor is not self-bound.
export const publishedDb6FreezeRevision = '09c2f2018daf45d20cd85e4907fdbf2315dbeb6e'
const repoRoot = resolve(import.meta.dirname, '..')
const execute = (program, args, options = {}) => {
  const result = spawnSync(program, args, {
    cwd: repoRoot, maxBuffer: 128 * 1024 * 1024, windowsHide: true, ...options
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${program} history snapshot failed`)
  return result.stdout
}

export const readPublishedDb6 = (path) => execute('git', [
  'show', `${path === publishedDb6Path ? publishedDb6FreezeRevision : publishedDb6Revision}:${path}`
]).toString('utf8')

// The snapshot stays under this repo so provenance checks can still read Git.
// SQL inventory and verification inputs come from history, never dirty manifests.
export const createPublishedDb6Snapshot = () => {
  const artifactsRoot = resolve(repoRoot, 'tests/.artifacts')
  mkdirSync(artifactsRoot, { recursive: true })
  const root = mkdtempSync(resolve(artifactsRoot, 'db6-published-'))
  const cleanup = () => rmSync(root, { recursive: true, force: true })
  try {
    const rootSql = execute('git', ['ls-tree', '--name-only', publishedDb6Revision])
      .toString('utf8').trim().split('\n').filter((path) => path.endsWith('.sql'))
    const archive = execute('git', ['archive', publishedDb6Revision, '--',
      'database', 'scripts', 'env', 'sql', 'eiscore-hr/sql', 'eiscore-materials/sql', ...rootSql
    ])
    execute('tar', ['-xf', '-', '-C', root], { input: archive })
    writeFileSync(resolve(root, publishedDb6Path), readPublishedDb6(publishedDb6Path))
    return { root, cleanup }
  } catch (error) {
    cleanup()
    throw error
  }
}
