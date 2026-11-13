"use client"

import { type DragEvent, FormEvent, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowUpRightIcon, BoxesIcon, CheckIcon, Clock3Icon, CopyIcon, DownloadIcon, FolderKanbanIcon,
  FileArchiveIcon, HeartIcon, HistoryIcon, LoaderCircleIcon, LogOutIcon, MenuIcon, MoreHorizontalIcon, PlusIcon,
  KeyRoundIcon, PencilIcon, RefreshCwIcon, SearchIcon, SettingsIcon, Share2Icon, Trash2Icon, UploadCloudIcon, UserPlusIcon, UsersIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { uploadPackage } from "@/lib/client-upload"
import type { UserProfile } from "@/lib/profile"
import type { ProjectFolder } from "@/lib/folders"
import type { Prototype } from "@/lib/prototypes"
import type { PublicAccount, SessionUser } from "@/lib/users"
import type { PublicApiKey } from "@/lib/api-keys"
import type { ApiUsageRecord } from "@/lib/api-usage"
import type { RecentView } from "@/lib/recent-views-store"

const nav = [
  { label: "全部原型", icon: BoxesIcon, key: "all" },
  { label: "最近查看", icon: Clock3Icon, key: "recent" },
  { label: "收藏", icon: HeartIcon, key: "favorites" },
  { label: "团队", icon: UsersIcon, key: "team" },
]

function sectionFromPath(pathname: string) {
  if (pathname === "/recent") return "recent"
  if (pathname === "/favorites") return "favorites"
  if (pathname === "/team") return "team"
  if (pathname === "/unfiled") return "unfiled"
  if (pathname.startsWith("/folders/")) return `folder:${decodeURIComponent(pathname.slice("/folders/".length))}`
  return "all"
}

function pathForSection(section: string) {
  if (section === "all") return "/"
  if (section.startsWith("folder:")) return `/folders/${encodeURIComponent(section.slice("folder:".length))}`
  return `/${section}`
}

function acceptZipFile(file: File | undefined, setFile: (file: File | null) => void, setError: (message: string) => void) {
  if (!file) return
  if (!file.name.toLowerCase().endsWith(".zip")) return setError("目前只支持 ZIP 格式")
  if (file.size > 50 * 1024 * 1024) return setError("代码包不能超过 50 MB")
  setFile(file)
  setError("")
}

export function PrototypeLibrary({ initialProjects, initialFolders, initialProfile, initialRecentViews, currentUser }: { initialProjects: Prototype[]; initialFolders: ProjectFolder[]; initialProfile: UserProfile; initialRecentViews: RecentView[]; currentUser: SessionUser }) {
  const router = useRouter()
  const pathname = usePathname()
  const [projects, setProjects] = useState(initialProjects)
  const [searchInput, setSearchInput] = useState("")
  const [query, setQuery] = useState("")
  const section = sectionFromPath(pathname)
  const [mobileNav, setMobileNav] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [apiKeysOpen, setApiKeysOpen] = useState(false)
  const [profile, setProfile] = useState(initialProfile)
  const [folders, setFolders] = useState(initialFolders)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [renameFolder, setRenameFolder] = useState<ProjectFolder | null>(null)

  function navigateToSection(nextSection: string) {
    setMobileNav(false)
    router.push(pathForSection(nextSection))
  }

  const recentViewTimes = useMemo(() => new Map(initialRecentViews.map((item) => [item.prototypeId, Date.parse(item.viewedAt)])), [initialRecentViews])
  const filtered = useMemo(() => projects.filter((project) => {
    const searchableText = [
      project.title,
      project.description,
      project.owner,
      project.code,
      ...(project.versions?.map((version) => version.filename) || []),
    ].join(" ").toLowerCase()
    const matchQuery = searchableText.includes(query.toLowerCase())
    const matchSection = section === "favorites" ? project.favorite : section === "recent" ? recentViewTimes.has(String(project.id)) : section.startsWith("folder:") ? project.folderId === section.slice(7) : section === "unfiled" ? !project.folderId : true
    return matchQuery && matchSection
  }).sort((a, b) => section === "recent" ? (recentViewTimes.get(String(b.id)) || 0) - (recentViewTimes.get(String(a.id)) || 0) : 0), [projects, query, section, recentViewTimes])

  function addPrototype(project: Prototype) {
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)])
    setDialogOpen(false)
  }

  function updatePrototype(project: Prototype) {
    setProjects((current) => current.map((item) => item.id === project.id ? project : item))
  }

  function removePrototype(id: Prototype["id"]) {
    setProjects((current) => current.filter((item) => item.id !== id))
  }

  async function movePrototype(project: Prototype, folderId?: string) {
    const response = await fetch(`/api/v1/prototypes/${project.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folderId: folderId || null }),
    })
    const result = (await response.json()) as { data?: Prototype }
    if (response.ok && result.data) updatePrototype(result.data)
  }

  async function deleteFolder(folder: ProjectFolder) {
    if (!window.confirm(`删除文件夹“${folder.name}”？其中的原型会移到未分类。`)) return
    const response = await fetch(`/api/folders/${folder.id}`, { method: "DELETE" })
    if (!response.ok) return
    setFolders((current) => current.filter((item) => item.id !== folder.id))
    setProjects((current) => current.map((project) => project.folderId === folder.id ? { ...project, folderId: undefined } : project))
    if (section === `folder:${folder.id}`) navigateToSection("all")
  }

  async function toggleFavorite(project: Prototype) {
    const nextFavorite = !project.favorite
    setProjects((current) => current.map((item) => item.id === project.id ? { ...item, favorite: nextFavorite } : item))
    const response = await fetch(`/api/favorites/${project.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ favorite: nextFavorite }),
    })
    if (!response.ok) setProjects((current) => current.map((item) => item.id === project.id ? { ...item, favorite: !nextFavorite } : item))
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/login")
    router.refresh()
  }

  const sidebarContent = (
    <>
      <div className="flex h-12 items-center gap-3 px-2 font-semibold tracking-tight"><span className="grid size-8 place-items-center rounded-lg bg-primary text-xs text-primary-foreground">P</span>ProtoShelf</div>
      <nav className="mt-8 flex flex-col gap-1">
        {nav.map((item) => <a key={item.key} href={pathForSection(item.key)} onClick={() => setMobileNav(false)} className={cn(buttonVariants({ variant: section === item.key ? "secondary" : "ghost" }), "justify-start")}><item.icon data-icon="inline-start" />{item.label}</a>)}
      </nav>
      <div className="mt-7">
        <div className="mb-2 flex items-center justify-between px-2"><span className="text-xs font-medium text-muted-foreground">项目文件夹</span><Button variant="ghost" size="icon-sm" aria-label="新建文件夹" onClick={() => { setMobileNav(false); setFolderDialogOpen(true) }}><PlusIcon /></Button></div>
        <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
          <a href="/unfiled" onClick={() => setMobileNav(false)} className={cn(buttonVariants({ variant: section === "unfiled" ? "secondary" : "ghost" }), "justify-start")}><FolderKanbanIcon data-icon="inline-start" />未分类<span className="ml-auto text-xs text-muted-foreground">{projects.filter((project) => !project.folderId).length}</span></a>
          {folders.map((folder) => <div key={folder.id} className="group/folder flex items-center"><a href={pathForSection(`folder:${folder.id}`)} onClick={() => setMobileNav(false)} className={cn(buttonVariants({ variant: section === `folder:${folder.id}` ? "secondary" : "ghost" }), "min-w-0 flex-1 justify-start")}><FolderKanbanIcon data-icon="inline-start" /><span className="truncate">{folder.name}</span><span className="ml-auto text-xs text-muted-foreground">{projects.filter((project) => project.folderId === folder.id).length}</span></a><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shrink-0 opacity-0 group-hover/folder:opacity-100 data-[popup-open]:opacity-100" aria-label={`${folder.name} 更多操作`} />}><MoreHorizontalIcon /></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onClick={() => setRenameFolder(folder)}><PencilIcon />修改名称</DropdownMenuItem><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void deleteFolder(folder)}><Trash2Icon />删除文件夹</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>)}
        </div>
      </div>
      <div className="absolute inset-x-4 bottom-4"><Separator className="mb-4" />{currentUser.role === "admin" ? <><Button variant="ghost" className="w-full justify-start" onClick={() => { setMobileNav(false); setApiKeysOpen(true) }}><KeyRoundIcon data-icon="inline-start" />API 密钥</Button><Button variant="ghost" className="w-full justify-start" onClick={() => { setMobileNav(false); setAccountsOpen(true) }}><SettingsIcon data-icon="inline-start" />账号管理</Button></> : null}<Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={logout}><LogOutIcon data-icon="inline-start" />退出登录</Button></div>
    </>
  )

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-background p-4 lg:block">{sidebarContent}</aside>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[min(20rem,85vw)] p-4 lg:hidden">
          <SheetTitle className="sr-only">原型库导航</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      <main className="lg:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur sm:px-8">
          <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav((value) => !value)}><MenuIcon /><span className="sr-only">打开菜单</span></Button><h1 className="text-lg font-semibold tracking-tight">原型库</h1></div>
          <Button variant="ghost" className="h-auto gap-3 px-2 py-1.5" onClick={() => setProfileOpen(true)}><span className="hidden text-sm text-muted-foreground sm:inline">{profile.name}</span><Avatar className="size-8"><AvatarFallback>{profile.name.slice(0, 1)}</AvatarFallback></Avatar></Button>
        </header>

        <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><h2 className="text-3xl font-semibold tracking-[-0.035em]">{section.startsWith("folder:") ? folders.find((folder) => folder.id === section.slice(7))?.name || "项目文件夹" : section === "unfiled" ? "未分类" : section === "recent" ? "最近查看" : section === "favorites" ? "收藏" : "团队原型"}</h2><p className="mt-2 text-sm text-muted-foreground">{section === "recent" ? "按你最近打开原型的时间倒序排列。" : "查看、分享和管理正在进行的产品想法。"}</p></div>
            <NewPrototypeDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={addPrototype} owner={profile.name} ownerId={currentUser.id} />
          </div>

          <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setQuery(searchInput.trim()) }}>
            <div className="relative max-w-xl flex-1"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="pl-9" placeholder="搜索原型名称、代码包、创建人或 Code…" aria-label="搜索原型名称、代码包名称、创建人名称或原型 Code" /></div>
            <Button type="submit" variant="outline"><SearchIcon data-icon="inline-start" />搜索</Button>
          </form>

          <p className="mt-7 text-sm text-muted-foreground">{filtered.length} 个原型</p>
          <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => <PrototypeCard key={project.id} project={project} folders={folders} onMove={(folderId) => void movePrototype(project, folderId)} onUpdated={updatePrototype} onDeleted={() => removePrototype(project.id)} onFavorite={() => void toggleFavorite(project)} />)}
          </div>
          {filtered.length === 0 ? <div className="grid min-h-72 place-items-center text-center"><div><FolderKanbanIcon className="mx-auto size-8 text-muted-foreground" /><p className="mt-4 font-medium">没有找到匹配的原型</p><p className="mt-1 text-sm text-muted-foreground">试试更换搜索关键词。</p></div></div> : null}
        </div>
      </main>
      <FolderDialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen} onCreated={(folder) => { setFolders((current) => [...current, folder]); navigateToSection(`folder:${folder.id}`) }} />
      <RenameFolderDialog folder={renameFolder} onOpenChange={(nextOpen) => { if (!nextOpen) setRenameFolder(null) }} onRenamed={(folder) => { setFolders((current) => current.map((item) => item.id === folder.id ? folder : item)); setRenameFolder(null) }} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} onChangePassword={() => { setProfileOpen(false); setPasswordOpen(true) }} profile={profile} onSaved={(saved) => { setProfile(saved); setProjects((current) => current.map((project) => project.ownerId === currentUser.id || (currentUser.id === "bootstrap-admin" && !project.ownerId) ? { ...project, ownerId: currentUser.id, owner: saved.name } : project)) }} />
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      {currentUser.role === "admin" ? <ApiKeysDialog open={apiKeysOpen} onOpenChange={setApiKeysOpen} /> : null}
      {currentUser.role === "admin" ? <AccountsDialog open={accountsOpen} onOpenChange={setAccountsOpen} currentUserId={currentUser.id} /> : null}
    </div>
  )
}

function FolderDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (folder: ProjectFolder) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: new FormData(form).get("name") }) })
      const result = (await response.json()) as { data?: ProjectFolder; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "创建失败")
      onCreated(result.data); form.reset(); onOpenChange(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建失败")
    } finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm"><form onSubmit={submit}><DialogHeader><DialogTitle>新建项目文件夹</DialogTitle><DialogDescription>把同一项目的多个原型集中放在一起。</DialogDescription></DialogHeader><Field className="my-6"><FieldLabel htmlFor="folder-name">文件夹名称</FieldLabel><Input id="folder-name" name="name" maxLength={50} autoFocus required />{error ? <p className="text-xs text-destructive">{error}</p> : null}</Field><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "创建中…" : "创建文件夹"}</Button></DialogFooter></form></DialogContent></Dialog>
}

function RenameFolderDialog({ folder, onOpenChange, onRenamed }: { folder: ProjectFolder | null; onOpenChange: (open: boolean) => void; onRenamed: (folder: ProjectFolder) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!folder) return
    const name = String(new FormData(event.currentTarget).get("name") || "").trim()
    setSaving(true); setError("")
    try {
      const response = await fetch(`/api/folders/${folder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      const result = (await response.json()) as { data?: ProjectFolder; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "修改失败")
      onRenamed(result.data)
    } catch (renameError) { setError(renameError instanceof Error ? renameError.message : "修改失败") }
    finally { setSaving(false) }
  }
  return <Dialog open={Boolean(folder)} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-sm"><form onSubmit={submit}><DialogHeader><DialogTitle>修改文件夹名称</DialogTitle><DialogDescription>文件夹内的原型不会受到影响。</DialogDescription></DialogHeader><Field className="my-6"><FieldLabel htmlFor="rename-folder-name">文件夹名称</FieldLabel><Input key={folder?.id} id="rename-folder-name" name="name" defaultValue={folder?.name} maxLength={50} autoFocus required />{error ? <p className="text-xs text-destructive">{error}</p> : null}</Field><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存名称"}</Button></DialogFooter></form></DialogContent></Dialog>
}

function ApiCodeSection({ title, code, description, copyLabel }: { title: string; code: string; description: string; copyLabel: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border p-4">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="relative min-w-0">
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-muted p-4 pr-12 font-mono text-xs leading-5 text-foreground">{code}</pre>
        <Button type="button" size="icon-sm" variant="outline" className="absolute right-2 top-2" aria-label={copyLabel} onClick={() => void navigator.clipboard.writeText(code)}><CopyIcon /></Button>
      </div>
    </section>
  )
}

function ApiKeysDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const usagePageSize = 10
  const [keys, setKeys] = useState<PublicApiKey[]>([])
  const [usage, setUsage] = useState<ApiUsageRecord[]>([])
  const [usagePage, setUsagePage] = useState(1)
  const [secret, setSecret] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setUsagePage(1)
      setSecret("")
      setError("")
      try {
        const [keysResponse, usageResponse] = await Promise.all([
          fetch("/api/api-keys", { cache: "no-store" }),
          fetch("/api/api-keys/usage", { cache: "no-store" }),
        ])
        const keysResult = (await keysResponse.json()) as { data?: PublicApiKey[]; error?: string }
        const usageResult = (await usageResponse.json()) as { data?: ApiUsageRecord[]; error?: string }
        if (!keysResponse.ok || !keysResult.data) throw new Error(keysResult.error || "加载密钥失败")
        if (!usageResponse.ok || !usageResult.data) throw new Error(usageResult.error || "加载调用记录失败")
        if (!cancelled) { setKeys(keysResult.data); setUsage(usageResult.data) }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "加载密钥失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [open])

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    setSaving(true)
    setError("")
    setSecret("")
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: new FormData(form).get("name") }),
      })
      const result = (await response.json()) as { data?: PublicApiKey; secret?: string; error?: string }
      if (!response.ok || !result.data || !result.secret) throw new Error(result.error || "创建密钥失败")
      setKeys((current) => [...current, result.data!])
      setSecret(result.secret)
      form.reset()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建密钥失败")
    } finally {
      setSaving(false)
    }
  }

  async function revokeKey(id: string) {
    const response = await fetch(`/api/api-keys/${id}`, { method: "DELETE" })
    if (!response.ok) return setError("撤销密钥失败")
    setKeys((current) => current.filter((key) => key.id !== id))
  }

  async function refreshUsage() {
    const response = await fetch("/api/api-keys/usage", { cache: "no-store" })
    const result = (await response.json()) as { data?: ApiUsageRecord[]; error?: string }
    if (!response.ok || !result.data) return setError(result.error || "刷新调用记录失败")
    setUsage(result.data)
    setUsagePage(1)
  }

  const appOrigin = typeof window === "undefined" ? "https://YOUR_DOMAIN" : window.location.origin
  const example = `curl -X PATCH ${appOrigin}/api/v1/prototypes/PROTO-A1B2C3D4 \\\n  -H "Authorization: Bearer <API_KEY>" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"新的原型名称"}'`
  const mcpConfig = `{"mcpServers":{"protoshelf":{"url":"${appOrigin}/api/mcp","headers":{"Authorization":"Bearer <API_KEY>"}}}}`
  const usagePageCount = Math.max(1, Math.ceil(usage.length / usagePageSize))
  const pagedUsage = usage.slice((usagePage - 1) * usagePageSize, usagePage * usagePageSize)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle>API 密钥管理</DialogTitle>
          <DialogDescription>为 AI、MCP 客户端和自动化工具创建安全的访问凭证。</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[68vh] flex-col gap-6 overflow-y-auto px-6 py-5">
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">创建新密钥</h3>
              <p className="mt-1 text-xs text-muted-foreground">用用途命名，方便后续识别和撤销。</p>
            </div>
            <form onSubmit={createKey}>
              <Field orientation="horizontal">
                <Input name="name" placeholder="例如：Claude 更新原型" maxLength={50} required />
                <Button type="submit" disabled={saving}><PlusIcon data-icon="inline-start" />{saving ? "创建中…" : "创建密钥"}</Button>
              </Field>
            </form>
          </section>

          {secret ? (
            <section className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-4">
              <div>
                <h3 className="text-sm font-medium">密钥已创建</h3>
                <p className="mt-1 text-xs text-muted-foreground">请立即复制。关闭弹窗后将无法再次查看完整密钥。</p>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg border bg-background px-3 py-2 text-xs">{secret}</code>
                <Button type="button" size="icon" variant="outline" aria-label="复制密钥" onClick={() => void navigator.clipboard.writeText(secret)}><CopyIcon /></Button>
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">已有密钥</h3>
            <div className="flex flex-col gap-2">
              {loading ? (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">加载中…</p>
              ) : keys.length === 0 ? (
                <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">还没有 API 密钥</p>
              ) : keys.map((key) => (
                <div key={key.id} className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{key.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{key.prefix} · {new Date(key.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive" onClick={() => void revokeKey(key.id)}>撤销</Button>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <ApiCodeSection title="MCP 连接配置" code={mcpConfig} copyLabel="复制 MCP 配置" description={`远程地址为 ${appOrigin}/api/mcp，请将 <API_KEY> 替换为创建的密钥。上传本地 ZIP 时先调用 protoshelf_prepare_upload。`} />
          <ApiCodeSection title="REST API 调用示例" code={example} copyLabel="复制 REST API 示例" description="支持查询、创建、更新、删除原型及创建历史版本。" />

          <Separator />

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">调用记录</h3>
                <p className="mt-1 text-xs text-muted-foreground">最多保留最近 500 次 REST API 与 MCP 调用，不记录密钥明文和请求正文。</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void refreshUsage()}><RefreshCwIcon data-icon="inline-start" />刷新</Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              {usage.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">暂无调用记录</p>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>时间</TableHead><TableHead>密钥</TableHead><TableHead>调用</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
                  <TableBody>{pagedUsage.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(record.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</TableCell>
                      <TableCell><p className="max-w-36 truncate text-sm font-medium">{record.keyName}</p><p className="max-w-36 truncate font-mono text-xs text-muted-foreground">{record.keyPrefix}</p></TableCell>
                      <TableCell><p className="max-w-64 truncate text-sm">{record.operation}</p><p className="text-xs text-muted-foreground">{record.method}</p></TableCell>
                      <TableCell><Badge variant={record.status < 400 ? "secondary" : "destructive"}>{record.status}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </div>
            {usage.length > usagePageSize ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">第 {usagePage} / {usagePageCount} 页 · 共 {usage.length} 条</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={usagePage === 1} onClick={() => setUsagePage((page) => Math.max(1, page - 1))}>上一页</Button>
                  <Button type="button" variant="outline" size="sm" disabled={usagePage === usagePageCount} onClick={() => setUsagePage((page) => Math.min(usagePageCount, page + 1))}>下一页</Button>
                </div>
              </div>
            ) : null}
          </section>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccountsDialog({ open, onOpenChange, currentUserId }: { open: boolean; onOpenChange: (open: boolean) => void; currentUserId: string }) {
  const [accounts, setAccounts] = useState<PublicAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [resetAccount, setResetAccount] = useState<PublicAccount | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoading(true); setError(""); setSuccess("")
      try {
        const response = await fetch("/api/users", { cache: "no-store" })
        const result = (await response.json()) as { data?: PublicAccount[]; error?: string }
        if (!response.ok || !result.data) throw new Error(result.error || "加载账号失败")
        if (!cancelled) setAccounts(result.data)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "加载账号失败")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [open])

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("")
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password"), role: "member" }) })
      const result = (await response.json()) as { data?: PublicAccount; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "创建失败")
      setAccounts((current) => [...current.filter((account) => account.id !== result.data!.id), result.data!])
      form.reset()
      setSuccess(`账号 ${result.data.email} 已创建，可立即登录`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "创建失败")
    } finally {
      setSaving(false)
    }
  }

  async function updateAccount(id: string, changes: { active?: boolean; role?: "admin" | "member" }) {
    setError("")
    const response = await fetch(`/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) })
    const result = (await response.json()) as { data?: PublicAccount; error?: string }
    if (!response.ok || !result.data) return setError(result.error || "更新失败")
    setAccounts((current) => current.map((account) => account.id === id ? result.data! : account))
  }

  async function deleteAccount(id: string) {
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" })
    const result = (await response.json()) as { error?: string }
    if (!response.ok) return setError(result.error || "删除失败")
    setAccounts((current) => current.filter((account) => account.id !== id)); setConfirmDelete(null)
  }

  return <><Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl">
    <DialogHeader><DialogTitle>账号管理</DialogTitle><DialogDescription>创建团队登录账号，并管理账号权限和可用状态。</DialogDescription></DialogHeader>
    <form onSubmit={createAccount}><FieldGroup className="my-4 sm:grid sm:grid-cols-3"><Field><FieldLabel htmlFor="account-name">姓名</FieldLabel><Input id="account-name" name="name" required /></Field><Field><FieldLabel htmlFor="account-email">邮箱</FieldLabel><Input id="account-email" name="email" type="email" required /></Field><Field><FieldLabel htmlFor="account-password">初始密码</FieldLabel><Input id="account-password" name="password" type="password" minLength={8} placeholder="至少 8 位" required /></Field></FieldGroup><Button type="submit" disabled={saving}><UserPlusIcon data-icon="inline-start" />{saving ? "创建中…" : "创建成员账号"}</Button></form>
    <Separator />
    <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">{loading ? <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p> : accounts.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">暂无账号</p> : accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate font-medium">{account.name}</span><Badge variant={account.role === "admin" ? "default" : "secondary"}>{account.role === "admin" ? "管理员" : "成员"}</Badge>{!account.active ? <Badge variant="outline">已停用</Badge> : null}</div><p className="truncate text-xs text-muted-foreground">{account.email}</p></div><div className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label={`重置 ${account.name} 的密码`} onClick={() => setResetAccount(account)}><KeyRoundIcon /></Button>{account.id !== currentUserId ? <><Button size="sm" variant="outline" onClick={() => updateAccount(account.id, { role: account.role === "admin" ? "member" : "admin" })}>{account.role === "admin" ? "设为成员" : "设为管理员"}</Button><Button size="sm" variant="outline" onClick={() => updateAccount(account.id, { active: !account.active })}>{account.active ? "停用" : "启用"}</Button><Button size="icon-sm" variant="ghost" aria-label={`删除 ${account.name}`} onClick={() => setConfirmDelete(account.id)}><Trash2Icon /></Button></> : <Badge variant="outline">当前账号</Badge>}</div></div>)}</div>
    {confirmDelete ? <div className="rounded-lg border p-3 text-sm"><p>确认删除这个账号？该成员将无法再登录。</p><div className="mt-3 flex gap-2"><Button size="sm" variant="destructive" onClick={() => deleteAccount(confirmDelete)}>确认删除</Button><Button size="sm" variant="outline" onClick={() => setConfirmDelete(null)}>取消</Button></div></div> : null}
    {success ? <p className="text-xs text-muted-foreground">{success}</p> : null}{error ? <p className="text-xs text-destructive">{error}</p> : null}<DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>完成</Button></DialogFooter>
  </DialogContent></Dialog><AdminResetPasswordDialog account={resetAccount} onOpenChange={(nextOpen) => { if (!nextOpen) setResetAccount(null) }} /></>
}

function AdminResetPasswordDialog({ account, onOpenChange }: { account: PublicAccount | null; onOpenChange: (open: boolean) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!account) return
    const form = event.currentTarget
    const data = new FormData(form)
    const password = String(data.get("password") || "")
    if (password !== data.get("confirmPassword")) return setError("两次输入的新密码不一致")
    setSaving(true); setError("")
    try {
      const response = await fetch(`/api/users/${account.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })
      const result = (await response.json()) as { data?: PublicAccount; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "重置密码失败")
      form.reset(); onOpenChange(false)
    } catch (resetError) { setError(resetError instanceof Error ? resetError.message : "重置密码失败") }
    finally { setSaving(false) }
  }
  return <Dialog open={Boolean(account)} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><form onSubmit={submit}><DialogHeader><DialogTitle>重置账号密码</DialogTitle><DialogDescription>为 {account?.name}（{account?.email}）设置新密码。</DialogDescription></DialogHeader><FieldGroup className="my-6"><Field><FieldLabel htmlFor="admin-new-password">新密码</FieldLabel><Input id="admin-new-password" name="password" type="password" minLength={8} autoComplete="new-password" placeholder="至少 8 位" required /></Field><Field><FieldLabel htmlFor="admin-confirm-password">确认新密码</FieldLabel><Input id="admin-confirm-password" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></Field>{error ? <p className="text-xs text-destructive">{error}</p> : null}</FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "重置中…" : "重置密码"}</Button></DialogFooter></form></DialogContent></Dialog>
}

function PrototypeCard({ project, folders, onMove, onFavorite, onUpdated, onDeleted }: { project: Prototype; folders: ProjectFolder[]; onMove: (folderId?: string) => void; onFavorite: () => void; onUpdated: (project: Prototype) => void; onDeleted: () => void }) {
  const previewUrl = project.previewUrl || (project.packageUrl ? `/preview/${project.id}/` : undefined)
  const [shareCopied, setShareCopied] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)

  async function copyShareLink() {
    if (!previewUrl) return
    const shareUrl = new URL(previewUrl, window.location.origin).toString()
    await navigator.clipboard.writeText(shareUrl)
    setShareCopied(true)
    window.setTimeout(() => setShareCopied(false), 2000)
  }

  return (
    <Card className="group overflow-hidden py-0 transition-shadow hover:shadow-md">
      <Preview tone={project.tone} title={project.title} href={previewUrl} />
      <CardHeader className="px-5 pt-5"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-base">{project.title}</CardTitle><p className="mt-1.5 line-clamp-1 text-sm text-muted-foreground">{project.description}</p></div><Button variant="ghost" size="icon-sm" onClick={onFavorite} aria-label={project.favorite ? "取消收藏" : "收藏"}><HeartIcon className={cn(project.favorite && "fill-current")} /></Button></div></CardHeader>
      <CardContent className="px-5"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><Avatar className="size-6"><AvatarFallback>{project.owner.slice(0, 1)}</AvatarFallback></Avatar><span className="truncate text-xs text-muted-foreground">{project.owner}</span></div><Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 font-mono text-[11px] text-muted-foreground" title="复制原型 Code" onClick={() => void navigator.clipboard.writeText(project.code)}>{project.code}<CopyIcon className="size-3" /></Button></div></CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
        <span className="text-xs text-muted-foreground">更新于 <RelativeTime value={project.updated} /></span>
        <div className="flex items-center gap-1">
          {previewUrl ? <Button variant="ghost" size="icon-sm" aria-label={shareCopied ? "分享链接已复制" : "复制分享链接"} title={shareCopied ? "链接已复制" : "复制分享链接"} onClick={() => void copyShareLink()}>{shareCopied ? <CheckIcon /> : <Share2Icon />}</Button> : null}
          <UpdatePrototypeDialog project={project} onUpdated={onUpdated} />
          <VersionHistoryDialog project={project} onUpdated={onUpdated} onDeleted={onDeleted} />
          <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="更多操作" title="更多操作" />}><MoreHorizontalIcon /></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-40"><DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setRenameOpen(true)}><PencilIcon />修改名称</DropdownMenuItem>
            <DropdownMenuSub><DropdownMenuSubTrigger><FolderKanbanIcon />移动到文件夹</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuGroup><DropdownMenuItem onClick={() => onMove(undefined)}>未分类{!project.folderId ? " · 当前" : ""}</DropdownMenuItem>{folders.map((folder) => <DropdownMenuItem key={folder.id} onClick={() => onMove(folder.id)}>{folder.name}{project.folderId === folder.id ? " · 当前" : ""}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuSubContent></DropdownMenuSub>
            {project.packageUrl ? <DropdownMenuItem render={<a href={`/api/v1/prototypes/${project.id}/download`} />}><DownloadIcon />下载代码包</DropdownMenuItem> : null}
          </DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
        </div>
      </CardFooter>
      <RenamePrototypeDialog project={project} onUpdated={onUpdated} open={renameOpen} onOpenChange={setRenameOpen} hideTrigger />
    </Card>
  )
}

function RelativeTime({ value }: { value: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return <time>时间未知</time>

  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  const label = elapsedSeconds < 60
    ? "刚刚"
    : elapsedSeconds < 3600
      ? `${Math.floor(elapsedSeconds / 60)} 分钟前`
      : elapsedSeconds < 86_400
        ? `${Math.floor(elapsedSeconds / 3600)} 小时前`
        : elapsedSeconds < 604_800
          ? `${Math.floor(elapsedSeconds / 86_400)} 天前`
          : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp)
  return <time dateTime={new Date(timestamp).toISOString()} title={new Date(timestamp).toLocaleString("zh-CN")} suppressHydrationWarning>{label}</time>
}

function RenamePrototypeDialog({ project, onUpdated, open: controlledOpen, onOpenChange, hideTrigger = false }: { project: Prototype; onUpdated: (project: Prototype) => void; open?: boolean; onOpenChange?: (open: boolean) => void; hideTrigger?: boolean }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const title = String(new FormData(form).get("title") || "").trim()
    if (!title) return setError("请输入原型名称")
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/v1/prototypes/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      })
      const result = (await response.json()) as { data?: Prototype; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "修改失败")
      onUpdated(result.data)
      setOpen(false)
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "修改失败")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) setError("") }}>
    {!hideTrigger ? <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`修改 ${project.title} 的名称`} />}><PencilIcon /></DialogTrigger> : null}
    <DialogContent className="sm:max-w-md"><form onSubmit={submit}>
      <DialogHeader><DialogTitle>修改原型名称</DialogTitle><DialogDescription>修改后会同步显示在原型列表、搜索结果和版本管理中。</DialogDescription></DialogHeader>
      <Field className="my-6" data-invalid={Boolean(error)}><FieldLabel htmlFor={`rename-${project.id}`}>原型名称</FieldLabel><Input id={`rename-${project.id}`} name="title" defaultValue={project.title} maxLength={80} autoFocus required />{error ? <p className="text-xs text-destructive">{error}</p> : null}</Field>
      <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存名称"}</Button></DialogFooter>
    </form></DialogContent>
  </Dialog>
}

