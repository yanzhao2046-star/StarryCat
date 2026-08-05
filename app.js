/* ============================================================
   app.js — 星星猫全局入口
   CloudBase 云开发环境: bbubird-d4gczn6fs8d2e2ae3
   ============================================================ */

App({

  onLaunch() {
    // 初始化 CloudBase 云开发
    this._initCloud()
    this._initGrowData()

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
      env: 'bbubird-d4gczn6fs8d2e2ae3',
      traceUser: true
    })
    const db = wx.cloud.database()
    this.globalData.db = db
    this.globalData.cloudEnv = 'bbubird-d4gczn6fs8d2e2ae3'
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
  }
})
