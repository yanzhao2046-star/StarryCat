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

/* 旧记录缺 shareText/shareTip 时的自动补全表（与 moodAdd shareCardLib 一致） */
const SHARE_FALLBACK = {
  '平和放松': { shareText: '有点松弛感在的', shareTip: '松弛不是懒，是你允许自己慢下来。' },
  '超开心':   { shareText: '今天超快乐！', shareTip: '快乐会传染，多分享一点。' },
  '充满干劲': { shareText: '冲鸭冲鸭！', shareTip: '你认真起来的样子，真的很酷。' },
  '认真专注': { shareText: '沉浸式工作/学习中', shareTip: '专注是最好的礼物，送给自己。' },
  '想歇一会': { shareText: '只想葛优躺', shareTip: '休息不是放弃，是为了更好的出发。' },
  '有点沮丧': { shareText: 'emo了', shareTip: '允许自己难过，也是一种勇敢。' },
  '有点迷糊': { shareText: '脑袋嗡嗡的', shareTip: '深呼吸，慢慢来。' },
  '烦躁生气': { shareText: '气炸了', shareTip: '情绪需要出口，找个方式释放它。' },
  '偷偷小得意': { shareText: '这波操作稳了！', shareTip: '稳住，你能赢。' },
  '感恩':     { shareText: '被世界温柔以待', shareTip: '感恩不是示弱，是你看见了光。' },
  '热爱劳动': { shareText: '今天劳模附体！', shareTip: '努力这件事，从来不会被辜负。' },
  '团队合作': { shareText: '和队友并肩作战', shareTip: '一个人走得快，一群人走得远。' }
}

