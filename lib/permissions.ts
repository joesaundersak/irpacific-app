export type PermissionKey =
  | 'canUpload'
  | 'canManageMeetings'
  | 'canViewAllData'
  | 'canEditMilestones'
  | 'canManageRoles'
  | 'canManageUsers'
  | 'canManageActionItems'
  | 'canDeleteData'

export function hasPermission(permissions: any, key: PermissionKey): boolean {
  if (!permissions || typeof permissions !== 'object') return false
  return permissions[key] === true
}

export function getRolePermissions(roleName: string): Record<PermissionKey, boolean> {
  switch (roleName) {
    case 'Admin':
      return {
        canUpload: true,
        canManageMeetings: true,
        canViewAllData: true,
        canEditMilestones: true,
        canManageRoles: true,
        canManageUsers: true,
        canManageActionItems: true,
        canDeleteData: true,
      }
    case 'Office Manager':
      return {
        canUpload: true,
        canManageMeetings: true,
        canViewAllData: true,
        canEditMilestones: false,
        canManageRoles: false,
        canManageUsers: false,
        canManageActionItems: true,
        canDeleteData: false,
      }
    case 'PM':
      return {
        canUpload: false,
        canManageMeetings: false,
        canViewAllData: true,
        canEditMilestones: true,
        canManageRoles: false,
        canManageUsers: false,
        canManageActionItems: true,
        canDeleteData: false,
      }
    default:
      return {
        canUpload: false,
        canManageMeetings: false,
        canViewAllData: false,
        canEditMilestones: false,
        canManageRoles: false,
        canManageUsers: false,
        canManageActionItems: false,
        canDeleteData: false,
      }
  }
}
