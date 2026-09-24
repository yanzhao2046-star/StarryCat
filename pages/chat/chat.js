/* ============================================================
   chat.js — 和星猫聊心事
   微信风格对话 / AI 回复（结合近期情绪）
   ============================================================ */

const app = getApp()
const behavior = require('../../utils/catBehavior.js')

/* ============================================================
   猫自主行为 → chat 自述文案（让用户知道猫干了什么）
   与 catRoom 的 catBubble 同一套口径；正式版可换 AI 生成
   ============================================================ */
/* 猫的第一句开场白池（_genHello 随机抽一句，猫的语气·短句·带冷幽默） */
const CAT_FIRST_LINES = [
  '肚子大不可怕，可怕的是肚子里没有好东西。',
  '爱我，喂饱我，永远别丢下我。',
  '我会起床，但不会精神满满。',
  '如果你耐心等得足够久，什么事都不会发生。',
  '嘘 —— 千万不要告诉别人我做了好事，这会破坏我的形象。',
  '我身上唯一活跃的部分，只有想象力。',
  '糟糕，我睡过头了！午睡要迟到了。',
]

const BEHAVIOR_CHAT_LINES = {
  moveSpot:      () => pick(['（我换了个地方趴着，这边晒太阳的角度刚刚好）', '（我挪了个窝，刚才那个位置有点硬）']),
  sleep:         () => '（夜深了……我窝进被窝睡了，晚安）',
  dream:         () => '（我做了一个梦！梦卡已经挂好了，记得去看看）',
  goOut:         () => pick(['（我溜出门流浪了，给你发了一封邮件，位置也标好了）', '（外面天气不错，我出去走走，稍后就回来）']),
  proactiveTalk: () => pick(['（跟你说说我今天在路上看到的事吧……隔壁的鸽子又胖了）', '（我今天心情不错，特意来跟你说一声）']),
  catmood:       () => '（我记下了一条今天的心情，去心情库看看吧）',
  cateat:        () => '（我去厨房吃了几口猫粮，粮袋变轻了一点点）',
  bringFood:     (ev) => '（我叼回来一些食材，放进厨房了……' + ((ev.data && ev.data.gram) || 8) + 'g，快去做饭吧）',
  bringItem:     () => '（我带回来一件小东西，已经放进物品库了）',
  bringTravel:   () => '（我给你寄了一张明信片，Meow Post，查收一下）',
  bringNothing:  () => pick(['（这次出门什么都没带回来……不过我真的尽力了）', '（两手空空，但心情带回来了）']),
  catLocation:   () => pick(['（我在位置地图上标了个新去处，去看看吧）', '（我又发现了一个好地方，已经画进地图里了）']),
  bringCrystal:  () => '（我带回来一颗水晶！秘境好像有动静了）',
  giveStairs:    () => '（我捡到了一段楼梯的部件，去秘境看看能不能用上）',
  bridgeReact:   () => '（桥拼起来的那一下，我也有点小激动喵）',
  takeMail:      () => '（我把你的信叼走了，会好好回的）',
  replyMail:     () => '（回信写好了，就等你打开）',
}
/* 行为事件在 chat 里已读到的位置（时间戳标记，跨页面去重） */
const CHAT_SEEN_KEY = 'catBehaviorChatSeenAt'

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

    /* 猫行为自述：结算一次（含离线）+ 把没播报过的事件续进对话 */
    this._syncBehaviorChat()
    /* 页面停留期间持续播报（tick 内部按 tickMinutes 结算，频繁调用安全） */
    this._behaviorChatTimer = setInterval(() => this._syncBehaviorChat(),
      Math.max(3000, behavior.CONFIG.global.tickMinutes * 60000))
  },

  onHide()  { this._stopBehaviorChat() },
  onUnload() { this._stopBehaviorChat() },

  _stopBehaviorChat() {
    if (this._behaviorChatTimer) { clearInterval(this._behaviorChatTimer); this._behaviorChatTimer = null }
  },

  /* 读取行为事件 → 把新事件变成猫的自述消息（按时间正序追加）
     ⚠️ 过夜测试 0920 修复：这里原先调 behavior.tick()，会把离线补算的
     fired 事件吞掉（chat 只转消息、不创建梦卡/旅卡等产出物），导致
     catRoom 再 tick 时 steps=0、产出物永远丢失。现在 chat 只读
     state.events（由 catRoom 独占 tick 驱动），不再自行结算。 */
  _syncBehaviorChat() {
    const evs = (behavior.getState().events || []).slice()   // 最新在前
    let seenAt = 0
    let hasMarker = false
    try {
      const v = wx.getStorageSync(CHAT_SEEN_KEY)
      if (typeof v === 'number' && v > 0) { seenAt = v; hasMarker = true }
    } catch (e) {}
    const fresh = evs.filter(e => e.at > seenAt).sort((a, b) => a.at - b.at)
    if (!fresh.length) return
    // 首次打开别刷屏：只播最近 5 条
    const list = hasMarker ? fresh : fresh.slice(-5)

    let lastAt = seenAt
    const add = []
    list.forEach(e => {
      lastAt = Math.max(lastAt, e.at)
      const gen = BEHAVIOR_CHAT_LINES[e.id]
      if (!gen) return   // 没配文案的行为（如 replyChat）不在 chat 播报
      add.push({ id: 'b_' + e.at + '_' + e.id, role: 'cat', content: gen(e) })
    })
    try { wx.setStorageSync(CHAT_SEEN_KEY, Math.max(lastAt, ...list.map(e => e.at))) } catch (e) {}

    if (add.length) {
      this.setData({ messages: [...this.data.messages, ...add] })
      this._scrollBottom()
    }
  },

  /* 生成开场白：随机从猫的 8 句开场白池里选一句 */
  _genHello() {
    return pick(CAT_FIRST_LINES)
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

    /* 真 AI：调 moodOperations 云函数 chatHunyuan（混元-lite → standard → turbo 回退）。
       失败/离线场景下兜底走本地 getAIReply，避免聊天功能完全瘫痪。 */
    this._askHunyuan(text, msgs)
  },

  async _askHunyuan(text, msgs) {
    /* 喂给云函数的历史聊天：role 标准化（cat → assistant），保留最近 10 轮 */
    const recent = msgs.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }))
    /* 首次用户消息 → 触发后端"叶芝式短诗"开场（不寒暄、不问候） */
    const userTurnCount = recent.filter(m => m.role === 'user').length

    let reply = ''
    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: {
          action: 'chatHunyuan',
          messages: recent,
          moodContext: this.moodSummary || null,
          context: 'chat',
          firstReply: userTurnCount === 1,
        },
      })

      if (res.result && res.result.code === 0 && res.result.data && res.result.data.reply) {
        reply = res.result.data.reply
      } else {
        console.warn('[chat] chatHunyuan 返回非成功:', res && res.result && res.result.msg)
      }
    } catch (err) {
      console.error('[chat] chatHunyuan 调用异常:', err)
    }

    /* 云函数失败 → 兜底本地正则（保留离线 demo 体验） */
    if (!reply) reply = getAIReply(text, this.moodSummary)

    const catMsg = {
      id: 'c_' + Date.now(),
      role: 'cat',
      content: reply,
    }
    this.setData({
      messages: [...this.data.messages, catMsg],
      typing: false,
    })
    this._scrollBottom()
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
  })
