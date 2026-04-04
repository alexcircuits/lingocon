import { vi } from "vitest"
import type { PrismaClient } from "@prisma/client"

type MockPrismaModel = {
  findUnique: ReturnType<typeof vi.fn>
  findFirst: ReturnType<typeof vi.fn>
  findMany: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  updateMany: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  deleteMany: ReturnType<typeof vi.fn>
  count: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
  aggregate: ReturnType<typeof vi.fn>
}

function createMockModel(): MockPrismaModel {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  }
}

export type MockPrisma = {
  [K in keyof PrismaClient]: MockPrismaModel
} & {
  $transaction: ReturnType<typeof vi.fn>
  $queryRaw: ReturnType<typeof vi.fn>
}

export function createMockPrisma(): MockPrisma {
  const mock = new Proxy(
    {
      $transaction: vi.fn((fn: Function) => fn(mock)),
      $queryRaw: vi.fn(),
    } as any,
    {
      get(target, prop) {
        if (prop in target) return target[prop]
        // Lazily create model mocks on access
        target[prop] = createMockModel()
        return target[prop]
      },
    }
  )
  return mock as MockPrisma
}

/**
 * Set up Prisma mock for a test file.
 * Call this at module scope, then use getMockPrisma() in tests.
 *
 * @example
 * ```ts
 * const { getMockPrisma } = setupPrismaMock()
 *
 * test("creates entry", async () => {
 *   const prisma = getMockPrisma()
 *   prisma.dictionaryEntry.create.mockResolvedValue({ id: "1", lemma: "test" })
 *   // ... test service
 * })
 * ```
 */
export function setupPrismaMock() {
  const mockPrisma = createMockPrisma()

  vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
  }))

  return {
    getMockPrisma: () => mockPrisma,
    resetMocks: () => {
      vi.clearAllMocks()
    },
  }
}
