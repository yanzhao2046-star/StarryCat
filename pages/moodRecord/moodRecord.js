// pages/moodRecord/moodRecord.js
const app = getApp()

/* ---- 12 种心情 ---- */
const MOODS = [
  { name: '超开心', icon: '/assets/moodAdd/5.png' },
  { name: '偷偷小得意', icon: '/assets/moodAdd/6.png' },
  { name: '充满干劲', icon: '/assets/moodAdd/7.png' },
  { name: '有点迷糊', icon: '/assets/moodAdd/8.png' },
  { name: '认真专注', icon: '/assets/moodAdd/9.png' },
  { name: '有点沮丧', icon: '/assets/moodAdd/10.png' },
  { name: '想歇一会', icon: '/assets/moodAdd/11.png' },
  { name: '烦躁生气', icon: '/assets/moodAdd/12.png' },
  { name: '感恩', icon: '/assets/moodAdd/tkgiving.png' },
  { name: '热爱劳动', icon: '/assets/moodAdd/labor.png' },
  { name: '团队合作', icon: '/assets/moodAdd/team.png' },
  { name: '平和放松', icon: '/assets/moodAdd/peace.png' }
]

Page({

  data: {
    nickname: 'Cyne',
    MOODS: MOODS,

    /* ---- 火苗记录数据（来自 moodAdd globalData） ---- */
    moodEnergy: 0,
    currentMoodType: '',
    eventText: '',
    shareText: '',
    shareTip: '',

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
        shareTip: record.shareTip
      })
    }
  },

  /* ====== 心情按钮点击 → 跳转 moodAdd ====== */
  onMoodTap(e) {
    const mood = e.currentTarget.dataset.mood
    const name = this.data.nickname
    wx.redirectTo({
      url: '/pages/moodAdd/moodAdd?nickname=' + encodeURIComponent(name) + '&mood=' + encodeURIComponent(mood)
    })
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
