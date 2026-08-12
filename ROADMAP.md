# SCIEHub Roadmap

动态网站全栈项目：React 前端 + Node/Fastify 后端 + SQLite，monorepo 管理。目标：尽快完成全部模块，部署到服务器后直接可用。MVP 阶段不写自动化测试，以手动验证为准。

**Status: ✅ All phases complete**（含 Phase 7 迭代二，verified via production build + end-to-end API tests + headless browser render）。

> Phase 0–6 为原始资源/小组模型；Phase 7 依据后续需求迭代为「Repository 模型 + 社区功能」。

## Phase 0 — 工程脚手架 ✅
- [x] monorepo 落地：packages/web + packages/server + packages/shared（npm workspaces），共享类型起步
- [x] 前端：Vite + React 18 + TS + Tailwind + shadcn/ui + react-router（history 模式）+ react-icons/fa
- [x] 后端：Fastify + TS + better-sqlite3，dev 环境前后端同源代理
- [x] 主题系统：CSS 变量 tokens（默认深色 + 浅色），Header/Footer 全局布局
- [x] 目录结构按 spec 落地，所有路由 URL 直达

## Phase 1 — 数据层与认证 ✅
- [x] SQLite schema：users / groups / group_members / resources / comments / favorites + seed 数据（13 资源 / 6 小组 / 6 用户，含真实占位文件）
- [x] 后端数据访问层 + REST API（resources / groups / users / comments / auth）
- [x] JWT 注册/登录/鉴权中间件，bcrypt 密码哈希
- [x] 前端数据请求层接入后端（TanStack Query + auth token）

## Phase 2 — 核心页面（首页 + Feed）✅
- [x] 首页 `/`：Hero、热门资料、活跃小组、平台特色、注册引导、统计条
- [x] Feed `/feed`：三栏布局、搜索、分类筛选、排序（最近/热门/最多浏览）、资料卡片 + 加载更多
- [x] 全局搜索框接入后端搜索接口（Header 与 Feed）

## Phase 3 — 资源详情 + 上传 ✅
- [x] `/resources/:id`：文件信息、操作（下载/收藏/分享）、统计、标签、评论区、相关推荐、图片预览
- [x] `/upload`：拖拽多文件上传、表单、逐文件进度条、成功跳转
- [x] 上传文件落盘 + 下载/预览接口

## Phase 4 — 小组 + 个人主页 ✅
- [x] `/groups` 列表 + 创建弹窗，`/groups/:id` 详情（资料/成员/设置 Tab，设置仅管理员 + 删除确认）
- [x] `/users/:username` 个人主页（上传/收藏/小组 Tab）
- [x] 加入/退出小组、收藏/取消收藏前后端联动

## Phase 5 — 设置 + 收尾 ✅
- [x] `/settings`：头像颜色、昵称/简介、通知偏好开关、密码修改
- [x] `/auth` 登录/注册 Tab 页（图标前缀输入框，含 demo 账号提示）
- [x] 动画打磨：卡片 hover 上移 + 阴影（200ms）、列表交错 fade-in-up（60ms 间隔）、prefers-reduced-motion

## Phase 6 — 部署上线（动态站点，部署即用）✅
- [x] 生产构建，Fastify 同时托管前端静态产物与 /api
- [x] Fastify 兜底 SPA fallback（history 模式路由直达）
- [x] 环境变量：JWT_SECRET、端口、数据库路径、上传目录
- [x] 空库自动建表 + seed，`npm start` 一键启动，按部署清单验证

## Phase 7 — Repository 模型 + 社区功能（迭代二）✅
- [x] 清理：删除根目录空文件、未使用文件、全部演示数据与 demo 用户（空库启动）
- [x] 仓库模型：用户拥有仓库，可分享进小组；Feed 展示仓库，仓库详情列出多个文件
- [x] 小组加入审批：加入需创建人同意（请求/同意/拒绝），管理员审批面板
- [x] 社区榜单：/leaderboard 按文件数量排名，同时展示总大小（文件数 + 大小）
- [x] 社区公约：/conduct 页面 + 仓库/评论举报按钮（举报存库）
- [x] 空数据启动验证：0 资源 0 用户可正常启动，各页面空状态正常

## Phase 8 — 部署就绪 + 社区完善（迭代三）✅
- [x] 移除社媒元素（Twitter/Instagram/LinkedIn），页脚仅保留真实 GitHub 仓库地址
- [x] 邮箱占用申诉：注册遇 409 时显示"Claim this email"，用该邮箱 mailto 至 jasonsun2009@yeah.net
- [x] 部署即用：根 `npm start`（prestart 自动构建）与 `npm run deploy`，空库自动建表、SPA fallback、0.0.0.0 监听
- [x] README 增加完整服务器部署步骤与生产检查清单

## Phase 9 — 管理员端 + 忘记密码（迭代四）✅
- [x] 管理员模型：users.is_admin / is_suspended + 幂等迁移；`ADMIN_EMAILS` 注册/登录自动晋升 + `promote-admin` 脚本
- [x] requireAuth 拦截封禁用户（登录与既有 token 均 403），注销用户级联清理
- [x] 管理 API：概览 / 报告列表·解决 / 用户搜索·设管理员·封禁·注销 / 仓库删除（含磁盘文件）/ 文件删除 / 评论删除，全部 requireAdmin 守卫
- [x] 管理前端：/admin 四个 Tab（Overview/Reports/Users/Repositories），Header 用户菜单"Admin console"入口，非管理员自动跳转
- [x] 忘记密码：登录页"Contact the admin to reset it" → mailto jasonsun2009@yeah.net（预填邮箱）
- [x] 验证：ADMIN_EMAILS 晋升、非管理员 403、举报→管理员删除违规仓库、封禁/解封/晋升/注销用户、邮箱仅管理员可见、promote-admin 脚本

## Phase 10 — 账号安全 + 管理员转让（迭代五）✅
- [x] 首个注册用户自动成为管理员（代码中无任何密码/哈希）；`ADMIN_EMAILS` + `promote-admin` 脚本作后备
- [x] 登录记录：login_logs 表记录每次登录成败/IP/UA；用户可在 Settings 查看登录历史
- [x] 全部登出：JWT 带 token_version，revoke 后所有旧会话失效
- [x] 注销两种：停用（30 天内登录恢复，否则定时清理删除）/ 永久删除（密码确认）
- [x] 管理员新增 + 让位（step down）；最后管理员不可移除/停用/自删
- [x] 验证：种子管理员、登录记录、revoke、停用恢复、30 天过期删除、密码删除、最后管理员守卫、让位全通过

## 验证记录
- 迭代一全链路 API 测试通过：注册/登录/鉴权、上传（multipart 落盘）、下载、收藏、评论、加入/退出小组、建组/改组/删组、越权拦截
- 迭代二全链路 API 测试通过：建仓/多文件上传/分享进小组/仓库下载、加入请求→审批→成为成员、非管理员不可见请求列表、榜单排名（按文件数+大小）、举报（含非法 reason 拦截）、非 owner 上传拦截
- 生产构建全绿（shared + server + web），无类型错误
- Headless Chrome 渲染验证：首页 / Feed / 小组 / 榜单 / 公约 / 登录 均正常挂载（空库空状态正常）
