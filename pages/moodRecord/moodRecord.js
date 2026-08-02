// pages/moodRecord/moodRecord.js
const app = getApp()

Page({

  data: {
    nickname: 'Cyne',

    /* ---- 火苗记录数据（来自 moodAdd globalData） ---- */
    moodEnergy: 0,
    currentMoodType: '',
    eventText: '',
    shareText: '',
    shareTip: '',
    recordTime: '',

    /* ---- 统计汇总 ---- */
    recordCount: '8',
    avgHeat: '61'
  },

  onLoad(options) {
    if (options.nickname) {
      this.setData({ nickname: decodeURIComponent(options.nickname) })
    }

    /* ---- 读取 moodAdd 保存的火苗记录 ---- */
    const record = app.globalData.currentMoodRecord
    if (record) {
      this.setData({
        moodEnergy: record.moodEnergy,
        currentMoodType: record.currentMoodType,
        eventText: record.eventText,
        shareText: record.shareText,
        shareTip: record.shareTip,
        recordTime: record.recordTime || ''
      })
    }

    /* ---- 兜底：没有记录时间则用当前系统时间 ---- */
    if (!this.data.recordTime) {
      const n = new Date()
      const pad = v => v < 10 ? '0' + v : v
      this.setData({
        recordTime: n.getFullYear() + '.' + pad(n.getMonth() + 1) + '.' + pad(n.getDate()) + '.' + pad(n.getHours()) + ':' + pad(n.getMinutes())
      })
    }
  },

  /* ====== 保存 ====== */
  onSave() {
    wx.showToast({ title: '已保存', icon: 'success' })
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
    return {
      title: this.data.nickname + '的心情记录',
      path: '/pages/moodRecord/moodRecord?nickname=' + encodeURIComponent(this.data.nickname)
    }
  }

})
