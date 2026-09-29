/**
 * Capabilities an install may use. `null` means a legacy install from before consent was recorded,
 * which falls back to what the version declares; an explicit array — including `[]` — is exactly
 * what the user consented to. (Treating `[]` like `null` turned "consented to nothing" into
 * "granted everything declared".)
 */
export function resolveGrantedPermissions(
  granted: unknown,
  declared: unknown
): string[] {
  if (Array.isArray(granted)) return granted.filter((p): p is string => typeof p === "string")
  return Array.isArray(declared) ? declared.filter((p): p is string => typeof p === "string") : []
}

export function rulesTextFromData(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const raw = (data as Record<string, unknown>).rules
  if (Array.isArray(raw)) return raw.map(String).join("\n")
  return typeof raw === "string" ? raw : ""
}
