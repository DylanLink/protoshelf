import { redirect } from "next/navigation"
import { PrototypeLibrary } from "@/components/prototype-library"
import { getCurrentSession } from "@/lib/auth"
import { readFavorites } from "@/lib/favorites-store"
import { readFolders } from "@/lib/folders-store"
import { readProfile } from "@/lib/profile-store"
import { readPrototypes } from "@/lib/prototypes-store"
import { readRecentViews } from "@/lib/recent-views-store"

export default async function Home() {
  const session = await getCurrentSession()
  if (!session) redirect("/login")
  const [projects, storedProfile, favoriteIds, folders, recentViews] = await Promise.all([readPrototypes(), readProfile(), readFavorites(session.id), readFolders(), readRecentViews(session.id)])
  const favoriteSet = new Set(favoriteIds)
  const isBootstrapAdmin = session.id === "bootstrap-admin"
  const profile = {
    ...storedProfile,
    name: isBootstrapAdmin ? storedProfile.name : session.name,
    email: isBootstrapAdmin ? storedProfile.email : session.email,
    role: session.role === "admin" ? "管理员" : "团队成员",
  }
  const displayedProjects = projects.map((project) => ({
    ...project,
    favorite: favoriteSet.has(String(project.id)),
    ...(isBootstrapAdmin && !project.ownerId ? { owner: profile.name } : {}),
  }))
  return <PrototypeLibrary initialProjects={displayedProjects} initialFolders={folders} initialProfile={profile} initialRecentViews={recentViews} currentUser={{ ...session, name: profile.name, email: profile.email }} />
}
