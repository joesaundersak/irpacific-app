import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {},
    create: {
      name: 'Admin',
      permissions: {
        canUpload: true,
        canManageMeetings: true,
        canViewAllData: true,
        canEditMilestones: true,
        canManageRoles: true,
        canManageUsers: true,
        canManageActionItems: true,
        canDeleteData: true,
      },
    },
  })

  const officeManagerRole = await prisma.role.upsert({
    where: { name: 'Office Manager' },
    update: {},
    create: {
      name: 'Office Manager',
      permissions: {
        canUpload: true,
        canManageMeetings: true,
        canViewAllData: true,
        canEditMilestones: false,
        canManageRoles: false,
        canManageUsers: false,
        canManageActionItems: true,
        canDeleteData: false,
      },
    },
  })

  const pmRole = await prisma.role.upsert({
    where: { name: 'PM' },
    update: {},
    create: {
      name: 'PM',
      permissions: {
        canUpload: false,
        canManageMeetings: false,
        canViewAllData: true,
        canEditMilestones: true,
        canManageRoles: false,
        canManageUsers: false,
        canManageActionItems: true,
        canDeleteData: false,
      },
    },
  })

  // Create users. Existing users are never modified (passwords/roles are preserved on re-seed).
  // On self-hosted deployments set SEED_USER_PASSWORD to choose the initial password.
  const initialPassword = process.env.SEED_USER_PASSWORD || 'IRpacific2026!'
  const users = [
    { email: 'joe@irpacific.com', name: 'Joe Saunders', password: initialPassword, roleId: adminRole.id },
    { email: 'matt@irpacific.com', name: 'Matt Johnston', password: initialPassword, roleId: pmRole.id },
    { email: 'trisha@irpacific.com', name: 'Trisha Johnston', password: initialPassword, roleId: pmRole.id },
    { email: 'michele@irpacific.com', name: 'Michele Hoff', password: initialPassword, roleId: officeManagerRole.id },
  ]

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 12)
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        passwordHash: hash,
        roleId: u.roleId,
      },
    })
    console.log(`  User: ${u.email}`)
  }

  // System config defaults
  const configs = [
    { key: 'target_margin', value: '25' },
    { key: 'stale_lead_days', value: '30' },
  ]
  for (const c of configs) {
    await prisma.systemConfig.upsert({
      where: { key: c.key },
      update: {},
      create: c,
    })
  }

  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
