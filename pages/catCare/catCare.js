/* ============================================================
   catCare.js — 星猫说
   Figma 静态 UI + 本地数据注入
   头部个性问候 + 聊心事入口
   ============================================================ */

const app = getApp()

Page({

  data: {
    /* 从本地存储实时读取 */
    tokenValue: 0,
    wisdomValue: 0,
    knowYouValue: 0,
    /* 等级进度（当前等级内百分比） */
    levelProgress: 0,
    /* 等级信息 */
    totalScore: 0,
    levelTitle: '火苗萌新',
    /* 星星猫个性问候 */
    catGreeting: '喵~ 我在这里等你好久啦'
  },

  /* ====== 生命周期 ====== */
  onLoad() {
    this._loadGrowData()
  },

  onShow() {
    this._loadGrowData()
  },

  /* ====== 加载本地成长数据 ====== */
  _loadGrowData() {
    const growData = wx.getStorageSync('growData') || {
      token: 0, wisdom: 0, understand: 0, level: 1, records: []
    }

    /* 总分 = 三项合计 */
    const total = growData.token + growData.wisdom + growData.understand
    /* 等级取三项中最高分，每100分升1级 */
    const maxScore = Math.max(growData.token, growData.wisdom, growData.understand)
    const levelInfo = app.getLevelTitle(maxScore)
    /* 当前等级内进度 (0~100%) */
    const levelProgress = levelInfo.progressInLevel

    this.setData({
      tokenValue: growData.token,
      wisdomValue: growData.wisdom,
      knowYouValue: growData.understand,
      levelProgress: levelProgress,
      totalScore: total,
      levelTitle: levelInfo.title,
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

  /* ====== 和星猫聊心事 → 打开对话页 ====== */
  onChatEntry() {
    // 触发成长积分
    app.addGrowScore('chat')
    this._loadGrowData()

    wx.navigateTo({
      url: '/pages/chat/chat'
    })
  },

  /* ====== 点击说明文字跳转到成长详情页 ====== */
  onGotoGrowth() {
    wx.navigateTo({
      url: '/pages/growUp/growUp'
    })
  },

  /* ====== 输入卡片工具栏按钮 ====== */
  onImageTap() {
    wx.showToast({ title: '图片功能', icon: 'none' })
  },

  onCodeTap() {
    wx.showToast({ title: '代码功能', icon: 'none' })
  },

  onMicTap() {
    wx.showToast({ title: '语音功能', icon: 'none' })
  },

  onSendTap() {
    wx.showToast({ title: '输入后发送', icon: 'none' })
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
