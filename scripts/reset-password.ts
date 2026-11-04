// Resets a user's password (or all users' passwords).
// Usage: npm run users:reset-password -- <email|all> '<new password>'
// If no password is given, SEED_USER_PASSWORD is used.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const target = (process.argv[2] || '').trim().toLowerCase()
  const password = process.argv[3] || process.env.SEED_USER_PASSWORD || ''
  if (!target || !password) {
    console.error("Usage: npm run users:reset-password -- <email|all> '<new password>'")
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const where = target === 'all' ? {} : { email: target }
  const { count } = await prisma.user.updateMany({ where, data: { passwordHash } })

  if (count === 0) {
    const users = await prisma.user.findMany({ select: { email: true }, orderBy: { email: 'asc' } })
    console.error(`No user found for "${target}". Existing users: ${users.map((u) => u.email).join(', ') || '(none - run npm run db:seed first)'}`)
    process.exit(1)
  }
  console.log(`Password updated for ${count} user(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
