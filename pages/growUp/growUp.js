/* ============================================================
   growUp.js — 星猫成长页
   展示: 成长指标 / 等级 / 积分历史
   ============================================================ */

const app = getApp()

Page({

  data: {
    /* ---- 成长数据 ---- */
    growData: {
      token: 0,
      wisdom: 0,
      understand: 0,
      level: 1,
      records: []
    },

    /* ---- 等级称号 ---- */
    levelTitle: '火苗萌新',
    tokenLevel:      { level: 1, title: '火苗萌新', progressInLevel: 0, needForNext: 100 },
    wisdomLevel:     { level: 1, title: '火苗萌新', progressInLevel: 0, needForNext: 100 },
    understandLevel: { level: 1, title: '火苗萌新', progressInLevel: 0, needForNext: 100 },

    /* ---- 总计 ---- */
    totalScore: 0,

    /* ---- 星星猫问候语 ---- */
    catGreeting: '喵~ 我是星猫，正在努力了解你',

    /* ---- 数字跳动效果 ---- */
    animating: false
  },

  /* ====== 生命周期 ====== */
  onLoad() {
    this._loadData()
  },

  onShow() {
    // 每次切回页面都刷新数据
    this._loadData()
  },

  /* ====== 加载本地数据 ====== */
  _loadData() {
    const growData = wx.getStorageSync('growData') || {
      token: 0, wisdom: 0, understand: 0, level: 1, records: []
    }

    const tokenLevel      = app.getLevelTitle(growData.token)
    const wisdomLevel     = app.getLevelTitle(growData.wisdom)
    const understandLevel = app.getLevelTitle(growData.understand)
    const totalScore = growData.token + growData.wisdom + growData.understand

    // 整体等级取三者最高
    const maxScore = Math.max(growData.token, growData.wisdom, growData.understand)
    const overallLevel = app.getLevelTitle(maxScore)

    this.setData({
      growData,
      levelTitle: overallLevel.title,
      tokenLevel,
      wisdomLevel,
      understandLevel,
      totalScore,
      catGreeting: this._genGreeting()
    })
  },

  /* ====== 生成星星猫个性问候 ====== */
  _genGreeting() {
    const summary = app.getMoodSummary()
    if (summary.total === 0) {
      return '喵~ 我在这里等你好久啦，快来和我说说今天的心情吧'
    }
    if (summary.dominant === 'negative') {
      return '你最近好像有点累哦，和我说说吧，我会一直陪着你的'
    }
    if (summary.dominant === 'positive') {
      return '最近你的状态超棒的！继续保持这份好心情呀~'
    }
    return '喵~ 我在努力了解你，每一天都是新故事'
  },

  /* ====== 进入聊心事页 ====== */
  onChatTap() {
    app.addGrowScore('chat')
    wx.navigateTo({
      url: '/pages/chat/chat'
    })
  },

  /* ====== Tab 切换 ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'starTalk') return
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd'
        break
      case 'moodLib':
        url = '/pages/moodLib/moodLib'
        break
      case 'people':
        url = '/pages/youMeOther/youMeOther'
        break
    }
    if (url) wx.redirectTo({ url })
  }
})
