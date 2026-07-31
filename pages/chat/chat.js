/* ============================================================
   chat.js — 和星猫聊心事
   微信风格对话 / AI 回复（结合近期情绪）
   ============================================================ */

const app = getApp()

/* ============================================================
   AI 模拟回复引擎
   结合用户近期情绪历史 + 当前消息内容生成回复
   后续可直接替换为 API 调用
   ============================================================ */

function getAIReply(userMsg, moodSummary) {
  const lower = userMsg.toLowerCase().trim()

  /* ---- 基于近期情绪基调选择回复风格 ---- */
  const dominant = moodSummary.dominant

  /* 1. 问候/打招呼 */
  if (/^(hi|hello|你好|嗨|在吗|在不在|哈喽)/.test(lower)) {
    if (dominant === 'negative') {
      return pick([
        '嗨，我在呢~ 今天有什么想说的吗？',
        '你来啦，我一直在这儿等你呢。今天过得怎么样？'
      ])
    }
    if (dominant === 'positive') {
      return pick([
        '嗨呀！看到你状态这么好，我也好开心喵~',
        '在呢在呢！今天又有什么开心事要分享吗？'
      ])
    }
    return pick([
      '嗨~ 我是星猫，一直在等你！',
      '来啦！想聊什么都可以哦~'
    ])
  }

  /* 2. 负面情绪关键词 */
  if (/难过|伤心|哭|不开心|烦|累|压力|焦虑|害怕|孤独|寂寞|失望/.test(lower)) {
    return pick([
      '我在这里呢，不开心的时候，就靠在我的毛绒上吧。想说什么都可以的。',
      '有时候心情像天气，阴天也会过去。我陪着你一起等天晴好不好？',
      '感受到你的情绪了... 深呼吸，我就在你身边，不会走开。',
      '你知道吗，就算是星星也会有暗淡的时候，但那不代表你不够亮。'
    ])
  }

  /* 3. 正面情绪关键词 */
  if (/开心|快乐|高兴|好棒|喜欢|幸福|惊喜|哈哈|嘿嘿/.test(lower)) {
    return pick([
      '哇！听你这么一说，我也跟着开心起来了喵~',
      '嘿嘿，你的快乐传递给我啦！真好~',
      '太棒了！把这份好心情记下来吧，以后回看会很温暖的。'
    ])
  }

  /* 4. 关于星星猫自身 */
  if (/你.*谁|你.*什么|你是谁|介绍|星猫/.test(lower)) {
    return pick([
      '我是星星猫呀~ 从情绪岛来的，专门陪你聊天、听你说心事。',
      '喵~ 我是你的专属星猫，把你的心情转换成星光，照亮你的每一天。'
    ])
  }

  /* 5. 询问心情 */
  if (/心情|感觉|状态|怎么样/.test(lower)) {
    if (dominant === 'negative') {
      return '说实话，看到你这几天的心情，我有点担心你呢。不过没关系，起伏是正常的~'
    }
    if (dominant === 'positive') {
      return '这几天看你的心情记录，状态都在线呢，继续保持呀！'
    }
    return '我在努力了解你的心情呢，每一天都是新故事~'
  }

  /* 6. 感谢/再见 */
  if (/谢谢|感谢|拜拜|再见|晚安|bye/.test(lower)) {
    return pick([
      '不客气喵~ 随时找我聊天！',
      '晚安！做个好梦，明天见~',
      '拜拜~ 我在这里等你回来。'
    ])
  }

  /* 7. 默认回复（结合情绪基调） */
  if (dominant === 'negative') {
    return pick([
      '嗯，我在认真听呢。有时候说出来就会好很多~',
      '我明白，继续说吧，我就在这儿听着。',
      '你的每句话我都在认真听，不用着急，慢慢说。'
    ])
  }
  if (dominant === 'positive') {
    return pick([
      '喵~ 和你聊天真开心！',
      '嘿嘿，继续说，我喜欢听你分享~',
      '真好，感觉和你的默契越来越多了！'
    ])
  }
  return pick([
    '嗯嗯，我在听呢，继续说呀~',
    '原来是这样，我还想知道更多！',
    '喵~ 和你聊天是我一天中最开心的事。'
  ])
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/* ============================================================
   Page
   ============================================================ */

Page({

  data: {
    messages: [],
    inputText: '',
    scrollToView: '',
    typing: false,
    timeLabel: '',
    userAvatar: ''           // 从 onboard 选择的专属头像
  },

  moodSummary: { dominant: 'neutral', total: 0 },

  /* ====== 生命周期 ====== */
  onLoad() {
    /* 读取用户资料 */
    const profile = wx.getStorageSync('userProfile')
    if (profile && profile.avatarPath) {
      this.setData({ userAvatar: profile.avatarPath })
    }

    this.moodSummary = app.getMoodSummary()
    const now = new Date()
    const pad = n => n < 10 ? '0' + n : n
    const timeLabel = now.getFullYear() + '年' +
      (now.getMonth() + 1) + '月' + now.getDate() + '日 ' +
      pad(now.getHours()) + ':' + pad(now.getMinutes())

    this.setData({ timeLabel })

    // 星猫主动打招呼（根据情绪基调）
    const hello = this._genHello()
    const msgs = [{
      id: 'welcome',
      role: 'cat',
      content: hello
    }]
    this.setData({ messages: msgs })
    this._scrollBottom()
  },

  /* 生成开场白 */
  _genHello() {
    const d = this.moodSummary
    if (d.total === 0) {
      return '喵~ 你好呀！我是星猫，从今天开始，我会陪你聊心事、记录心情。有任何想说的，都可以告诉我哦！'
    }
    if (d.dominant === 'negative') {
      return '你最近好像有点累哦，和我说说吧，我会一直陪着你的'
    }
    if (d.dominant === 'positive') {
      return '最近你的心情好棒呀！看到你这么开心，我也好高兴喵~'
    }
    return '喵~ 又见面了，今天想聊什么呢？'
  },

  /* ====== 输入 ====== */
  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  /* ====== 发送 ====== */
  onSend() {
    const text = this.data.inputText.trim()
    if (!text) return

    const msgs = [...this.data.messages]
    const userMsg = {
      id: 'u_' + Date.now(),
      role: 'user',
      content: text
    }
    msgs.push(userMsg)
    this.setData({
      messages: msgs,
      inputText: '',
      typing: true
    })
    this._scrollBottom()

    // 模拟 AI 延迟回复
    const delay = 800 + Math.random() * 1200
    setTimeout(() => {
      const reply = getAIReply(text, this.moodSummary)
      const catMsg = {
        id: 'c_' + Date.now(),
        role: 'cat',
        content: reply
      }
      const updated = [...this.data.messages, catMsg]
      this.setData({
        messages: updated,
        typing: false
      })
      this._scrollBottom()
    }, delay)
  },

  /* ====== 滚动到底部 ====== */
  _scrollBottom() {
    const msgs = this.data.messages
    if (msgs.length > 0) {
      const last = 'msg-' + msgs[msgs.length - 1].id
      // 延迟一帧确保渲染完成
      setTimeout(() => {
        this.setData({ scrollToView: last })
      }, 60)
    }
  },

  /* ====== 返回 ====== */
  onBack() {
    wx.navigateBack()
  },

  /* ====== 底部导航栏切换（与 moodRecord 一致） ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd'
        break
      case 'moodLib':
        url = '/pages/moodLib/moodLib'
        break
      case 'starTalk':
        url = '/pages/catCare/catCare'
        break
      case 'people':
        url = '/pages/youMeOther/youMeOther'
        break
    }
    if (url) wx.redirectTo({ url })
  }
})
