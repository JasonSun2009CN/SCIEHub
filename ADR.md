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

## ADR-010 商业化模型：内置钱包 + 平台抽成
- **Status**: Accepted
- **Context**: 平台从"共享资料"转型为"资源共享/售卖"。需要轻量交易能力，但不想在 MVP 引入第三方支付网关/监管复杂度。
- **Decision**: 每个 Repository 增加 `pricing_type`（free/paid）、`price`、`currency`；新增 `orders`（含 platform_fee / seller_earning）、`purchases`、`reviews`、`wallet_transactions` 表与 User `wallet_balance`。支付流程：`POST /repos/:id/checkout` 创建待支付订单 → `POST /users/me/orders/:id/pay` 从买家钱包扣款、卖家按"价格 − 10% 平台费"入账、生成 purchase 记录解锁下载。卖家可在订单页主动退款；管理员可退款与给任意用户充值钱包。
- **Alternatives**: 接入 Stripe/支付宝等真实支付（超出 MVP 范围、需资质）；纯展示不交易（不符合"售卖"诉求）。
- **Consequences**: 交易闭环完整可演示（钱包/订单/退款/评价/流水）；真实充值与提现走管理员人工通道（`SCIEHUB_ALLOW_SELF_TOPUP=1` 仅为沙盒自充）；平台费率 `PLATFORM_FEE_RATE = 0.10` 集中定义可调；`purchases` 表唯一索引防重复购买。

## ADR-011 部署迁移：Cloudflare Workers + D1 + R2
- **Status**: Accepted
- **Context**: 目标部署到 Cloudflare，并使用 GitHub push 自动更新；原 Fastify + better-sqlite3 + 本地磁盘无法运行在 Workers 运行时。
- **Decision**: 后端改为 Cloudflare Worker + Hono；数据库改为 D1（SQL 迁移文件位于 `packages/server/migrations/`）；上传文件改为 R2；前端由 Workers Assets 托管并使用 SPA fallback。D1 无交互事务，支付/退款使用 `db.batch()` 加 SQLite trigger 保证幂等与余额检查。
- **Consequences**: 单 Worker 部署，无需 VPS/Nginx/PM2；D1 查询全部异步，数据层需保持 `one/all/run/batch` 风格；上传受 Worker 请求/内存限制，默认单文件 50MB；本地开发使用 `wrangler dev` + 本地 D1 状态。

## ADR-012 资源分类：Level + Subject + Resource Type
- **Status**: Accepted
- **Context**: 用户需要按 IG / AS / A-level 学科，以及笔记 / 练习题 / past paper 浏览和筛选资料；原来的单一分类字段无法同时表达这三个维度。
- **Decision**: Repository 增加 `level_id`（ig / as / a-level / ib / ap / other）与 `resource_type`（notes / practice / past-paper / other），保留 `category_id` 表示学科；共享常量 `LEVELS` / `CATEGORIES` / `RESOURCE_TYPES` 作为前后端唯一来源。新增 `/free` 与 `/paid` 专区，复用 Marketplace 列表并锁定 `pricingType`。
- **Consequences**: 列表筛选支持 level + subject + resource type + pricing 组合；新增分类需同步 shared 常量、D1 迁移、API 校验和前端选择器。旧数据在迁移后默认落到 `other`。

## ADR-013 免费优先 + 站外付费联系 + 社区与细粒度权限
- **Status**: Accepted
- **Context**: 产品定位调整为以免费资料为主；匿名发布和公共社区需要身份保护；平台不承担真实支付/退款风险；管理员需要按功能维度限制账号。
- **Decision**: `/free` 作为主货架，`/marketplace` 展示全部，`/paid` 为可选。免费资源直接下载；付费资源改为 `purchase_requests`：买家提交请求，卖家在 `/requests` 看到买家邮箱后线下/站外完成交易，站内 checkout/pay 返回 410。新增 `community_posts` 公共社区，支持用户名/匿名发帖。User 增加 `can_buy` / `can_publish_free` / `can_publish_paid` / `can_chat`，`is_suspended` 表示全功能封禁。
- **Consequences**: 平台不再托管付费交易与资金；付费资源的文件解锁由卖家线下交付，站内只保留联系请求和评价资格；匿名仅限免费资源，避免匿名卖家与付款纠纷；所有权限必须在 API 层校验，管理员 UI 只是入口。
