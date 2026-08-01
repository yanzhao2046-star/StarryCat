/* ============================================================
   growUp.js — 星猫成长页
   Figma 313_1778 UI + 原有成长逻辑
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
    overallProgress: 0
  },

  /* ====== 生命周期 ====== */
  onLoad() {
    this._loadData()
  },

  onShow() {
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

    // 总分进度：最大 1000 分
    const overallProgress = Math.min(100, Math.round((totalScore / 1000) * 100))

    this.setData({
      growData,
      levelTitle: overallLevel.title,
      tokenLevel,
      wisdomLevel,
      understandLevel,
      totalScore,
      overallProgress
    })
  },

  /* ====== 进入聊心事页 ====== */
  onChatTap() {
    wx.navigateTo({
      url: '/pages/catCare/catCare'
    })
  },

  /* ====== Tab 切换（对齐 youMeOther data-tab 值） ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'starTalk') return
    const routes = {
      moodIsland: '/pages/moodAdd/moodAdd',
      moodLib: '/pages/moodLib/moodLib',
      people: '/pages/youMeOther/youMeOther'
    }
    if (routes[tab]) wx.redirectTo({ url: routes[tab] })
  }
})
