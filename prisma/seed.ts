import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Create admin user
  const adminEmail = 'admin@example.com'
  const adminPassword = 'admin123'
  
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      console.log('Admin user already exists')
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(adminPassword, 10)
      
      // Create admin user
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'Admin User',
        }
      })
      
      console.log('Created admin user:', {
        email: admin.email,
        name: admin.name,
        id: admin.id
      })
    }

    // Create a demo user as well
    const demoEmail = 'demo@example.com'
    const demoPassword = 'demo123'
    
    const existingDemo = await prisma.user.findUnique({
      where: { email: demoEmail }
    })

    if (existingDemo) {
      console.log('Demo user already exists')
    } else {
      const hashedDemoPassword = await bcrypt.hash(demoPassword, 10)
      
      const demo = await prisma.user.create({
        data: {
          email: demoEmail,
          password: hashedDemoPassword,
          name: 'Demo User',
        }
      })
      
      console.log('Created demo user:', {
        email: demo.email,
        name: demo.name,
        id: demo.id
      })
    }

    console.log('Seed completed successfully!')
    console.log('\nYou can now login with:')
    console.log('Admin: admin@example.com / admin123')
    console.log('Demo: demo@example.com / demo123')
    
  } catch (error) {
    console.error('Error seeding database:', error)
    throw error
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })