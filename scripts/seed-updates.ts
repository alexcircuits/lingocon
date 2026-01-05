import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Seeding platform updates...")

    await prisma.platformUpdate.create({
        data: {
            title: "New Feature: Flag Generator",
            description: "You can now design custom flags for your conlangs directly in the Studio settings! Choose from multiple layouts and colors.",
            icon: "sparkles",
            link: "#"
        }
    })

    console.log("Seed complete!")
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
