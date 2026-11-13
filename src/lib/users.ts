export type AccountRole = "admin" | "member"
export type SessionUser = { id: string; email: string; name: string; role: AccountRole }
export type Account = { id: string; name: string; email: string; role: AccountRole; active: boolean; created: string; passwordHash: string; passwordChanged?: boolean }
export type PublicAccount = Omit<Account, "passwordHash">
export function publicAccount(account: Account): PublicAccount {
  return { id: account.id, name: account.name, email: account.email, role: account.role, active: account.active, created: account.created }
}
