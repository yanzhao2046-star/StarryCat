// pages/moodAdd/moodAdd.js

/* =================================================================
   getScoreLevel(score) — 档位判断复用函数
   规则: 0~20→s20  21~40→s40  41~60→s60  61~80→s80  81~100→s100
   禁止重写 / 禁止覆盖
   ================================================================= */
function getScoreLevel(score) {
  if (score <= 20) return 's20'
  if (score <= 40) return 's40'
  if (score <= 60) return 's60'
  if (score <= 80) return 's80'
  return 's100'
}

/* =================================================================
   shareCardLib — 文案库
   12 种情绪 × 5 个档位 = 60 组
   每组: { text: 情绪黑话, tip: 星星猫建议 }
   ⚠️ 禁止修改结构，禁止生成/改写文案内容
   ================================================================= */
const shareCardLib = {
  '超开心': {
    s20: { text: '小得意一下', tip: '开心不需要很大，一小块就够了。' },
    s40: { text: '今天运气不错嘛', tip: '运气也是一种能力，是你准备好了。' },
    s60: { text: '今天顺风局！', tip: '顺风的时候，记得记住这种感觉。' },
    s80: { text: '今天我超神了！', tip: '你很强，但更强的是你知道自己很强。' },
    s100: { text: '绝绝子！今天状态封神！', tip: '这一刻值得记住。以后累了，回来看它' },
  },
  '偷偷小得意': {
    s20: { text: '嘿嘿，还行吧', tip: '小得意没问题，别让它跑太快就好。' },
    s40: { text: '嗯，我确实可以', tip: '知道自己可以，是信心的小种子。' },
    s60: { text: '包的！稳了', tip: '稳了不是运气，是你前面努力的结果。' },
    s80: { text: '包的！太对了！', tip: '相信自己，是别人相信你的开始。' },
    s100: { text: '包的包的，我就是这个！', tip: '记住这个感觉，它是你未来的底气。' },
  },
  '充满干劲': {
    s20: { text: '有点想动了', tip: '动起来之前，先想想往哪走。' },
    s40: { text: '有劲了！', tip: '干劲来了，是身体在说"我可以"。' },
    s60: { text: '火力全开！', tip: '冲的时候，记得看路。' },
    s80: { text: '燃到炸！', tip: '燃不是目的，燃烧后剩下的才是。' },
    s100: { text: '燃起来了！直接开冲！', tip: '冲的时候记得，累了也可以停。' },
  },
  '有点迷糊': {
    s20: { text: '嗯？好像不太对', tip: '迷糊是大脑在说"我需要慢一点"。' },
    s40: { text: '等等… 我捋一下', tip: '暂停不是放弃，是在重新找方向。' },
    s60: { text: '完了，卡住了', tip: '卡住的时候，换个角度试试。' },
    s80: { text: '彻底懵了', tip: '懵是正常的，聪明人也会懵。' },
    s100: { text: '啊？尊嘟假嘟？脑子宕机了', tip: '烧了不怕，重启也是一种能力。' },
  },
  '认真专注': {
    s20: { text: '别吵，我在想', tip: '专注的开始，是让世界安静一会儿。' },
    s40: { text: '嗯，别打断我', tip: '你能进入专注，是因为你在乎。' },
    s60: { text: '深度沉浸中', tip: '沉浸的时候，时间会变轻。' },
    s80: { text: '完全沉浸', tip: '这种状态很难得，珍惜它。' },
    s100: { text: '沉浸式 ing，别 cue 我', tip: '专注是一种超能力，你已经拥有了。' },
  },
  '有点沮丧': {
    s20: { text: '有点低落', tip: '低落是允许的，它在帮你休息。' },
    s40: { text: '挺难过的', tip: '难过的时候，抱抱自己。' },
    s60: { text: '好想哭', tip: '哭不是弱，是心里装不下了。' },
    s80: { text: '天快塌了', tip: '天塌的时候，我陪你站着。' },
    s100: { text: '天塌了…… 让我 emo 一下', tip: '你还在，这就是最大的力量。' },
  },
  '想歇一会': {
    s20: { text: '有点累了', tip: '累是身体在说"我尽力了"。' },
    s40: { text: '想趴一会儿', tip: '趴一会儿，是为了之后能站起来。' },
    s60: { text: '不想动了', tip: '躺平不是放弃，是在充电。' },
    s80: { text: '彻底瘫了', tip: '瘫了也没关系，我守着你。' },
    s100: { text: '退！退！退！我要躺平一会儿', tip: '休息不是浪费，是必要的修复。' },
  },
  '烦躁生气': {
    s20: { text: '有点不爽', tip: '不爽是信号，不是错误。' },
    s40: { text: '烦躁了', tip: '烦躁的时候，先呼气。' },
    s60: { text: '火气上来了', tip: '火气上来的时候，停三秒再说话。' },
    s80: { text: '快爆了', tip: '快爆了的时候，找个安全的地方释放。' },
    s100: { text: '红温了！别惹我！', tip: '你现在的感受是真实的，也值得被看见。' },
  },
  '感恩': {
    s20: { text: '心里轻轻暖了一下', tip: '微小的善意，也值得好好收藏。' },
    s40: { text: '有人悄悄照亮我', tip: '如果心存感激，不妨好好说出口。' },
    s60: { text: '被温柔稳稳接住了', tip: '心怀感恩，更容易看见世间美好。' },
    s80: { text: '四面八方涌来好运', tip: '抱紧帮你的伙伴，不许偷偷忘记。' },
    s100: { text: '满心满眼都是感激', tip: '揣好这份温暖，继续快乐闯荡啦。' },
  },
  '热爱劳动': {
    s20: { text: '动手做点小事吧', tip: '动一动身子，烦恼自动跑路。' },
    s40: { text: '慢慢整理，慢慢变好', tip: '认真干活的小家伙，超有魅力！' },
    s60: { text: '流汗之后很踏实', tip: '付出的每一分力气都不会骗人。' },
    s80: { text: '沉浸忙碌，格外充实', tip: '悄悄耕耘，惊喜正在路上派送。' },
    s100: { text: '享受亲手创造的过程', tip: '努力的模样，本就是闪闪发光哒。' },
  },
  '团队合作': {
    s20: { text: '有人并肩同行', tip: '不用单打独斗，伙伴来撑腰咯。' },
    s40: { text: '大伙合力向前走', tip: '组队出击，难题通通靠边站！' },
    s60: { text: '彼此支撑，步调相合', tip: '抱团前行，能解锁更远的风景。' },
    s80: { text: '一群人奔赴同一个目标', tip: '互相搭把手，效率直接翻倍。' },
    s100: { text: '同心协力，无所畏惧', tip: '同心协力，无所畏惧' },
  },
  '平和放松': {
    s20: { text: '还行，挺安静的', tip: '安静的时候，你能听见自己。' },
    s40: { text: '挺舒服的', tip: '舒服是身体在说"这样就很好"。' },
    s60: { text: '很放松', tip: '放松不是什么都不做，是允许一切如其所是。' },
    s80: { text: '特别平静', tip: '平静是内在的力量在生长。' },
    s100: { text: '岁月静好，勿扰模式 ON', tip: '你已抵达一种稀有状态：和自己在一起。' },
  }
}

