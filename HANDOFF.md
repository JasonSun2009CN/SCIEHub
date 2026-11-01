# SCIEHub — Handoff

## 当前状态
**全部模块完成并通过验证**（生产构建 + typecheck + API 端到端测试 + Headless Chrome 渲染）。采用 **Repository 模型**，并已转型为**资源共享/售卖市场**：仓库可标价或免费，内置钱包/订单/退款/评价闭环。**无演示数据**——首次启动创建空库，注册后即可使用。
- 前端：15 个页面（新增 Checkout / Orders / Wallet）+ 深/浅主题 + shadcn/ui 组件 + TanStack Query 数据层。
- 后端：Cloudflare Workers + Hono REST API、JWT 认证、R2 上传、Workers Assets 静态托管 + SPA fallback、D1 数据库。
- 市场化（Phase 11）：Repository 定价（free/paid + ¥/$ + 销量/收入）；orders/purchases/reviews/wallet_transactions 表；钱包余额；checkout→pay 交易流；卖方/管理员退款；评价系统；`/marketplace` 定价筛选与销量/评分/价格排序；Home 市场 Hero + 热销 + 免费资源；个人主页"已购"页签；销量榜；管理端 Orders Tab + 钱包充值。
- 社区（迭代二~五）：小组加入审批、/leaderboard、/conduct、举报、管理员端、登录记录、全部登出、停用/永久删除、首个用户自动成为管理员、管理员新增/让位。
- 管理员开通（两种）：① 全新安装时第一个注册的账号即管理员；② 在 Cloudflare 设置 `ADMIN_EMAILS=邮箱`，该邮箱注册/登录自动晋升；已有管理员也可在 `/admin` → Users 晋升他人。
- 钱包充值：管理员在 `/admin` → Users 对任意用户充值（真实支付/提现不在 MVP 范围）。
- `npm run dev` 本地开发；`npm run deploy` 构建、应用 D1 迁移并部署到 Cloudflare。
- 用户手册：`docs/USER_MANUAL.md`。

## 已确认决策
| 项 | 决策 |
| --- | --- |
| 仓库结构 | monorepo：packages/web + packages/server + packages/shared（npm workspaces） |
| 前端 | React 18 + Vite 5 + TS + Tailwind + shadcn/ui + react-icons/fa |
| 路由 | react-router-dom，history 模式（生产服务器需 SPA fallback） |
| 后端 | Cloudflare Workers + Hono + TypeScript，REST API |
| 数据库 | Cloudflare D1（SQLite），SQL 迁移文件 |
| 认证 | JWT（jose）+ PBKDF2，邮箱密码 |
| 数据请求 | TanStack Query（服务端状态），useState 管本地 UI 状态 |
| 上传存储 | Cloudflare R2，DB 只存 `/uploads/<key>` |
| 测试 | MVP 阶段不写自动化测试，手动验证 |
| 部署 | Cloudflare Worker + Workers Assets；`wrangler.jsonc` 配置 D1/R2/Assets/cron |
| 主题 | 默认深色，CSS 变量 tokens，深/浅切换 |
| 视觉 | 背景 #0c1014、表面 #151a21、边框 #2a3038、强调 #38bdf8、成功 #34d399、错误 #f87171 |

## 运行方式
- 开发：`npm run dev` — `wrangler dev` 在 :8787，Vite dev 在 :5173（代理 /api 与 /uploads）。
- 生产：`npm run deploy` — 构建 shared/web、应用远程 D1 迁移、`wrangler deploy`。
- 数据：远程 D1 首次迁移后为空库（无演示数据），在 /auth 注册账号即可使用；首个账号自动成为管理员。

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
├── server/             # 后端 Hono Worker + D1 + R2（migrations/ 为 D1 迁移）
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
已完成 Cloudflare 迁移并部署到 Workers（D1 + R2 + Workers Assets）。后续：在 Dashboard 连接 GitHub Workers Builds 实现 push 自动部署、绑定自定义域名、持续补充 D1 迁移。

## 待确认问题
无。此前 4 项（仓库结构 / 数据请求 / 上传存储 / 后端框架）均已确认，见上表。上传目录容量与备份策略留待 Phase 6 部署时定。
