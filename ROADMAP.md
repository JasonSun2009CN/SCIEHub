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

## 验证记录
- 迭代一全链路 API 测试通过：注册/登录/鉴权、上传（multipart 落盘）、下载、收藏、评论、加入/退出小组、建组/改组/删组、越权拦截
- 迭代二全链路 API 测试通过：建仓/多文件上传/分享进小组/仓库下载、加入请求→审批→成为成员、非管理员不可见请求列表、榜单排名（按文件数+大小）、举报（含非法 reason 拦截）、非 owner 上传拦截
- 生产构建全绿（shared + server + web），无类型错误
- Headless Chrome 渲染验证：首页 / Feed / 小组 / 榜单 / 公约 / 登录 均正常挂载（空库空状态正常）