Page({
  data: {
    nickname: 'Cyne',
    userAvatar: '',        // 从 onboard 选择的专属头像
    eventText: '',

    /* ---- 情绪蓄力 ---- */
    moodEnergy: 0,        // 当前累计分值 0~100
    currentMoodType: '',   // 当前选中情绪类型名
    pressingMood: '',      // 正在长按的情绪（驱动进度条定位）
    progressPercent: 0,    // 进度条 0~100
    showProgress: false,   // 进度条显隐开关

    /* ---- 锁定后存档 ---- */
    selectedScoreLevel: '', // 档位标识 s20~s100
    moodText: '',           // 情绪黑话 text
    moodTip: ''             // 星星猫建议 tip
  },

  onLoad(options) {
    if (options.nickname) {
      this.setData({ nickname: decodeURIComponent(options.nickname) })
    }
    /* 读取用户专属头像 */
    const profile = wx.getStorageSync('userProfile')
    if (profile && profile.avatarPath) {
      this.setData({ userAvatar: profile.avatarPath })
    }
  },

  /* ====== 事件输入 ====== */
  onEventInput(e) {
    this.setData({ eventText: e.detail.value })
  },

  /* =================================================================
     长按蓄力：bindtouchstart → 启动定时器
     ================================================================= */
  onMoodTouchStart(e) {
    const mood = e.currentTarget.dataset.mood

    // ① 清除旧定时器（避免重复加分 bug）
    this._clearPressTimer()

    // ② 记录起始时间
    this._pressStartTime = Date.now()

    // ③ 初始化状态
    this.setData({
      pressingMood: mood,
      currentMoodType: mood,
      showProgress: true,
      moodEnergy: 0,
      progressPercent: 0,
      selectedScoreLevel: '',
      moodText: '',
      moodTip: ''
    })

    // ④ 启动 30ms 间隔定时器，最长 3 秒封顶 100 分
    this._pressTimer = setInterval(() => {
      const elapsed = Date.now() - this._pressStartTime
      const energy = Math.min(100, Math.floor(elapsed / 30))

      this.setData({
        moodEnergy: energy,
        progressPercent: energy
      })

      if (energy >= 100) {
        this._clearPressTimer()
      }
    }, 30)
  },

  /* =================================================================
     松开手指 → 停止定时器 + 锁定分值
     ================================================================= */
  onMoodTouchEnd() {
    this._lockScore()
    this._clearPressTimer()
  },

  /* =================================================================
     触摸取消 → 停止定时器 + 锁定分值
     ================================================================= */
  onMoodTouchCancel() {
    this._lockScore()
    this._clearPressTimer()
  },

  /* ------ 清除定时器 ------ */
  _clearPressTimer() {
    if (this._pressTimer) {
      clearInterval(this._pressTimer)
      this._pressTimer = null
    }
  },

  /* ------ 锁定分值 + 读取文案库 ------ */
  _lockScore() {
    const { moodEnergy, currentMoodType } = this.data
    if (!currentMoodType) return

    const level = getScoreLevel(moodEnergy)
    const emotionLib = shareCardLib[currentMoodType]
    const entry = emotionLib ? emotionLib[level] : null

    this.setData({
      selectedScoreLevel: level,
      showProgress: false,
      moodText: entry ? entry.text : '',
      moodTip: entry ? entry.tip : ''
    })
  },

  /* =================================================================
     保存心情 → 写入本地存储 + globalData → 跳转火苗卡片
     ================================================================= */
  onSaveMood() {
    const {
      nickname, currentMoodType, moodEnergy,
      eventText, selectedScoreLevel, moodText, moodTip
    } = this.data

    if (!currentMoodType) {
      wx.showToast({ title: '请长按选择一个心情', icon: 'none' })
      return
    }

    /* ---- 构建火苗记录 ---- */
    const now = new Date()
    const pad = n => n < 10 ? '0' + n : n
    const timeStr = now.getFullYear() + '.' +
      pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + '.' +
      pad(now.getHours()) + ':' + pad(now.getMinutes())

    const record = {
      id: 'mood_' + Date.now(),
      time: timeStr,
      timestamp: now.getTime(),
      moodEnergy: moodEnergy,
      currentMoodType: currentMoodType,
      eventText: eventText,
      shareText: moodText,
      shareTip: moodTip,
      scoreLevel: selectedScoreLevel,
      hidden: false
    }

    /* ---- 写入本地存储记录列表 ---- */
    let records = wx.getStorageSync('moodRecords') || []
    records.push(record)
    wx.setStorageSync('moodRecords', records)

    /* ---- 触发成长积分 ---- */
    const app = getApp()
    app.addGrowScore('mood_record')

    /* ---- 写入 globalData（供 moodRecord 卡片使用） ---- */
    app.globalData.currentMoodRecord = {
      moodEnergy,
      currentMoodType,
      eventText,
      scoreLevel: selectedScoreLevel,
      shareText: moodText,
      shareTip: moodTip,
      recordTime: timeStr
    }

    const nick = encodeURIComponent(nickname)
    wx.redirectTo({
      url: '/pages/moodRecord/moodRecord?nickname=' + nick
    })
  },

  /* =================================================================
     心情DIY → 跳转自定义心情编辑页
     ================================================================= */
  onDiyTap() {
    wx.showToast({ title: '心情DIY（敬请期待）', icon: 'none' })
  },

  /* ====== 底部 tab 切换 ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'moodIsland') return
    const nick = encodeURIComponent(this.data.nickname || '')
    let url = ''
    switch (tab) {
      case 'moodLib':
        url = '/pages/moodLib/moodLib?nickname=' + nick
        break
      case 'starTalk':
        url = '/pages/catCare/catCare?nickname=' + nick
        break
      case 'people':
        url = '/pages/youMeOther/youMeOther?nickname=' + nick
        break
    }
    if (url) {
      wx.redirectTo({ 
        url,
        fail: err => { console.error('Tab跳转失败', tab, err); wx.showToast({ title: '页面跳转失败', icon: 'none' }) }
      })
    }
  },

  onReady() {},
  onShow() {},
  onHide() {},
  onUnload() {
    this._clearPressTimer()
  },
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
})
