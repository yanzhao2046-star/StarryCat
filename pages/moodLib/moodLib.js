// pages/moodLib/moodLib.js

/* =================================================================
   情绪分类映射器（用于统计卡片分组）
   开心 / 平和 / 生气  三大色块
   ================================================================= */
const EMOTION_CATEGORY = {
  '超开心':     'happy',
  '偷偷小得意': 'happy',
  '充满干劲':   'happy',
  '热爱劳动':   'happy',
  '团队合作':   'happy',
  '认真专注':   'calm',
  '想歇一会':   'calm',
  '有点迷糊':   'calm',
  '感恩':       'calm',
  '心情DIY':    'calm',
  '有点沮丧':   'angry',
  '烦躁生气':   'angry'
}

/* 情绪 → 列表图标索引（moodLib 目录下 5~20.svg 共 8 个独特图标，循环复用） */
const MOOD_ICONS = ['超开心','偷偷小得意','充满干劲','有点迷糊','认真专注',
                    '有点沮丧','想歇一会','烦躁生气','感恩','热爱劳动',
                    '团队合作','心情DIY']
const ICON_POOL = [5, 7, 9, 11, 13, 15, 17, 20, 5, 7, 9, 11]
const PNG_MAP = {5:true, 7:true, 11:true, 17:true}

function getMoodIcon(moodType) {
  const idx = MOOD_ICONS.indexOf(moodType)
  const num = ICON_POOL[idx] || 5
  const ext = PNG_MAP[num] ? '.png' : '.svg'
  return '/assets/moodLib/' + num + ext
}

/* =================================================================
   复用 moodAdd 中 getScoreLevel（禁止重写）
   ================================================================= */
function getScoreLevel(score) {
  if (score <= 20) return 's20'
  if (score <= 40) return 's40'
  if (score <= 60) return 's60'
  if (score <= 80) return 's80'
  return 's100'
}

Page({

  data: {
    nickname: 'Cyne',
    recordList: [],       // 全部记录（含 hidden）
    displayList: [],      // 过滤 hidden 后的展示列表
    expandedId: null,     // 当前展开的记录 id，null=全部折叠

    /* ---- 统计卡片 ---- */
    happyAvg: 0,
    calmAvg: 0,
    angryAvg: 0,
    recordCount: 0,

    /* ---- 空状态 ---- */
    isEmpty: true
  },

  onLoad(options) {
    if (options.nickname) {
      this.setData({ nickname: decodeURIComponent(options.nickname) })
    }
  },

  onShow() {
    this._loadRecords()
  },

  /* =================================================================
     读取本地存储 → 排序 → 过滤 → 统计 → 渲染
     ================================================================= */
  _loadRecords() {
    let records = wx.getStorageSync('moodRecords') || []

    // 时间倒序
    records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

    const displayList = records.filter(r => !r.hidden)

    this.setData({
      recordList: records,
      displayList: displayList,
      expandedId: null,
      isEmpty: displayList.length === 0,
      recordCount: displayList.length,
      ...this._calcStats(displayList)
    })
  },

  /* =================================================================
     计算开心/平和/生气 三个分组的平均分
     ================================================================= */
  _calcStats(list) {
    const groups = { happy: [], calm: [], angry: [] }

    list.forEach(r => {
      const cat = EMOTION_CATEGORY[r.currentMoodType] || 'calm'
      groups[cat].push(r.moodEnergy)
    })

    const avg = arr => arr.length > 0
      ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
      : 0

    return {
      happyAvg: avg(groups.happy),
      calmAvg: avg(groups.calm),
      angryAvg: avg(groups.angry)
    }
  },

  /* =================================================================
     列表项 + 按钮 → 展开 / 收起详情面板
     ⚠️ 同时只能展开一条
     ================================================================= */
  onExpandToggle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      expandedId: this.data.expandedId === id ? null : id
    })
  },

  /* =================================================================
     展开面板 → [分享] → 打开火苗分享卡片弹窗
     复用 moodRecord 的卡片 UI 结构，不重新开发
     ================================================================= */
  /* =================================================================
     分享至你我他 → 写入共享存储 → 动态页可见
     ================================================================= */
  onShareToYouMe(e) {
    const id = e.currentTarget.dataset.id
    const records = wx.getStorageSync('moodRecords') || []
    const idx = records.findIndex(r => r.id === id)
    if (idx === -1) return

    // 防重复分享
    if (records[idx].shared) {
      wx.showToast({ title: '已分享过该心情', icon: 'none' })
      return
    }

    // 标记已分享
    records[idx].shared = true
    wx.setStorageSync('moodRecords', records)

    // 写入共享动态
    const record = records[idx]
    const sharedFeeds = wx.getStorageSync('sharedFeeds') || []
    sharedFeeds.push({
      id: 'shared_' + id + '_' + Date.now(),
      originId: id,
      emotionName: record.currentMoodType || '',
      emotionSlang: record.shareText || '',
      emotionScore: record.moodEnergy || 0,
      time: record.time || '',
      selfNote: record.eventText || '',
      starCatAdvice: record.shareTip || '',
      timestamp: Date.now(),
      likeCount: 0,
      bookmarkCount: 0,
      isLiked: false,
      isBookmarked: false,
      commentInput: '',
      comments: []
    })
    wx.setStorageSync('sharedFeeds', sharedFeeds)

    // 收起展开
    this.setData({ expandedId: null })

    wx.showToast({ title: '已分享至你我他', icon: 'success' })
    getApp().addGrowScore('share_post')
  },

  /* =================================================================
     展开面板 → [隐藏]（保留功能，通过长按或二次操作调用）
     ================================================================= */
  onHideRecord(e) {
    const id = e.currentTarget.dataset.id

    let records = wx.getStorageSync('moodRecords') || []
    records = records.map(r => {
      if (r.id === id) r.hidden = true
      return r
    })
    wx.setStorageSync('moodRecords', records)

    wx.showToast({ title: '已隐藏', icon: 'none', duration: 1200 })
    this._loadRecords()
  },

  /* =================================================================
     moodLib 提供 getMoodIcon 给 wxml 用
     ================================================================= */
  _getMoodIcon(moodType) {
    return getMoodIcon(moodType)
  },

  /* ====== 底部 tab 切换 ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'moodLib') return
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd'
        break
      case 'starTalk':
        url = '/pages/catCare/catCare'
        break
      case 'people':
        url = '/pages/youMeOther/youMeOther'
        break
    }
    if (url) wx.redirectTo({ url })
  },

  /* =================================================================
     [心情日历] 按钮 → 跳转心情日历页
     ================================================================= */
  onCalendarTap() {
    wx.navigateTo({ url: '/pages/moodCalendar/moodCalendar' })
  },

  onReady() {},
  onHide() {},
  onUnload() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
})
