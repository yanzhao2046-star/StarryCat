/* ============================================================
   app.js — 星星猫全局入口
   CloudBase 云开发环境: cloudbase-d8gwx8su1d600bb46
   ============================================================ */

const { getFoodById, defaultStock, calcNutrition, calcBowlGram, validateBowl } = require('./utils/foods.js')

App({

  onLaunch() {
    // 初始化 CloudBase 云开发
    this._initCloud()
    this._initGrowData()
    this.getCatFoodState()  // 初始化猫粮状态

    // ===== 模拟数据注入（测试用，正式上线前删除此行） =====
    require('./utils/mockGenerator').injectMockData()
    // ===== 模拟数据注入 END =====
  },

  globalData: {},

  /* ------ 初始化云开发环境 ------ */
  _initCloud() {
    if (!wx.cloud) {
      console.error('CloudBase SDK 未加载，请使用 2.2.3 或以上基础库')
      return
    }
    wx.cloud.init({
      env: "cloudbase-d8gwx8su1d600bb46",
      traceUser: true
    })
    const db = wx.cloud.database()
    this.globalData.db = db
    this.globalData.cloudEnv = 'cloudbase-d8gwx8su1d600bb46'
  },

  /* ================================================================
     addGrowScore(type) — 全域统一加分函数
     各页面触发行为时调用，如 addGrowScore('mood_record')

     积分规则来源：星猫成长积分规则.xlsx
     同一行为每天只加分 1 次（防刷）
     ================================================================ */
  addGrowScore(type) {
    const scoreMap = {
      mood_record:  { token: 2, wisdom: 3, understand: 4 },
      share_post:   { token: 3, wisdom: 2, understand: 2 },
      view_discover:{ token: 2, wisdom: 1, understand: 1 },
      view_calendar:{ token: 2, wisdom: 1, understand: 1 },
      comment:      { token: 2, wisdom: 2, understand: 1 },
      chat:         { token: 3, wisdom: 1, understand: 1 }
    }

    const descMap = {
      mood_record:  '记录心情',
      share_post:   '分享火苗卡',
      view_discover:'查看心情小发现',
      view_calendar:'查看情绪日历',
      comment:      '发表评论/助力',
      chat:         '和星猫聊心事'
    }

    const score = scoreMap[type]
    if (!score) return

    /* ---- 防刷：同一行为每天只加 1 次 ---- */
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = 'growLimit_' + today.getTime()
    const limit = wx.getStorageSync(todayKey) || {}
    if (limit[type]) return

    /* ---- 记录当天已加分 ---- */
    limit[type] = true
    wx.setStorageSync(todayKey, limit)

    /* ---- 读取 & 更新 growData ---- */
    const growData = wx.getStorageSync('growData') || this._defaultGrowData()
    growData.token += score.token
    growData.wisdom += score.wisdom
    growData.understand += score.understand

    /* ---- 更新等级（取三者最高分计算等级） ---- */
    const maxScore = Math.max(growData.token, growData.wisdom, growData.understand)
    growData.level = Math.floor(maxScore / 100) + 1

    /* ---- 追加记录 ---- */
    const now = new Date()
    const pad = n => n < 10 ? '0' + n : n
    const timeStr = now.getFullYear() + '-' +
      pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes())

    growData.records.unshift({
      time: timeStr,
      timestamp: now.getTime(),
      type: type,
      desc: descMap[type] || type,
      token: score.token,
      wisdom: score.wisdom,
      understand: score.understand
    })

    /* ---- 保留最近 50 条记录 ---- */
    if (growData.records.length > 50) {
      growData.records = growData.records.slice(0, 50)
    }

    /* ---- 写入本地存储 ---- */
    wx.setStorageSync('growData', growData)

    /* ---- 轻提示反馈（显示实际分值） ---- */
    const tips = []
    if (score.token) tips.push('🔥 +' + score.token + ' Token')
    if (score.wisdom) tips.push('💎 +' + score.wisdom + ' 智慧')
    if (score.understand) tips.push('💜 +' + score.understand + ' 懂你')

    if (tips.length > 0) {
      wx.showToast({ title: tips.join('  '), icon: 'none', duration: 1200 })
    }
  },

  /* ================================================================
     getLevelTitle(score) — 等级称号
     每 100 分升一级
     ================================================================ */
  getLevelTitle(score) {
    const level = Math.floor(score / 100) + 1
    const titles = ['', '火苗萌新', '火苗学徒', '火苗使者', '火苗大师', '星猫知己']
    return {
      level: level,
      title: titles[level] || '星猫知己',
      // 当前等级进度 (0~100)
      progressInLevel: score % 100,
      // 升级还需分值
      needForNext: 100 - (score % 100)
    }
  },

  /* ================================================================
     getMoodSummary() — 读取最近 7 天心情，供 AI 对话用
     返回 { moods: [], dominant: 'positive'|'negative'|'neutral' }
     ================================================================ */
  getMoodSummary() {
    const records = wx.getStorageSync('moodRecords') || []
    const now = Date.now()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const recent = records.filter(r => (now - r.timestamp) <= sevenDays)

    const negativeMoods = ['有点沮丧', '烦躁生气', '想歇一会', '有点迷糊']
    const positiveMoods = ['超开心', '偷偷小得意', '充满干劲', '认真专注', '感恩', '热心劳动', '团队合作', '平和放松']

    let posCount = 0
    let negCount = 0

    recent.forEach(r => {
      if (negativeMoods.includes(r.currentMoodType)) negCount++
      if (positiveMoods.includes(r.currentMoodType)) posCount++
    })

    let dominant = 'neutral'
    if (negCount > posCount) dominant = 'negative'
    if (posCount > negCount) dominant = 'positive'

    return {
      moods: recent.map(r => ({
        mood: r.currentMoodType,
        energy: r.moodEnergy,
        time: r.time
      })),
      dominant,
      total: recent.length
    }
  },

  /* ------ 内部：默认 growData 结构 ------ */
  _defaultGrowData() {
    return {
      token: 0,
      wisdom: 0,
      understand: 0,
      level: 1,
      records: []
    }
  },

  /* ------ 内部：初始化本地 growData（不存在时创建） ------ */
  _initGrowData() {
    const existing = wx.getStorageSync('growData')
    if (!existing || typeof existing.token === 'undefined') {
      wx.setStorageSync('growData', this._defaultGrowData())
    }
  },

  /* ================================================================
     猫粮系统 (catFoodState)
     用户在 chat / mail / postcard / item / comment / mood 等互动中获得
     食物「克数」→ 进入猫粮页把碗里的食物点合成 → 猫自己吃
     猫粮袋根据总量分档（empty/low/medium/full）
     连续多天 0 克 → 猫流浪（chat 页提示）
     ================================================================ */

  /* 行为 → 克数映射（同一行为每天只算 1 次） */
  _foodRewardMap: {
    chat:          5,
    mail_reply:    3,
    postcard_reply:5,
    dream_interpret: 4,
    item_message:  2,
    comment:       1,
    mood_record:   2,
    share_post:    4,
  },

  /* 默认猫粮状态 */
  _defaultCatFoodState() {
    return {
      totalGram: 0,          // 当前猫粮营养值（原为克数，现为营养值累计）
      eatenTotal: 0,         // 累计被吃掉的营养值
      bowl: [],              // 碗中当前原料 [{foodId, gram}]（同种原料合并计数）
      stock: null,           // 各原料剩余克数 {foodId: 克}，见 foods.js
      stockDate: '',         // 库存补给日期（每日重置）
      bagLevel: 0,           // 0 empty | 1 low | 2 medium | 3 full
      lastFeedAt: 0,         // 最近一次喂食（合成猫粮）
      lastEarnAt: 0,         // 最近一次产出（互动加营养值）
      lastStrayAt: null,     // 流浪开始时间（连续 0 持续 3 天触发）
      feedCount: 0,          // 累计喂食次数
      records: []            // 最近猫粮事件 [{time, type, gram, desc}]
    }
  },

  /* 读取猫粮状态（不存在则创建；含库存初始化 + 每日补给 + 旧数据清洗） */
  getCatFoodState() {
    let s = wx.getStorageSync('catFoodState')
    if (!s || typeof s.totalGram !== 'number') {
      s = this._defaultCatFoodState()
    }
    if (!Array.isArray(s.bowl)) s.bowl = []
    if (!Array.isArray(s.records)) s.records = []

    /* 清洗：过滤掉食物库里已不存在的原料（旧版本 food_xx 等） */
    s.bowl = s.bowl.filter(b => b && getFoodById(b.foodId))

    /* 库存：初始化 + 每日补给（每天第一次进入重置为满库存） */
    const today = new Date()
    const todayKey = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate()
    if (!s.stock || s.stockDate !== todayKey) {
      s.stock = defaultStock()
      s.stockDate = todayKey
    } else {
      // 补齐新增原料
      const full = defaultStock()
      Object.keys(full).forEach(id => {
        if (typeof s.stock[id] !== 'number') s.stock[id] = full[id]
      })
    }
    wx.setStorageSync('catFoodState', s)
    return s
  },

  /* 写入猫粮状态 */
  _saveCatFoodState(s) {
    wx.setStorageSync('catFoodState', s)
  },

  /* 根据 totalGram（营养值）重新计算 bagLevel */
  _calcBagLevel(totalGram) {
    if (totalGram <= 0) return 0   // empty
    if (totalGram < 20)  return 1   // low
    if (totalGram < 80)  return 2   // medium
    return 3                        // full
  },

  /* 一次性：当天首次打开 app / 当天首次产出 +2g（防刷） */
  _ensureDailyFirstOpen() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = 'foodLimit_' + today.getTime()
    const limit = wx.getStorageSync(todayKey) || {}
    if (limit._dailyFirst) return 0
    limit._dailyFirst = true
    wx.setStorageSync(todayKey, limit)
    return 2  // 每天首次开 +2g
  },

  /* ================================================================
     addCatFood(type) — 互动产出猫粮克数
     行为 → 克数；同一行为每天只算 1 次（防刷）；
     每天第一次进入时，额外 +2g 入门奖（一次性）。
     ================================================================ */
  addCatFood(type) {
    const base = this._foodRewardMap[type]
    const state = this.getCatFoodState()

    /* ---- 防刷：同一行为每天 1 次 ---- */
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = 'foodLimit_' + today.getTime()
    const limit = wx.getStorageSync(todayKey) || {}
    let gram = 0

    if (base) {
      if (limit[type]) {
        // 已记过 → 跳过基础奖
      } else {
        gram += base
        limit[type] = true
      }
    }

    /* ---- 每天首次开 app +2g（独立开关） ---- */
    if (!limit._dailyFirst) {
      gram += 2
      limit._dailyFirst = true
    }
    wx.setStorageSync(todayKey, limit)

    if (gram <= 0) return state

    /* ---- 累加 totalGram + bagLevel + 时间戳 ---- */
    state.totalGram += gram
    state.lastEarnAt = Date.now()
    state.bagLevel = this._calcBagLevel(state.totalGram)

    /* ---- 一旦有新产出，流浪状态清除 ---- */
    state.lastStrayAt = null

    /* ---- 写事件 ---- */
    const now = new Date()
    const pad = n => n < 10 ? '0' + n : n
    const timeStr = now.getFullYear() + '-' +
      pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes())

    const descMap = {
      chat: '和星猫聊天', mail_reply: '回复邮件',
      postcard_reply: '回复明信片', item_message: '给物品留言',
      comment: '发表评论', mood_record: '记录心情',
      share_post: '分享火苗卡', _dailyFirst: '今日首次进入'
    }
    state.records.unshift({
      time: timeStr, timestamp: now.getTime(),
      type, gram, desc: descMap[type] || type
    })
    if (state.records.length > 50) state.records = state.records.slice(0, 50)

    this._saveCatFoodState(state)
    return state
  },

  /* ================================================================
     checkStray() — 流浪判定
     totalGram=0 持续 3 天 → 设 strayAt；
     已被吃空但今天还有产出 → 自动清 stray
     ================================================================ */
  checkStray() {
    const s = this.getCatFoodState()
    const now = Date.now()
    const oneDay = 24 * 60 * 60 * 1000

    if (s.totalGram > 0) {
      // 还有猫粮 → 不标记
      if (s.lastStrayAt !== null) {
        s.lastStrayAt = null
        this._saveCatFoodState(s)
      }
      return s
    }

    /* totalGram === 0 */
    // 找最近一次 totalGram > 0 的时间（lastEarnAt 或 lastFeedAt）
    const baseline = Math.max(s.lastEarnAt || 0, s.lastFeedAt || 0)
    if (!baseline) return s

    // 找最近一次清零的时间点（totalGram 变 0 的瞬间）
    // 用 lastFeedAt 之后 → 当前  的窗口判断是否持续 0
    if (s.lastStrayAt === null && (now - baseline) > oneDay) {
      // 已经空了一天以上还没产出 → 进入流浪预备
      // 严格策略：持续 3 天才标 stray
      if ((now - baseline) >= 3 * oneDay) {
        s.lastStrayAt = now
        this._saveCatFoodState(s)
      }
    }
    return s
  },

  /* ================================================================
     feedCatFromBowl() — 按配方把碗中原料合成猫粮并喂给猫
     · 校验：肉类 + 蔬菜 + 水果三类齐全，维生素至少 1 克
     · 营养值 = Σ(克数 × 原料营养值/克)，粮袋累计营养值
     返回：{ ok, reason, gram, nutrition, newTotal, bagLevel }
     ================================================================ */
  feedCatFromBowl() {
    const s = this.getCatFoodState()
    const gram = calcBowlGram(s.bowl)
    if (gram <= 0) {
      return { ok: false, reason: '碗里还没有原料', gram: 0, nutrition: 0, newTotal: s.totalGram, bagLevel: s.bagLevel }
    }

    /* 配方校验：三类 + 维生素 1 克 */
    const check = validateBowl(s.bowl)
    if (!check.ok) {
      return {
        ok: false,
        reason: '配方缺：' + check.missing.join('、'),
        gram, nutrition: 0, newTotal: s.totalGram, bagLevel: s.bagLevel
      }
    }

    /* 营养值 = Σ 克数 × 各原料营养值 */
    const nutrition = calcNutrition(s.bowl)

    s.totalGram += nutrition
    s.eatenTotal += nutrition
    s.lastFeedAt = Date.now()
    s.feedCount = (s.feedCount || 0) + 1
    s.lastStrayAt = null
    s.bagLevel = this._calcBagLevel(s.totalGram)
    s.bowl = []

    const now = new Date()
    const pad = n => n < 10 ? '0' + n : n
    const timeStr = now.getFullYear() + '-' +
      pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes())

    s.records.unshift({
      time: timeStr, timestamp: now.getTime(),
      type: 'feed', gram: nutrition,
      desc: '喂食 ' + gram + 'g → 营养值 ' + nutrition
    })
    if (s.records.length > 50) s.records = s.records.slice(0, 50)

    this._saveCatFoodState(s)
    return { ok: true, gram, nutrition, newTotal: s.totalGram, bagLevel: s.bagLevel }
  }
})
