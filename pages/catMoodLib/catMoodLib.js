// pages/catMoodLib/catMoodLib.js

/* =================================================================
   猫的心情库
   列表项可展开，展开面板 = 猫的旁白 + 内联评论面板：
     · comment-panel 组件：用户评论 → 猫回复（楼中楼）
   数据存储：catMoodRecords（每条记录上挂 commentList）
   历史 catMoodReplies 数据保留在 storage 中不再读取。
   ================================================================= */

/* ---- 工具函数 ---- */
function pad(n) { return n < 10 ? '0' + n : '' + n }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

/* 格式化时间戳 → "YYYY.MM.DD HH:mm"（与 youMeOther 的 _now 同格式） */
function _fmtTs(ts) {
  const d = new Date(ts)
  return d.getFullYear() + '.' +
    pad(d.getMonth() + 1) + '.' + pad(d.getDate()) + ' ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/* ---- 情绪图标 ---- */
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

/* ---- 猫的 share 词条表 ---- */
const CAT_SHARE_FALLBACK = {
  '平和放松': { shareText: '今天一切照旧',     shareTip: '太阳把肚皮晒得刚刚好。' },
  '超开心':   { shareText: '小日子亮晶晶',     shareTip: '高兴起来，就到处跑。' },
  '充满干劲': { shareText: '本喵上线了',       shareTip: '今天的精力，多到用不完。' },
  '认真专注': { shareText: '盯中，请勿打扰',   shareTip: '专注是猫的本能，只是看对象。' },
  '想歇一会': { shareText: '先打个盹',         shareTip: '休息，也是正事。' },
  '有点沮丧': { shareText: 'emo 了一下',       shareTip: '谁说猫不能难过一会儿。' },
  '有点迷糊': { shareText: '脑子嗡嗡的',       shareTip: '慢慢来，猫生很长。' },
  '烦躁生气': { shareText: '毛炸了',           shareTip: '给猫一根逗猫棒，比什么都好。' },
  '偷偷小得意': { shareText: '这波操作稳了',   shareTip: '得意是因为，本喵知道自己厉害。' },
  '感恩':     { shareText: '今天有人摸下巴了', shareTip: '被温柔对待，记在小本本上。' },
  '热爱劳动': { shareText: '磨爪中',           shareTip: '猫有猫的活儿。' },
  '团队合作': { shareText: '和铲屎官配合',     shareTip: '一个眼神，就够用了。' }
}

/* ---- 猫的事件池 ---- */
const CAT_EVENT_POOLS = {
  '平和放松': ['在窗台晒了一下午', '喝了一口水', '被风一吹', '在小毯子上踩奶', '看窗外发呆'],
  '超开心':   ['抓到了一只蝴蝶（虽然没抓住）', '听到了零食袋声音', '趴在阳光正好的地板', '得到了新的猫爬架', '跟自己的尾巴玩了好久'],
  '充满干劲': ['凌晨 4 点跑酷', '把桌上的笔推下去', '咬坏了一根数据线', '把家里每个角落都巡视了一遍', '试图打开柜门'],
  '认真专注': ['盯着墙上小虫看了半小时', '观察水龙头滴水', '把一根线头看成主线任务', '凝视窗外飞过的鸟', '研究空纸袋'],
  '想歇一会': ['趴着不想动', '找个缝钻进去', '把头埋进纸袋里', '呼噜呼噜', '眯一会儿'],
  '有点沮丧': ['被关在门外', '被狗吓到', '零食被收走了', '下雨天雷声太大', '没人在家'],
  '有点迷糊': ['刚睡醒', '不知道现在几点', '走到一半忘了要去哪', '叫自己名字反应迟钝', '脑袋空白'],
  '烦躁生气': ['被摸太久不耐烦', '尾巴被踩', '陌生人来家里', '猫砂盆没清理', '被不喜欢的梳子梳毛'],
  '偷偷小得意': ['从高处跳下来姿势完美', '趁人不注意偷吃了', '学会了开抽屉', '完美躲过洗澡', '独自占领沙发'],
  '感恩':     ['有人今天给开了罐头', '被允许上床', '铲屎官今天说话很温柔', '摸下巴的人手艺好', '没人打扰'],
  '热爱劳动': ['埋好了猫砂', '把玩具叼回窝里', '把水碗舔得干干净净', '磨了半小时爪子', '整理自己的毛'],
  '团队合作': ['和铲屎官一起看剧', '帮主人找到手机', '跟着人走遍每个房间', '和另一只猫互相舔毛', '陪人加班到深夜']
}

/* ---- 猫回复文本池（自动回复时随机取） ---- */
const CAT_REPLY_POOL = [
  '喵～', '呼噜呼噜～', '喵喵喵？', '蹭蹭你',
  '打个滚', '尾巴摇了摇', '瞄～瞄瞄～', '咕噜咕噜',
  '翻肚皮给你看', '舔了舔爪子', '用脑袋蹭了蹭',
  '哼，本喵知道了', '眯眼看你', '尾巴高高竖起'
]

function energyRange(moodType) {
  const ranges = {
    '平和放松': [30, 65], '超开心': [60, 98], '充满干劲': [55, 95], '认真专注': [40, 85],
    '想歇一会': [10, 45], '有点沮丧': [5, 35],  '有点迷糊': [10, 40], '烦躁生气': [15, 50],
    '偷偷小得意': [45, 80], '感恩': [35, 75], '热爱劳动': [40, 85], '团队合作': [40, 80]
  }
  return ranges[moodType] || [30, 70]
}

/* ---- 生成 catMood 的种子评论（用于 mock 数据，让首次有内容看） ---- */
function generateSeedComments(moodId, moodType) {
  const tip = (CAT_SHARE_FALLBACK[moodType] && CAT_SHARE_FALLBACK[moodType].shareTip) || '喵～'
  const userTexts = [
    '猫猫太可爱啦', '抱抱你', '想揉你的肚皮', '陪你一起打盹',
    '今天也要加油呀', '小日子亮晶晶'
  ]
  const catTexts = [
    tip,
    randPick(CAT_REPLY_POOL),
    '呼噜呼噜～',
    '蹭蹭你'
  ]
  const t = Date.now() - randInt(60_000, 3_600_000)
  const c1Id = 'seed_c1_' + moodId
  return [
    {
      _id: c1Id,
      moodId,
      uid: 'self_001',
      nickname: '我',
      avatar: '/assets/default-avatar.svg',
      content: randPick(userTexts),
      createTime: _fmtTs(t),
      replyTo: '',
      replyToNick: ''
    },
    {
      _id: 'seed_c2_' + moodId,
      moodId,
      uid: 'cat_001',
      nickname: '猫',
      avatar: '/assets/moodLib/20.svg',
      content: randPick(catTexts),
      createTime: _fmtTs(t + randInt(10_000, 60_000)),
      replyTo: c1Id,
      replyToNick: '我'
    }
  ]
}

/* ---- 生成 catMood mock 记录（storage 空时注入） ---- */
function generateCatMockRecords() {
  const records = []
  let idSeq = 0

  const start = new Date(2026, 6, 1)        // 7/1
  const end   = new Date(2026, 7, 5, 23, 59) // 8/5
  const cur = new Date(start)

  while (cur <= end) {
    const countPerDay = randInt(1, 3)
    for (let i = 0; i < countPerDay; i++) {
      const hour = randInt(7, 23)
      const minute = randInt(0, 59)
      const ts = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), hour, minute)

      const roll = Math.random()
      let moodType
      if (roll < 0.4) {
        moodType = randPick(['平和放松', '超开心', '充满干劲', '认真专注'])
      } else if (roll < 0.7) {
        moodType = randPick(['偷偷小得意', '感恩', '热爱劳动', '团队合作'])
      } else {
        moodType = randPick(['想歇一会', '有点沮丧', '有点迷糊', '烦躁生气'])
      }

      const [lo, hi] = energyRange(moodType)
      const energy = randInt(lo, hi)
      const fb = CAT_SHARE_FALLBACK[moodType]
      const event = randPick(CAT_EVENT_POOLS[moodType] || ['日常'])

      const timeStr = cur.getFullYear() + '.' +
        pad(cur.getMonth() + 1) + '.' + pad(cur.getDate()) + '.' +
        pad(hour) + ':' + pad(minute)

      const id = 'cat_mood_mock_' + (idSeq++)
      records.push({
        id,
        time: timeStr,
        timestamp: ts.getTime(),
        moodEnergy: energy,
        currentMoodType: moodType,
        emotionCategory: 'neutral',
        eventText: event,
        shareText: fb.shareText,
        shareTip: fb.shareTip,
        scoreLevel: '',
        hidden: false,
        shared: false,
        commentList: generateSeedComments(id, moodType)
      })
    }
    cur.setDate(cur.getDate() + 1)
  }
  records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  return records
}

