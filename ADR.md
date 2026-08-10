# SCIEHub — Architecture Decision Records

格式：Status / Context / Decision / Consequences。新决策追加编号，已采纳的不轻易回退。

## ADR-001 前端技术栈
- **Status**: Accepted
- **Context**: 面向国际高中生的资料共享平台，UX 参照 GitHub 深色风格（无 Git 功能）。需要组件化、可换主题、路由直达。
- **Decision**: React 18 + Vite 5 + TypeScript + TailwindCSS + shadcn/ui（Radix）+ react-icons/fa + react-router-dom（history 模式）。
- **Consequences**: 组件复用、迭代快；shadcn/ui 原生支持 token 定制；history 模式要求生产服务器提供 SPA fallback（见 ADR-006）。

## ADR-002 后端：Node.js + Fastify + TypeScript
- **Status**: Accepted
- **Context**: 动态站点，后端从开发起即进范围；目标尽快完成全部模块并单服务器部署即用。
- **Decision**: Fastify + TypeScript 提供 REST API，与前端分离。
- **Alternatives**: Express（生态最大但性能/启动一般）；NestJS（模块化强但上手重）；Python FastAPI / Go（语言与前端不一致）。
- **Consequences**: 与前端同语言、可共享类型；Fastify 性能好、插件化（@fastify/static、@fastify/cors 等）；单进程即可托管 API 与静态产物。

## ADR-003 数据库：SQLite（better-sqlite3）
- **Status**: Accepted
- **Context**: 目标"部署到服务器即可用"；访问量在校内/小组规模，不想为数据库单独跑服务。
- **Decision**: SQLite 单文件库 + better-sqlite3 同步 API；数据访问层收口，为将来换 Postgres 留口。
- **Consequences**: 零配置、备份即拷文件；并发写能力有限但对本规模足够；换库成本被数据访问层隔离。

## ADR-004 认证：JWT（无状态）+ bcrypt
- **Status**: Accepted
- **Context**: 前后端分离的 SPA，需要简单的邮箱密码登录/注册。
- **Decision**: JWT Bearer token；密码 bcrypt 哈希；`JWT_SECRET` 走环境变量；前端 token 存 localStorage。
- **Consequences**: 无服务端会话存储、易扩展；token 无法主动吊销（后续可加黑名单）；localStorage 有 XSS 暴露风险，MVP 可接受。

## ADR-005 主题系统：CSS 变量 tokens，默认深色
- **Status**: Accepted
- **Context**: 要求 GitHub 深色设计语言，且深/浅同步适配。
- **Decision**: 颜色 token（背景 #0c1014、表面 #151a21、边框 #2a3038、强调 #38bdf8、成功 #34d399、错误 #f87171）定义为 CSS 变量，Tailwind class 策略切换，默认深色。
- **Consequences**: 换肤不重写组件；语义类（bg-surface 等）保证一致性；颜色单一来源可维护。

## ADR-006 部署：Fastify 托管静态产物 + SPA fallback
- **Status**: Accepted
- **Context**: 动态站点需单服务器部署即用；history 模式路由不能直接刷新。
- **Decision**: 生产环境 Fastify 同时服务 `/api` 与前端构建产物，对非 API 请求 fallback 返回 `index.html`；空库自动建表 + seed。
- **Consequences**: 一键 `npm start` 即可用；无需额外静态托管/反向代理配置。

## ADR-007 上传文件存储：服务器本地磁盘 + DB 存路径
- **Status**: Accepted
- **Context**: `/upload` 需要保存文件；SQLite 不适合存二进制大对象。
- **Decision**: 文件写入服务器本地目录（如 `data/uploads`），DB 仅存相对路径，Express 静态挂载 `/uploads` 供预览/下载。
- **Consequences**: 部署简单、读写快；无 CDN/对象存储（访问量大再换）；备份需同时备份数据库与上传目录。

## ADR-008 数据请求：TanStack Query
- **Status**: Accepted
- **Context**: 引入真实后端后，请求缓存/loading/错误态/重试成为刚需。
- **Decision**: 服务端数据用 TanStack Query，本地 UI 状态仍用 useState；认证 token 单独管理。
- **Consequences**: 缓存与失效策略开箱即用、代码更少；多一层运行时依赖。

## ADR-009 仓库结构：monorepo（packages/web + packages/server + packages/shared）
- **Status**: Accepted
- **Context**: 前后端同语言，需要共享类型（User/Resource/Group 等）与统一构建/启动流程。
- **Decision**: 单一 git 仓库，npm workspaces 管理 packages/web（前端）+ packages/server（后端）+ packages/shared（共享类型）。
- **Consequences**: 类型一次定义两处使用；一条命令可并行起前后端；包边界清晰，仍可独立部署。