Page({

  data: {
    nickname: 'Cyne',
    recordList: [],       // 全部记录（含 hidden）
    displayList: [],      // 过滤 hidden 后的展示列表
    expandedId: null,     // 当前展开的记录 id，null=全部折叠

    /* ---- 自言自语弹窗 ---- */
    showMonoPopup: false,
    monoRecordId: null,   // 当前弹窗对应的记录 id
    monoContent: '',
    monoHistory: [],      // 历史自言自语列表（用于展示）
    monoCountMap: {},     // { recordId: count } 自言自语计数

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

    // 开发期兜底：存储为空时直接生成模拟数据
    if (records.length === 0) {
      var mockGen = require('../../utils/mockGenerator')
      records = mockGen.generateMockRecords()
      wx.setStorageSync('moodRecords', records)
    }

    let dirty = false

    // 自动补全旧记录缺失的 shareText / shareTip
    records.forEach(r => {
      const mood = r.currentMoodType || r.moodTag || ''
      const fb = SHARE_FALLBACK[mood]
      if (fb) {
        if (!r.shareText) { r.shareText = fb.shareText; dirty = true }
        if (!r.shareTip)  { r.shareTip = fb.shareTip; dirty = true }
      }
    })
    if (dirty) wx.setStorageSync('moodRecords', records)

    // 时间倒序
    records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

    const displayList = records.filter(r => !r.hidden)

    this.setData({
      recordList: records,
      displayList: displayList,
      expandedId: null,
      isEmpty: displayList.length === 0,
      recordCount: displayList.length,
      monoCountMap: this._getMonoCountMap(),
      ...this._calcStats(displayList)
    })
  },

  /* =================================================================
     计算每条记录的自言自语数量（每次保存累加）
     ================================================================= */
  _getMonoCountMap() {
    const monoList = wx.getStorageSync('monologueList') || []
    const map = {}
    monoList.forEach(m => {
      if (m.originId) {
        map[m.originId] = (map[m.originId] || 0) + 1
      }
    })
    return map
  },

  /* =================================================================
     获取某条记录的所有自言自语（按时间正序）
     ================================================================= */
  _getAllMonosForRecord(originId) {
    const monoList = wx.getStorageSync('monologueList') || []
    return monoList
      .filter(m => m.originId === originId)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
  },

  /* =================================================================
     格式化时间显示
     ================================================================= */
  _fmtTime(ts) {
    const d = new Date(ts)
    const Y = d.getFullYear()
    const M = ('0' + (d.getMonth() + 1)).slice(-2)
    const D = ('0' + d.getDate()).slice(-2)
    const h = ('0' + d.getHours()).slice(-2)
    const m = ('0' + d.getMinutes()).slice(-2)
    return `${Y}-${M}-${D} ${h}:${m}`
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
     展开面板 → 自言自语 → 打开弹窗（加载历史，新内容区为空）
     ================================================================= */
  onMonologueOpen(e) {
    const id = e.currentTarget.dataset.id
    const history = this._getAllMonosForRecord(id)

    // 给每条历史加上格式化时间
    const formattedHistory = history.map(m => ({
      ...m,
      _fmtTime: this._fmtTime(m.timestamp)
    }))

    this.setData({
      showMonoPopup: true,
      monoRecordId: id,
      monoContent: '',
      monoHistory: formattedHistory
    })
  },

  /* =================================================================
     弹窗 → 关闭（无操作占位）
     ================================================================= */
  noop() {},

  /* =================================================================
     弹窗 → 点击遮罩关闭
     ================================================================= */
  onMonoClose() {
    this.setData({
      showMonoPopup: false,
      monoRecordId: null,
      monoContent: ''
    })
  },

  /* =================================================================
     弹窗 → 内容输入
     ================================================================= */
  onMonoContentInput(e) {
    this.setData({ monoContent: e.detail.value })
  },

  /* =================================================================
     弹窗 → 对勾保存（每次新建一条，带时间戳，计数递增）
     ================================================================= */
  onMonoSave() {
    const { monoRecordId, monoContent } = this.data
    if (!monoRecordId) return
    if (!monoContent.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    const now = Date.now()
    const newId = 'mono_' + monoRecordId + '_' + now
    const fmtTime = this._fmtTime(now)

    const records = wx.getStorageSync('moodRecords') || []
    const record = records.find(r => r.id === monoRecordId)

    // 新记录
    const newMono = {
      id: newId,
      originId: monoRecordId,
      content: monoContent || '',
      emotionName: record ? (record.currentMoodType || '') : '',
      emotionSlang: record ? (record.shareText || '') : '',
      emotionScore: record ? (record.moodEnergy || 0) : 0,
      time: record ? (record.time || '') : '',
      selfNote: record ? (record.eventText || '') : '',
      starCatAdvice: record ? (record.shareTip || '') : '',
      timestamp: now
    }

    // 持久化
    const monologueList = wx.getStorageSync('monologueList') || []
    monologueList.push(newMono)
    wx.setStorageSync('monologueList', monologueList)

    // 内存追加到 history（避免 storage 回读不稳定的问题）
    const monoHistory = this.data.monoHistory.concat([{
      ...newMono,
      _fmtTime: fmtTime
    }])

    // 计数
    const map = this._getMonoCountMap()

    this.setData({
      monoContent: '',
      monoHistory: monoHistory,
      monoCountMap: map
    })

    wx.showToast({ title: '已保存自言自语', icon: 'success' })
  },

  /* =================================================================
     弹窗 → 语音输入
     ================================================================= */
  onMonoVoice() {
    const recorderManager = wx.getRecorderManager()
    wx.showModal({
      title: '语音输入',
      content: '点击确定开始录音，录音结束后自动识别为文字',
      success: (res) => {
        if (!res.confirm) return
        wx.showToast({ title: '录音中...', icon: 'none', duration: 5000 })
        recorderManager.start({
          duration: 30000,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: 'mp3'
        })
        recorderManager.onStop(() => {
          wx.hideToast()
          // 录音文件路径：res.tempFilePath
          // 微信小程序语音识别需使用插件或云服务，
          // 此处将语音文件路径暂存，可扩展接入语音识别 API
          wx.showToast({ title: '语音已录制', icon: 'none' })
        })
        // 5秒后自动停止
        setTimeout(() => {
          recorderManager.stop()
        }, 5000)
      }
    })
  },

  /* =================================================================
     弹窗 → 附加图片
     ================================================================= */
  onMonoAttach() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: () => {
        // 将图片路径追加到内容中，预留扩展
        // res.tempFiles[0].tempFilePath
        const current = this.data.monoContent
        const append = '[图片]'
        this.setData({
          monoContent: current + (current ? '\n' : '') + append
        })
        wx.showToast({ title: '图片已添加', icon: 'success' })
        // TODO: 图片可上传至云存储并替换为云文件 ID
      }
    })
  },

  /* =================================================================
     弹窗 → 垃圾桶删除（删除存储数据并关闭）
     ================================================================= */
  onMonoDelete() {
    const { monoRecordId } = this.data
    if (monoRecordId) {
      const monologueList = wx.getStorageSync('monologueList') || []
      const filtered = monologueList.filter(m => m.originId !== monoRecordId)
      wx.setStorageSync('monologueList', filtered)
    }

    const map = this._getMonoCountMap()

    this.setData({
      showMonoPopup: false,
      monoRecordId: null,
      monoContent: '',
      monoHistory: [],
      monoCountMap: map
    })
    wx.showToast({ title: '已删除', icon: 'none' })
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
