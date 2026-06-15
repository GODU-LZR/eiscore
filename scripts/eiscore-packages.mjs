// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const packages = [
  { name: 'eiscore-base', path: 'eiscore-base', groups: ['frontends', 'ci'] },
  { name: 'eiscore-apps', path: 'eiscore-apps', groups: ['frontends', 'ci'] },
  { name: 'eiscore-hr', path: 'eiscore-hr', groups: ['frontends', 'ci'] },
  { name: 'eiscore-materials', path: 'eiscore-materials', groups: ['frontends', 'ci'] },
  { name: 'eiscore-sales', path: 'eiscore-sales', groups: ['frontends', 'ci'] },
  { name: 'eiscore-purchase', path: 'eiscore-purchase', groups: ['frontends', 'ci'] },
  { name: 'eiscore-production', path: 'eiscore-production', groups: ['frontends', 'ci'] },
  { name: 'eiscore-quality', path: 'eiscore-quality', groups: ['frontends', 'ci'] },
  { name: 'eiscore-equipment', path: 'eiscore-equipment', groups: ['frontends', 'ci'] },
  { name: 'eiscore-decision', path: 'eiscore-decision', groups: ['frontends', 'ci'] },
  { name: 'eiscore-mobile', path: 'eiscore-mobile', groups: ['frontends', 'ci'] },
  { name: 'realtime', path: 'realtime', groups: ['runtime', 'ci'] }
]

export function selectPackages(group) {
  if (!group || group === 'all') return packages
  return packages.filter((pkg) => pkg.groups.includes(group))
}
