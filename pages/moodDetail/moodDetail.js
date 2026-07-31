// pages/moodDetail/moodDetail.js
Page({

  data: {
    nickname: 'Cyne',
    recordCount: '8',
    record: {
      id: 0,
      date: '2026.07.14.13:59',
      mood: '超开心',
      note: '今天顺风局',
      score: '45',
      quote: '居然提前完成了作业',
      advice: '知道自己可以，是信心的小种子。'
    }
  },

  onLoad(options) {
    if (options.nickname) {
      this.setData({ nickname: decodeURIComponent(options.nickname) })
    }
    if (options.id) {
      this.loadRecord(options.id)
    }
  },

  /* ====== 加载记录数据 ====== */
  loadRecord(id) {
    const records = [
      { id: 0, date: '2026.07.14.13:59', mood: '超开心',     note: '今天顺风局',                    score: '45', quote: '居然提前完成了作业',               advice: '知道自己可以，是信心的小种子。' },
      { id: 1, date: '2026.07.13.10:30', mood: '偷偷小得意', note: '包的！太对了',                  score: '82', quote: '发现了自己的隐藏技能',             advice: '小得意也是前进的动力。' },
      { id: 2, date: '2026.07.12.15:00', mood: '认真专注',   note: '沉浸式ing，别CUE我',             score: '79', quote: '一口气看完了三章',                 advice: '专注是一种超能力。' },
      { id: 3, date: '2026.07.11.09:20', mood: '认真专注',   note: '沉浸式ing，别CUE我',             score: '79', quote: '今天效率超高',                     advice: '保持节奏，不用着急。' },
      { id: 4, date: '2026.07.10.18:00', mood: '想歇一会',   note: '退！退！退！我要躺平一会儿',       score: '98', quote: '需要给自己放个假',                 advice: '休息也是计划的一部分。' },
      { id: 5, date: '2026.07.09.14:15', mood: '烦躁生气',   note: '沉浸式ing，别CUE我',             score: '79', quote: '今天诸事不顺',                     advice: '生气就让它飘走，像云一样。' },
      { id: 6, date: '2026.07.08.11:45', mood: '认真专注',   note: '火气上来了',                    score: '45', quote: '但最终还是冷静下来了',             advice: '控制情绪的人控制局面。' },
      { id: 7, date: '2026.07.07.08:00', mood: '平和放松',   note: '岁月静好，勿扰模式 ON',          score: '100', quote: '早起看到了日出',                  advice: '每一个平静的早晨都是礼物。' },
    ]
    const r = records.find(item => item.id == id)
    if (r) {
      this.setData({ record: r })
    }
  },

  /* ====== 隐藏 ====== */
  onHide() {
    wx.showToast({ title: '已隐藏', icon: 'none' })
  },

  /* ====== 分享 ====== */
  onShare() {
    wx.showToast({ title: '分享中...', icon: 'none' })
  },

  /* ====== 底部 tab 切换 ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    const name = this.data.nickname
    const nickname = encodeURIComponent(name)
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd?nickname=' + nickname
        break
      case 'moodLib':
        url = '/pages/moodLib/moodLib?nickname=' + nickname
        break
      case 'starTalk':
        url = '/pages/catCare/catCare'
        break
      case 'people':
        url = '/pages/youMeOther/youMeOther'
        break
    }
    if (url) {
      wx.redirectTo({ url })
    }
  },

  /* ====== 分享给好友 ====== */
  onShareAppMessage() {
    const r = this.data.record
    return {
      title: this.data.nickname + '的' + r.mood + '时刻',
      path: '/pages/moodDetail/moodDetail?nickname=' + encodeURIComponent(this.data.nickname) + '&id=' + r.id
    }
  }

})
