export type UserProfile = {
  name: string
  email: string
  role: string
}

export const defaultProfile: UserProfile = {
  name: "管理员",
  email: "admin@example.com",
  role: "管理员",
}
