/**
 * Builders for Open Collective GraphQL payloads, shaped like the real
 * `account.members` response (checked against the live API on 2026-11-18).
 */

export interface MemberOverrides {
  role?: unknown
  totalDonations?: unknown
  account?: unknown
}

export function account(overrides: Record<string, unknown> = {}) {
  return {
    id: "acc_ada",
    slug: "ada",
    name: "Ada Lovelace",
    type: "INDIVIDUAL",
    imageUrl: "https://images.opencollective.com/ada/7a79991/avatar/128.png",
    isIncognito: false,
    ...overrides,
  }
}

export function member(cents: number, accountOverrides: Record<string, unknown> = {}, overrides: MemberOverrides = {}) {
  return {
    role: "BACKER",
    totalDonations: { valueInCents: cents, currency: "EUR" },
    account: account(accountOverrides),
    ...overrides,
  }
}

export function payload(nodes: unknown[], accountOverrides: Record<string, unknown> = {}) {
  return {
    data: {
      account: {
        slug: "lingocon",
        currency: "EUR",
        members: { nodes },
        ...accountOverrides,
      },
    },
  }
}
