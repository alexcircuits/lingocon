import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
    console.log("Seeding platform updates...")

    await prisma.platformUpdate.create({
        data: {
            title: "Data Loss Apology",
            description: "We sincerely apologize for the inconvenience. Due to a deployment error, all uploaded flags and custom fonts were deleted. Please re-upload your language flags and fonts. We are taking steps to ensure this does not happen again.",
            icon: "alert-triangle",
            link: "/dashboard" // Directing them to dashboard to re-upload seems appropriate
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
