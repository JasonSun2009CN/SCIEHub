# SCIEHub — Handoff

## 当前状态
**全部模块完成并通过验证**（生产构建 + API 端到端测试 + Headless Chrome 渲染）。采用 **Repository 模型**：用户拥有仓库、可分享进小组；加入小组需创建人审批；社区有榜单与公约。**无演示数据**——首次启动创建空库，注册后即可使用。
- 前端：12 个页面 + 深/浅主题 + shadcn/ui 组件 + TanStack Query 数据层。
- 后端：Fastify REST API、JWT 认证、multipart 上传落盘、生产静态托管 + SPA fallback。
- 迭代二新增：repos/repo_groups/group_requests/reports 表、/leaderboard、/conduct、举报按钮、加入审批。
- `npm run dev` 本地开发；`npm run build && npm start` 部署即用。

## 已确认决策
| 项 | 决策 |
| --- | --- |
| 仓库结构 | monorepo：packages/web + packages/server + packages/shared（npm workspaces） |
| 前端 | React 18 + Vite 5 + TS + Tailwind + shadcn/ui + react-icons/fa |
| 路由 | react-router-dom，history 模式（生产服务器需 SPA fallback） |
| 后端 | Node.js + Fastify + TypeScript，REST API |
| 数据库 | SQLite（better-sqlite3），单文件零配置 |
| 认证 | JWT + bcrypt，邮箱密码 |
| 数据请求 | TanStack Query（服务端状态），useState 管本地 UI 状态 |
| 上传存储 | 服务器本地磁盘目录，DB 只存相对路径，Fastify 挂载 /uploads |
| 测试 | MVP 阶段不写自动化测试，手动验证 |
| 部署 | 动态站点，单服务器部署即用；Fastify 同时托管静态产物与 /api |
| 主题 | 默认深色，CSS 变量 tokens，深/浅切换 |
| 视觉 | 背景 #0c1014、表面 #151a21、边框 #2a3038、强调 #38bdf8、成功 #34d399、错误 #f87171 |

## 运行方式
- 开发：`npm run dev` — Fastify 在 :4000，Vite dev 在 :5173（代理 /api 与 /uploads）。
- 生产：`npm run build && npm start` — Fastify 在 :4000 同时托管前端产物与 API，SPA fallback 已配置，deep-link 直达可用。
- 数据：首次启动自动建空库（无演示数据），在 /auth 注册账号即可使用。

## 项目结构
```
packages/
├── web/                # 前端
│   └── src/
│       ├── components/
│       │   ├── common/          # 通用组件（PageMeta 等）
│       │   ├── ui/              # shadcn/ui 基础组件
│       │   └── generated/       # 业务组件（Header, Footer, ResourceCard, GroupCard…）
│       ├── pages/               # 每页对应一个路由
│       ├── data/
│       │   ├── mockData.ts      # Mock 数据（Phase 1 后由 API 层取代）
│       │   └── api.ts           # TanStack Query 请求层
│       ├── layout.tsx           # 全局布局（Header + Outlet + Footer）
│       ├── routes.tsx           # 路由配置
│       ├── main.tsx
│       └── index.css            # 主题 tokens
├── server/             # 后端 Fastify + SQLite
└── shared/             # 前后端共享类型（User/Resource/Group 等）
```

## 编码规范
- 2 空格缩进，单引号
- 只用 Tailwind，不写自定义 CSS（CSS 变量除外）
- 组件文件 ≤260 行，超过拆分
- 所有导航 URL 可直达
- 图标统一 react-icons/fa，不用 emoji
- 图片用语义化占位或图标

## 下一步
从 ROADMAP Phase 0 开始：前后端脚手架 + 主题系统 + 全局布局，然后 Phase 1 数据层与认证。

## 待确认问题
无。此前 4 项（仓库结构 / 数据请求 / 上传存储 / 后端框架）均已确认，见上表。上传目录容量与备份策略留待 Phase 6 部署时定。