function UpdatePrototypeDialog({ project, onUpdated }: { project: Prototype; onUpdated: (project: Prototype) => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    acceptZipFile(event.dataTransfer.files[0], setFile, setError)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file?.name.toLowerCase().endsWith(".zip")) return setError("请选择 ZIP 代码包")
    if (file.size > 50 * 1024 * 1024) return setError("代码包不能超过 50 MB")
    setUploading(true)
    setError("")
    try {
      const blob = await uploadPackage(file, setProgress)
      const response = await fetch(`/api/v1/prototypes/${project.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageUrl: blob.url, filename: file.name }),
      })
      const result = (await response.json()) as { data?: Prototype; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "更新失败")
      onUpdated(result.data)
      setFile(null)
      setProgress(0)
      setOpen(false)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "更新失败")
    } finally {
      setUploading(false)
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="ghost" size="sm" />}><RefreshCwIcon data-icon="inline-start" />更新</DialogTrigger>
    <DialogContent className="sm:max-w-md"><form onSubmit={submit}>
      <DialogHeader><DialogTitle>更新「{project.title}」</DialogTitle><DialogDescription>上传新的 ZIP 后会生成一个独立版本，当前版本和历史版本都可随时查看。</DialogDescription></DialogHeader>
      <Field className="my-6" data-invalid={Boolean(error)}><FieldLabel htmlFor={`update-${project.id}`}>新代码包</FieldLabel><label htmlFor={`update-${project.id}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={dropFile} className={cn("flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/25 px-5 text-center transition-colors", dragging && "border-primary bg-muted/60")}><UploadCloudIcon className="size-7 text-muted-foreground" /><span className="text-sm font-medium">{file ? file.name : dragging ? "松开即可添加 ZIP" : "选择或拖放 ZIP 文件"}</span></label><Input id={`update-${project.id}`} type="file" accept=".zip,application/zip" className="sr-only" onChange={(event) => acceptZipFile(event.target.files?.[0], setFile, setError)} />{uploading ? <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div> : null}{error ? <p className="text-xs text-destructive">{error}</p> : null}</Field>
      <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={uploading}>取消</Button><Button type="submit" disabled={!file || uploading}>{uploading ? <LoaderCircleIcon className="animate-spin" /> : <UploadCloudIcon />}{uploading ? `上传中 ${progress}%` : "上传并创建版本"}</Button></DialogFooter>
    </form></DialogContent>
  </Dialog>
}

function VersionHistoryDialog({ project, onUpdated, onDeleted }: { project: Prototype; onUpdated: (project: Prototype) => void; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirmVersion, setConfirmVersion] = useState<string | null>(null)
  const [confirmProject, setConfirmProject] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const versions = [...(project.versions || [])].reverse()

  async function deleteVersion(versionId: string) {
    setBusy(true); setError("")
    const response = await fetch(`/api/v1/prototypes/${project.id}/versions/${versionId}`, { method: "DELETE" })
    const result = (await response.json()) as { data?: Prototype; error?: string }
    setBusy(false)
    if (!response.ok || !result.data) return setError(result.error || "删除失败")
    onUpdated(result.data); setConfirmVersion(null)
  }

  async function deleteProject() {
    setBusy(true); setError("")
    const response = await fetch(`/api/v1/prototypes/${project.id}`, { method: "DELETE" })
    setBusy(false)
    if (!response.ok) return setError("删除失败，请重试")
    setOpen(false); onDeleted()
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger render={<Button variant="ghost" size="sm" />}><HistoryIcon data-icon="inline-start" />版本 {versions.length}</DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>历史版本</DialogTitle><DialogDescription>每个版本使用独立代码包运行，互不共享样式和资源。</DialogDescription></DialogHeader>
      <div className="my-2 max-h-80 space-y-2 overflow-y-auto">
        {versions.map((version) => {
          const isActive = version.id === project.activeVersionId
          const versionUrl = `/preview/${project.id}/__version/${version.id}/`
          return <div key={version.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-medium">{version.label}</span>{isActive ? <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">当前</span> : null}</div><p className="truncate text-xs text-muted-foreground">{version.filename} · <RelativeTime value={version.created} /></p></div><div className="flex shrink-0 gap-1"><Button render={<a href={versionUrl} target="_blank" rel="noreferrer" />} variant="outline" size="sm">查看</Button><Button render={<a href={`/api/v1/prototypes/${project.id}/download?version=${version.id}`} />} variant="ghost" size="icon-sm" aria-label={`下载 ${version.label}`}><DownloadIcon /></Button><Button variant="ghost" size="icon-sm" aria-label={`删除 ${version.label}`} disabled={versions.length <= 1} onClick={() => setConfirmVersion(version.id)}><Trash2Icon /></Button></div></div>
        })}
      </div>
      {confirmVersion ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>确定删除这个历史版本？代码包将永久移除。</p><div className="mt-3 flex gap-2"><Button size="sm" variant="destructive" disabled={busy} onClick={() => deleteVersion(confirmVersion)}>确认删除版本</Button><Button size="sm" variant="outline" onClick={() => setConfirmVersion(null)}>取消</Button></div></div> : null}
      {confirmProject ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm"><p>确定删除整个原型及全部历史版本？此操作无法撤销。</p><div className="mt-3 flex gap-2"><Button size="sm" variant="destructive" disabled={busy} onClick={deleteProject}>确认删除原型</Button><Button size="sm" variant="outline" onClick={() => setConfirmProject(false)}>取消</Button></div></div> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <DialogFooter className="justify-between sm:justify-between"><Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmProject(true)}><Trash2Icon />删除原型</Button><Button variant="outline" onClick={() => setOpen(false)}>完成</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function Preview({ tone, title, href }: { tone: string; title: string; href?: string }) {
  const embeddedUrl = href ? `${href}${href.includes("?") ? "&" : "?"}embed=1` : undefined
  const previewClassName = cn("relative block aspect-[16/9] overflow-hidden border-b focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset", tone === "dark" ? "bg-zinc-900" : "bg-muted/50")

  if (!href || !embeddedUrl) {
    return <div className={previewClassName}><div className="grid size-full place-items-center text-sm text-muted-foreground">暂无预览</div></div>
  }

  return (
    <a href={href} target="_blank" rel="noreferrer" className={previewClassName} aria-label={`查看原型：${title}`}>
      <iframe
        src={embeddedUrl}
        title={`${title} 预览`}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-white"
        tabIndex={-1}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none absolute bottom-4 right-4 translate-y-2 opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100")}>查看原型<ArrowUpRightIcon data-icon="inline-end" /></span>
    </a>
  )
}

function NewPrototypeDialog({ open, onOpenChange, onSubmit, owner, ownerId }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (project: Prototype) => void; owner: string; ownerId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)

  function dropFile(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault()
    setDragging(false)
    acceptZipFile(event.dataTransfer.files[0], setFile, setError)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) return setError("请选择一个 ZIP 代码包")
    if (!file.name.toLowerCase().endsWith(".zip")) return setError("目前只支持 ZIP 格式")
    if (file.size > 50 * 1024 * 1024) return setError("代码包不能超过 50 MB")

    setUploading(true)
    setError("")
    const data = new FormData(event.currentTarget)
    const title = String(data.get("title") || file.name.replace(/\.zip$/i, ""))

    try {
      const blob = await uploadPackage(file, setProgress)
      const createResponse = await fetch("/api/v1/prototypes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: `代码包 · ${file.name}`,
          framework: "待识别",
          owner,
          ownerId,
          status: "草稿",
          packageUrl: blob.url,
        }),
      })
      if (!createResponse.ok) throw new Error("代码包已上传，但保存原型记录失败")
      const created = (await createResponse.json()) as { data: Prototype }
      onSubmit(created.data)
      setFile(null)
      setProgress(0)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}><PlusIcon data-icon="inline-start" />新建原型</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>上传代码原型</DialogTitle><DialogDescription>上传前端项目 ZIP，平台会保存代码包并进入构建队列。</DialogDescription></DialogHeader>
          <FieldGroup className="my-6">
            <Field><FieldLabel htmlFor="title">原型名称</FieldLabel><Input id="title" name="title" placeholder="默认使用压缩包名称" /></Field>
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="package">代码包</FieldLabel>
              <label htmlFor="package" onDragEnter={(event) => { event.preventDefault(); setDragging(true) }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }} onDrop={dropFile} className={cn("flex min-h-36 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/25 px-5 text-center transition-colors hover:bg-muted/50", dragging && "border-primary bg-muted/60")}>
                {file ? <FileArchiveIcon className="size-7 text-foreground" /> : <UploadCloudIcon className="size-7 text-muted-foreground" />}
                <span className="text-sm font-medium">{file ? file.name : dragging ? "松开即可添加 ZIP" : "选择或拖放 ZIP 文件"}</span>
                <span className="text-xs text-muted-foreground">最大 50 MB · React / Vue / Next.js / 静态网站</span>
              </label>
              <Input id="package" name="package" type="file" accept=".zip,application/zip,application/x-zip-compressed" className="sr-only" onChange={(event) => acceptZipFile(event.target.files?.[0], setFile, setError)} />
              {file ? <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p> : null}
              {uploading ? <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div> : null}
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </Field>
          </FieldGroup>
          <DialogFooter><Button type="button" variant="outline" disabled={uploading} onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={uploading || !file}>{uploading ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <UploadCloudIcon data-icon="inline-start" />}{uploading ? `上传中 ${progress}%` : "上传代码包"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProfileDialog({ open, onOpenChange, onChangePassword, profile, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onChangePassword: () => void; profile: UserProfile; onSaved: (profile: UserProfile) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError("")
    const data = new FormData(event.currentTarget)
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), role: data.get("role") }),
      })
      const result = (await response.json()) as { data?: UserProfile; error?: string }
      if (!response.ok || !result.data) throw new Error(result.error || "保存失败")
      onSaved(result.data)
      onOpenChange(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save}>
          <DialogHeader><DialogTitle>个人资料</DialogTitle><DialogDescription>修改你在原型库中显示的资料。</DialogDescription></DialogHeader>
          <FieldGroup className="my-6">
            <Field><FieldLabel htmlFor="profile-name">姓名</FieldLabel><Input id="profile-name" name="name" defaultValue={profile.name} required /></Field>
            <Field><FieldLabel htmlFor="profile-email">邮箱</FieldLabel><Input id="profile-email" name="email" type="email" defaultValue={profile.email} required /></Field>
            <Field><FieldLabel htmlFor="profile-role">职位</FieldLabel><Input id="profile-role" name="role" defaultValue={profile.role} /></Field>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </FieldGroup>
          <DialogFooter className="justify-between sm:justify-between"><Button type="button" variant="ghost" onClick={onChangePassword}><KeyRoundIcon />修改密码</Button><div className="flex gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "保存中…" : "保存资料"}</Button></div></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const newPassword = String(data.get("newPassword") || "")
    if (newPassword !== data.get("confirmPassword")) return setError("两次输入的新密码不一致")
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/profile/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword }) })
      const result = (await response.json()) as { data?: { ok: boolean }; error?: string }
      if (!response.ok || !result.data?.ok) throw new Error(result.error || "修改密码失败")
      form.reset(); onOpenChange(false)
    } catch (changeError) { setError(changeError instanceof Error ? changeError.message : "修改密码失败") }
    finally { setSaving(false) }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><form onSubmit={submit}><DialogHeader><DialogTitle>修改密码</DialogTitle><DialogDescription>验证当前密码后设置新密码，旧密码会立即失效。</DialogDescription></DialogHeader><FieldGroup className="my-6"><Field><FieldLabel htmlFor="current-password">当前密码</FieldLabel><Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required /></Field><Field><FieldLabel htmlFor="new-password">新密码</FieldLabel><Input id="new-password" name="newPassword" type="password" minLength={8} autoComplete="new-password" placeholder="至少 8 位" required /></Field><Field><FieldLabel htmlFor="confirm-password">确认新密码</FieldLabel><Input id="confirm-password" name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></Field>{error ? <p className="text-xs text-destructive">{error}</p> : null}</FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={saving}>{saving ? "修改中…" : "修改密码"}</Button></DialogFooter></form></DialogContent></Dialog>
}
