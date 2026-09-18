Mood Recording,Spiritual Perception
# StarryCat 星星猫
心理情绪疗愈微信小程序 | Mood Journal & Inner Awareness

## 📖 项目简介
星星猫是面向大众的情绪感知与心理记录小程序，融合情绪日志、心灵感知、心理疏导体系。
依托儿童心理、成人情绪理论，结合弗洛姆、阿德勒《被讨厌的勇气》、罗素思想构建产品内核。

## 🛠 技术栈
微信原生小程序 | CodeBuddy 2.0 开发 | Figma 设计 | 腾讯云 CloudBase
代码托管：GitHub

## 📂 目录说明
- pages：业务页面（情绪记录、心灵感知、设置、首页等）
- components：通用自定义组件
- assets：图片、音频静态资源
- cloudfunctions：CloudBase 云函数
- .codebuddy：设计文档存档

## ☁️ CloudBase 部署

| 资源 | 名称 | 说明 |
|------|------|------|
| 环境 ID | `cloudbase-d8gwx8su1d600bb46` | 正式版 |
| 云函数 | `moodOperations` | Nodejs18.15, 情绪记录+成长数据 CRUD |
| 数据库集合 | `moodRecords` | 心情记录（PRIVATE 权限） |
| 数据库集合 | `growData` | 成长积分数据（PRIVATE 权限） |
| 静态托管 | `cloudbase-d8gwx8su1d600bb46.tcloudbaseapp.com` | 已启用 |

### 云函数 API

调用方式: `wx.cloud.callFunction({ name: 'moodOperations', data: { action, ... } })`

| action | 说明 | 参数 |
|--------|------|------|
| `addMood` | 新增心情记录 | `{ data: { moodEnergy, currentMoodType, ... } }` |
| `getMoods` | 获取记录列表 | `{ skip, limit }` |
| `getMoodDetail` | 获取单条详情 | `{ id }` |
| `deleteMood` | 删除记录 | `{ id }` |
| `getGrowData` | 获取成长数据 | — |
| `syncGrowData` | 全量同步成长数据 | `{ data: {...} }` |
| `updateGrowData` | 增量更新（加分） | `{ type }` |

## 🚩 当前版本
Version 2.0
核心模块：情绪记录 Mood Record、心灵感知 Inner Sense
