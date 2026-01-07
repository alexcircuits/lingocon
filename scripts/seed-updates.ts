import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Seeding platform updates...")

    await prisma.platformUpdate.create({
        data: {
            title: "Custom Fonts & More",
            description: "We've added a Contact page, increased font upload limits to 15MB, improved PDF exports, and added a new 'Type' tool to format text with your custom font in the editor!",
            icon: "rocket",
            link: "/contact"
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