Page({

  data: {
    recordList: [],
    displayList: [],
    expandedId: null,

    /* ---- 互动 / 评论 ---- */
    selfOpenId: 'self_001',

    recordCount: 0,
    isEmpty: true
  },

  onLoad() {},

  onShow() {
    this._loadRecords()
  },

  /* =================================================================
     读取本地存储 → 补全互动字段 → 排序 → 过滤 → 渲染
     ================================================================= */
  _loadRecords() {
    let records = wx.getStorageSync('catMoodRecords') || []

    // 开发期兜底：storage 空时注入种子数据
    if (records.length === 0) {
      records = generateCatMockRecords()
      wx.setStorageSync('catMoodRecords', records)
    }

    // 补全互动字段 + 给旧数据补 seed 评论
    let dirty = false
    records.forEach(r => {
      const mood = r.currentMoodType || r.moodTag || ''
      const fb = CAT_SHARE_FALLBACK[mood]
      if (fb) {
        if (!r.shareText) { r.shareText = fb.shareText; dirty = true }
        if (!r.shareTip)  { r.shareTip  = fb.shareTip;  dirty = true }
      }
      if (!Array.isArray(r.commentList)) {
        r.commentList = generateSeedComments(r.id, mood)
        dirty = true
      }
    })
    if (dirty) wx.setStorageSync('catMoodRecords', records)

    // 时间倒序
    records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

    const displayList = records.filter(r => !r.hidden)

    this.setData({
      recordList: records,
      displayList: displayList,
      expandedId: null,
      isEmpty: displayList.length === 0,
      recordCount: displayList.length
    })
  },

  /* =================================================================
     列表项 + 按钮 → 展开 / 收起
     ================================================================= */
  onExpandToggle(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      expandedId: this.data.expandedId === id ? null : id
    })
  },

  /* =================================================================
     互动：发送评论（用户评论） → 1.2s 后猫自动回复（楼中楼）
     ================================================================= */
  onSendCommentCatMood(e) {
    const { content, replyTo, replyToNick, moodId } = e.detail
    if (!content || !moodId) return

    const records = wx.getStorageSync('catMoodRecords') || []
    const idx = records.findIndex(r => r.id === moodId)
    if (idx === -1) return

    const item = records[idx]
    item.commentList = item.commentList || []

    const newComment = {
      _id: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      moodId,
      uid: this.data.selfOpenId,
      nickname: '我',
      avatar: '/assets/default-avatar.svg',
      content,
      createTime: _fmtTs(Date.now()),
      replyTo: replyTo || '',
      replyToNick: replyToNick || ''
    }
    item.commentList.push(newComment)

    wx.setStorageSync('catMoodRecords', records)
    this._refreshDisplay()

    wx.showToast({ title: replyTo ? '回复成功' : '评论成功', icon: 'success', duration: 1000 })
    if (getApp().addGrowScore) getApp().addGrowScore('comment')
    if (getApp().addCatFood) getApp().addCatFood('comment')

    // 1.2s 后猫自动回复（挂在用户评论下面）
    this._catAutoReply(moodId, newComment._id, item.currentMoodType)
  },

  /* ---- 猫自动回复：随机从 shareTip / 回复池里选一句 ---- */
  _catAutoReply(moodId, parentCommentId, moodType) {
    setTimeout(() => {
      const records = wx.getStorageSync('catMoodRecords') || []
      const item = records.find(r => r.id === moodId)
      if (!item) return

      const fb = CAT_SHARE_FALLBACK[moodType]
      const tip = fb ? fb.shareTip : ''
      const catText = (tip && Math.random() < 0.55)
        ? tip
        : randPick(CAT_REPLY_POOL)

      item.commentList = item.commentList || []
      item.commentList.push({
        _id: 'cat_reply_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        moodId,
        uid: 'cat_001',
        nickname: '猫',
        avatar: '/assets/moodLib/20.svg',
        content: catText,
        createTime: _fmtTs(Date.now()),
        replyTo: parentCommentId,
        replyToNick: '我'
      })

      wx.setStorageSync('catMoodRecords', records)
      this._refreshDisplay()
    }, 1200)
  },

  /* ---- 强制重建 displayList（互动/评论后让 comment-panel observer 触发） ---- */
  _refreshDisplay() {
    const newList = this.data.displayList.map(item => ({
      ...item,
      commentList: item.commentList ? item.commentList.slice() : []
    }))
    this.setData({ displayList: newList })
  },

  /* =================================================================
     隐藏记录
     ================================================================= */
  onHideRecord(e) {
    const id = e.currentTarget.dataset.id
    let records = wx.getStorageSync('catMoodRecords') || []
    records = records.map(r => {
      if (r.id === id) r.hidden = true
      return r
    })
    wx.setStorageSync('catMoodRecords', records)

    wx.showToast({ title: '已隐藏', icon: 'none', duration: 1200 })
    this._loadRecords()
  },

  _getMoodIcon(moodType) {
    return getMoodIcon(moodType)
  },

  /* =================================================================
     [查看猫物] 按钮 → 跳转猫物页面
     ================================================================= */
  onCatItemsTap() {
    wx.navigateTo({ url: '/pages/catItem/catItem' })
  },

  /* ============================================================
     底部导航切换
     ============================================================ */
  onTabChange(e) {
    const key = e.detail.key
    const routes = {
      room:    '/pages/catRoom/catRoom',
      mood:    '/pages/catMoodLib/catMoodLib',
      store:   '/pages/catItem/catItem',
      kitchen: '/pages/catFood/catFood',
      realm:   '/pages/realm/realm'
    }
    if (routes[key] && key !== 'mood') {
      wx.redirectTo({ url: routes[key] })
    }
  }

  })