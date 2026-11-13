# ProtoShelf

面向远程团队的在线交互原型库。前端与 API 运行在 Vercel，结构化数据和代码包存储在 Supabase。

## 技术架构

- Next.js 16、TypeScript、Tailwind CSS、shadcn/ui
- Supabase Postgres：账号、原型、版本、文件夹、收藏、最近查看、API 密钥等状态
- Supabase Storage：私有原型代码包（单包最大 50 MB）
- Vercel：Web、REST API 和远程 MCP 服务

完整环境初始化、部署、验收和回滚步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。其他 AI 或自动化工具应先阅读 [AGENTS.md](./AGENTS.md)。

## 本地运行

```bash
cp .env.example .env.local
npm ci
npm test
npm run lint
npm run dev
```

首次运行前，还需要在 Supabase SQL Editor 执行 [`supabase/bootstrap.sql`](./supabase/bootstrap.sql)。

默认演示账号：

- 邮箱：`admin@example.com`
- 密码：`prototype`

## 部署到 Vercel

将私有 GitHub 仓库导入 Vercel，配置 `.env.example` 中的全部变量后使用默认 Next.js 构建设置部署。详细步骤和上线检查见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## API

所有写接口都需要以下请求头：

```text
Authorization: Bearer <PROTOSHELF_API_KEY>
```

- `GET /api/v1/prototypes`：获取原型列表
- `POST /api/v1/prototypes`：创建原型，`title` 必填
- `PATCH /api/v1/prototypes/:id`：更新指定原型

支持字段：`title`、`description`、`framework`、`owner`、`status`、`favorite`、`previewUrl`、`packageUrl`。

## MCP

部署后的 MCP 地址：`https://YOUR_DOMAIN/api/mcp`

使用 API 密钥作为 Bearer Token。MCP 提供列出和读取原型、按永久 Code 更新原型、创建原型、添加历史版本、列出文件夹及移动原型等工具。

更新已有原型前应先查找并确认 `PROTO-XXXXXXXX` Code；代码包迭代应创建新版本，不覆盖历史版本。每个工具都包含这些操作约束，AI 客户端连接后可自动读取。

当前登录用于内部团队：服务端校验账号密码并签发 HttpOnly 签名 Cookie。团队规模扩大后，建议替换为企业 SSO 或 Auth.js。
