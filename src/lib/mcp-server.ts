import "server-only"
import { randomUUID } from "node:crypto"
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server"
import * as z from "zod/v4"

import { readFolders } from "@/lib/folders-store"
import { packageRef, signedPackageUpload } from "@/lib/package-objects"
import { persistPackageUrl } from "@/lib/package-storage"
import { matchesPrototypeRef, prototypeCodeForId, type Prototype } from "@/lib/prototypes"
import { readPrototypes, writePrototypes } from "@/lib/prototypes-store"

function result(data: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }], structuredContent: data }
}

function failure(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] }
}

function createProtoShelfServer() {
  const server = new McpServer({ name: "protoshelf-mcp-server", version: "1.0.0" })

  server.registerTool("protoshelf_prepare_upload", {
    title: "准备上传代码包",
    description: "上传本地 ZIP 前先调用此工具。返回一个两小时有效的 PUT 上传地址和 packageUrl；上传成功后，再把 packageUrl 传给创建原型或添加版本工具。",
    inputSchema: z.object({
      filename: z.string().min(1).max(200).refine((value) => value.toLowerCase().endsWith(".zip"), "只支持 ZIP 代码包"),
      size: z.number().int().positive().max(50 * 1024 * 1024).describe("文件字节数，最大 50 MB"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ filename }) => {
    const safeName = filename.replace(/[^\p{L}\p{N}._-]+/gu, "-")
    const path = `prototype-packages/${Date.now()}-${randomUUID()}-${safeName}`
    try {
      const signed = await signedPackageUpload(path)
      return result({ method: "PUT", uploadUrl: signed.signedUrl, packageUrl: packageRef(path), headers: { "Content-Type": "application/zip" }, expiresIn: "2 hours" })
    } catch (error) {
      return failure(error instanceof Error ? error.message : "无法准备上传")
    }
  })

  server.registerTool("protoshelf_list_prototypes", {
    title: "列出和搜索原型",
    description: "列出原型及永久 Code。更新已有原型前必须先调用此工具确认目标 Code，禁止仅凭名称猜测或创建重复原型。",
    inputSchema: z.object({ query: z.string().max(100).optional().describe("按名称、描述、负责人或 Code 模糊搜索") }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ query }) => {
    const projects = await readPrototypes()
    const needle = query?.trim().toLowerCase()
    const matches = needle ? projects.filter((project) => `${project.code} ${project.title} ${project.description} ${project.owner}`.toLowerCase().includes(needle)) : projects
    return result({ count: matches.length, prototypes: matches.map(({ id, code, title, description, framework, owner, folderId, updated, activeVersionId, versions }) => ({ id, code, title, description, framework, owner, folderId, updated, activeVersionId, versionCount: versions?.length || 0 })) })
  })

  server.registerTool("protoshelf_get_prototype", {
    title: "读取单个原型",
    description: "使用永久 Code 读取原型完整信息和历史版本。修改前应先读取，保留用户未要求变更的字段。",
    inputSchema: z.object({ code: z.string().min(1).describe("原型永久 Code，例如 PROTO-A1B2C3D4") }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ code }) => {
    const project = (await readPrototypes()).find((item) => matchesPrototypeRef(item, code))
    return project ? result({ prototype: project }) : failure(`未找到原型 ${code}。请先调用 protoshelf_list_prototypes。`)
  })

  server.registerTool("protoshelf_create_prototype", {
    title: "创建新原型",
    description: "仅在用户明确要求创建全新原型时使用。若用户说更新、修改或迭代，必须使用 protoshelf_update_prototype 或 protoshelf_add_version，禁止创建重复原型。创建后平台自动生成永久 Code。",
    inputSchema: z.object({ title: z.string().min(1).max(80), description: z.string().max(300).optional(), framework: z.string().max(40).optional(), owner: z.string().max(40).optional(), folderId: z.string().optional(), packageUrl: z.string().url().optional(), filename: z.string().max(200).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async (input) => {
    const projects = await readPrototypes()
    const id = randomUUID()
    const filename = input.filename || `${input.title}.zip`
    let packageUrl: string | undefined
    try {
      packageUrl = input.packageUrl ? await persistPackageUrl(input.packageUrl, filename) : undefined
    } catch (error) {
      return failure(error instanceof Error ? error.message : "保存代码包失败")
    }
    const versionId = packageUrl ? randomUUID() : undefined
    const createdAt = new Date().toISOString()
    const project: Prototype = { id, code: prototypeCodeForId(id), title: input.title.trim(), description: input.description || "通过 MCP 创建", framework: input.framework || "待识别", owner: input.owner || "AI", folderId: input.folderId, updated: createdAt, status: "草稿", favorite: false, tone: "blue", packageUrl, versions: packageUrl ? [{ id: versionId!, label: "v1", created: createdAt, packageUrl, filename }] : [], activeVersionId: versionId }
    projects.unshift(project)
    await writePrototypes(projects)
    return result({ prototype: project, instruction: `后续更新必须使用永久 Code ${project.code}` })
  })

  server.registerTool("protoshelf_update_prototype", {
    title: "按 Code 更新原型资料",
    description: "按永久 Code 更新已有原型的名称、描述、技术框架或负责人。只修改明确传入的字段。更新代码包不要使用此工具，应使用 protoshelf_add_version 保留历史版本。",
    inputSchema: z.object({ code: z.string().min(1), title: z.string().min(1).max(80).optional(), description: z.string().max(300).optional(), framework: z.string().max(40).optional(), owner: z.string().max(40).optional() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ code, ...changes }) => {
    const projects = await readPrototypes()
    const index = projects.findIndex((project) => matchesPrototypeRef(project, code))
    if (index < 0) return failure(`未找到原型 ${code}。请先调用 protoshelf_list_prototypes。`)
    const updates = Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined))
    projects[index] = { ...projects[index], ...updates, updated: new Date().toISOString() }
    await writePrototypes(projects)
    return result({ prototype: projects[index] })
  })

  server.registerTool("protoshelf_add_version", {
    title: "为原型添加代码版本",
    description: "更新已有原型的代码包时必须使用此工具。它会创建独立历史版本并设为当前版本，不覆盖或混用旧版本。packageUrl 必须是平台可读取的 ZIP 地址。",
    inputSchema: z.object({ code: z.string().min(1), packageUrl: z.string().url(), filename: z.string().min(1).max(200) }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, async ({ code, packageUrl, filename }) => {
    const projects = await readPrototypes()
    const index = projects.findIndex((project) => matchesPrototypeRef(project, code))
    if (index < 0) return failure(`未找到原型 ${code}。请先调用 protoshelf_list_prototypes。`)
    let storedPackageUrl: string
    try {
      storedPackageUrl = await persistPackageUrl(packageUrl, filename)
    } catch (error) {
      return failure(error instanceof Error ? error.message : "保存代码包失败")
    }
    const updatedAt = new Date().toISOString()
    const version = { id: randomUUID(), label: `v${(projects[index].versions?.length || 0) + 1}`, created: updatedAt, packageUrl: storedPackageUrl, filename }
    projects[index] = { ...projects[index], packageUrl: storedPackageUrl, activeVersionId: version.id, versions: [...(projects[index].versions || []), version], updated: updatedAt }
    await writePrototypes(projects)
    return result({ prototype: projects[index], createdVersion: version })
  })

  server.registerTool("protoshelf_list_folders", {
    title: "列出项目文件夹",
    description: "列出可用于归类原型的项目文件夹及其 ID。移动原型前先调用此工具取得准确 folderId。",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => result({ folders: await readFolders() }))

  server.registerTool("protoshelf_move_prototype", {
    title: "移动原型到文件夹",
    description: "使用永久 Code 将原型移动到指定项目文件夹。folderId 传 null 表示移回未分类。",
    inputSchema: z.object({ code: z.string().min(1), folderId: z.string().nullable() }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ code, folderId }) => {
    const projects = await readPrototypes()
    const index = projects.findIndex((project) => matchesPrototypeRef(project, code))
    if (index < 0) return failure(`未找到原型 ${code}。请先调用 protoshelf_list_prototypes。`)
    if (folderId && !(await readFolders()).some((folder) => folder.id === folderId)) return failure(`文件夹 ${folderId} 不存在。请先调用 protoshelf_list_folders。`)
    projects[index] = { ...projects[index], folderId: folderId || undefined, updated: new Date().toISOString() }
    await writePrototypes(projects)
    return result({ prototype: projects[index] })
  })

  return server
}

export const protoShelfMcpHandler = createMcpHandler(createProtoShelfServer, { legacy: "stateless", responseMode: "json" })
