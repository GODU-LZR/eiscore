export const getPermissions = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    const perms = info?.permissions
    return Array.isArray(perms) ? perms : []
  } catch (e) {
    return []
  }
}

export const hasPerm = (perm) => {
  if (!perm) return true
  return getPermissions().includes(perm)
}

export const hasAnyPerm = (permList = []) => {
  if (!permList || permList.length === 0) return true
  const perms = getPermissions()
  return permList.some((perm) => perms.includes(perm))
}

export const hasAllPerm = (permList = []) => {
  if (!permList || permList.length === 0) return true
  const perms = getPermissions()
  return permList.every((perm) => perms.includes(perm))
}
