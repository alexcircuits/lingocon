const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    try {
        if (!prisma.auditLog) {
            console.error('prisma.auditLog is undefined!')
            console.log('Keys on prisma:', Object.keys(prisma))
            return
        }
        const count = await prisma.auditLog.count()
        console.log('Success! AuditLog count:', count)
    } catch (e) {
        console.error('Error:', e)
    } finally {
        await prisma.$disconnect()
    }
}

main()
