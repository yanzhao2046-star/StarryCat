# StarryCat 星星猫

> Mood Recording · Spiritual Perception
> 心理情绪疗愈微信小程序 | Mood Journal & Inner Awareness

## 📖 项目简介
星星猫是面向大众的情绪感知与心理记录小程序，融合情绪日志、心灵感知、心理疏导体系。
依托儿童心理、成人情绪理论，结合弗洛姆、阿德勒《被讨厌的勇气》、罗素思想构建产品内核。

## 🛠 技术栈
微信原生小程序 | Figma 设计 | 腾讯云 CloudBase（云函数 + AI 资源包）

## 📂 目录说明
- `pages/`        业务页面（猫的房间、心情库、物品库、梦境、秘境、我的、领养等）
- `components/`   通用自定义组件（bottom-tab、comment-panel）
- `assets/`       图片、音频静态资源（Figma 设计稿导出）
- `cloudfunctions/`  CloudBase 云函数
- `utils/`        工具函数（foods、genCat、mockGenerator）
- `.codebuddy/`   设计文档存档

## ☁️ CloudBase 部署

| 资源 | 名称 | 说明 |
|------|------|------|
| 环境 ID | `cloudbase-d8gwx8su1d600bb46` | 正式版（小程序端走 `wx.cloud.DYNAMIC_CURRENT_ENV` 自动跟随） |
| 云函数 | `moodOperations` | Nodejs ≥ 18.16（控制台核对） · 心情 CRUD + 成长积分 + 猫 AI 对话 + 梦 / 位置 / 物品解读 |
| 云函数 | `genCatStyle`    | Nodejs ≥ 18.16 · 头像 → 猫风格图（当前默认 MOCK，需配 AI_API_KEY 走真 API） |
| 云函数 | `imgSecCheck`    | Nodejs ≥ 18.16 · 内容安全审核 |
| 数据库集合 | `moodRecords` | 心情记录（PRIVATE · 通过 `_openid` 隔离） |
| 数据库集合 | `growData`    | 成长积分数据（PRIVATE · 通过 `_openid` 隔离） |
| 数据库集合 | `catChat`     | 猫的对话历史（PRIVATE） |
| 静态托管 | `cloudbase-d8gwx8su1d600bb46.tcloudbaseapp.com` | 已启用 |

### ⚠️ 环境变量（云函数部署时配置）

| 变量 | 推荐值 | 用途 |
|------|--------|------|
| `AI_MOCK`     | `'false'` | `'true'` 或 `'1'` 走 MOCK（genCatStyle 返回原图当生成图） |
| `AI_API_KEY`  | 密钥串     | genCatStyle 走真实图生图时需要 |

### 🧠 AI 模型（moodOperations `chatHunyuan`）

默认走 `hunyuan-exp` 组（小程序成长计划免费 10 亿 Token），按顺序回退：

```
hunyuan-lite  →  hunyuan-standard  →  hunyuan-turbo
```

> 截至 2026-09，仅 `hunyuan-lite` 在所有成长计划环境开通。
> `hunyuan-standard` / `hunyuan-turbo` 部分环境不开通属正常（如需兜底可改成 cloudbase 主组）。

### 🗂 本地 Storage Key 表（13 个 + 3 个云集合）

| Key | 类型 | 写者 | 读者 | 备注 |
|-----|------|------|------|------|
| `catCareMessages` | 已废弃 | — | — | 旧 `pages/catCare/` 页面遗留，app.js `_cleanupLegacyStorage` 自动清 |
| `catMoodRecords` | 本地缓存 | catMoodLib | catMoodLib | 猫的心情列表（dev 模式空则注入种子） |
| `catItemLib` | 本地 | catItem | catItem | 物品库清单 |
| `catItemSandbox` | 本地 | catItem | catItem | 沙盒预览 |
| `catItemCards` | 本地 | catItem | catItem | 卡片制作台 |
| `catItemMessage` | 本地 | catItem | catItem | 猫的回信原始文本 |
| `catItemSealed` | 本地 | catItem | catItem | 已密封的物品 |
| `catItems` | 本地 | catRoom | catRoom | 房间里的物品 |
| `catItemNotes` | 本地 | catRoom | catRoom | 房间里的物品附言 |
| `catDreamNote` | 本地 | catRoom | catRoom | 梦境记录 |
| `savedPostcards` | 本地 | catRoom | catRoom | 明信片收藏 |
| `userProfile` | 本地 | catRoom | 全局 | 用户身份（id 用于 `selfOpenId` 等） |
| `catFoodStock` | 本地 | catFood | catFood | 猫粮库存 |

### 🗃 云数据库集合

| 集合 | 字段示例 | 权限 |
|------|----------|------|
| `moodRecords` | `moodEnergy`, `currentMoodType`, `tags`, `text` | PRIVATE（`_openid` 隔离） |
| `growData` | `points`, `badge`, `level` | PRIVATE |
| `catChat` | `sessionId`, `role`, `content`, `ts` | PRIVATE |

### 云函数 API（moodOperations）

调用方式: `wx.cloud.callFunction({ name: 'moodOperations', data: { action, ... } })`

#### 心情 / 成长（CRUD）

| action | 说明 | 参数 |
|--------|------|------|
| `addMood`       | 新增心情记录 | `{ data: { moodEnergy, currentMoodType, ... } }` |
| `getMoods`      | 获取记录列表 | `{ skip, limit }` |
| `getMoodDetail` | 获取单条详情 | `{ id }` |
| `deleteMood`    | 删除记录 | `{ id }` |
| `getGrowData`   | 获取成长数据 | — |
| `syncGrowData`  | 全量同步成长数据 | `{ data: {...} }` |
| `updateGrowData`| 增量更新（加分） | `{ type }` |

#### 猫 AI 对话

| action | 说明 | 参数 |
|--------|------|------|
| `chat`          | 走云端 hunyuan-exp 模型 | `{ message, catId?, history? }` |
| `dreamInterpret`| 梦的解读 | `{ dreamText }` |
| `locationInterpret` | 位置/处境解读 | `{ locationText, moodEnergy? }` |
| `itemInterpret` | 物品/卡片解读 | `{ items: [...] }` |

### 云函数 API（genCatStyle）

| action | 说明 | 参数 |
|--------|------|------|
| `genCatStyle` | 上传头像 → 猫风格图 | `{ fileID }`（云存储路径） |

### 云函数 API（imgSecCheck）

| action | 说明 | 参数 |
|--------|------|------|
| `imgSecCheck` | 内容安全审核 | `{ fileID }` |

## 🚩 当前版本
Version 2.0

核心模块：
- 情绪记录 Mood Record（`pages/catMoodLib/` + `pages/catRoom/` 心情写入）
- 心灵感知 Inner Sense（`pages/catRoom/` 梦境 / 邮件 / 物品 / 明信片）
- 秘境 Realm（`pages/realm/` 12×12 块体拼接小游戏）
- 领养猫 Adopt（`pages/catAdopt/` 上传头像 → genCatStyle）
- 厨房 / 心情库 / 物品库（`pages/catFood/`、`pages/catItem/`、`pages/catMoodLib/`）

## 🧰 dev / prod 开关

`app.js` 顶部 `const __DEV__ = true` 控制 dev 期 mock 数据注入（`mockGenerator.injectMockData`、`catMoodLib` 种子数据）。
**正式上线前请改为 `false`**。
