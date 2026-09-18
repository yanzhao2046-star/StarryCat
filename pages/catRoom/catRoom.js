/* ============================================================
   pages/catRoom/catRoom.js — 猫的房间
   上半：房间画面（点一下随机召唤一只猫替换当前猫）
   下半：对话台
        · chat  标签 —— 星猫聊天记录（与 catCare 共用 storage / 云函数）
        · Other 标签 —— 邮件 / 明信片 / 物品 / 位置
   ============================================================ */

const STORAGE_KEY = 'catCareMessages'

/* ---------- 房间里的全部猫（随机池）----------
   坐标由 tools/catRoomEditor.html 摆好，复制到此处；
   每次点 stage 从池子里随机抽一只替换当前那只。 */
const CAT_POSES = [
  { id: 'act07', body: '/assets/CodeBuddyAssets/catRoom/act07.png', box: { left: 14.417, top: 75.875, width: 18.875, height: 17.000 } },
  { id: 'act06', body: '/assets/CodeBuddyAssets/catRoom/act06.png', box: { left: 23.583, top: 28.688, width: 22.000, height: 18.406 } },
  { id: 'act01', body: '/assets/CodeBuddyAssets/catRoom/act01.png', box: { left: 35.250, top: 55.875, width: 17.833, height: 14.188 } },
  { id: 'act03', body: '/assets/CodeBuddyAssets/catRoom/act03.png', box: { left: 35.458, top: 3.063,  width: 16.375, height: 13.563 } },
  { id: 'act02', body: '/assets/CodeBuddyAssets/catRoom/act02.png', box: { left: 37.333, top: 79.000, width: 19.292, height: 16.375 } },
  { id: 'act08', body: '/assets/CodeBuddyAssets/catRoom/act08.png', box: { left: 71.917, top: 17.750, width: 10.333, height:  9.969 } },
]

/* ---------- Storage keys ---------- */
const ITEM_STORAGE_KEY      = 'catItems'
const ITEM_NOTE_STORAGE_KEY = 'catItemNotes'
const ITEM_CARD_STORAGE_KEY = 'catItemCards'        // 物品库的「卡片」分类
const DREAM_NOTE_STORAGE_KEY = 'catDreamNote'

/* 物品首屏占位（机制上线后会从素材池随机抽真物品覆盖） */
const ITEM_PLACEHOLDER = {
  id: 'item_seed',
  icon: '/assets/CodeBuddyAssets/404_658/1.svg',
  title: '蜗牛搬家留下的壳',
  type: 'normal',
  bookmarked: false,
}

Page({

  data: {
    /* 房间：点 stage 抽一只猫替换当前那只，6 只随机 */
    timeOfDay: 'day',            // day | dusk | night（控制 stage 背景色）
    catPoses: [],

    /* 对话台 · chat */
    tab: 'chat',                 // chat | other
    messages: [],
    messageId: 0,
    inputText: '',
    scrollToView: '',
    isTyping: false,
    catAvatar: '/assets/CodeBuddyAssets/6_79/3.svg',
    userAvatar: '',
    moodContext: null,
    statusBarHeight: 20,

    /* 对话台 · Other 4 个功能 */
    otherTab: 'mail',

    /* 邮件 */
    mail: {
      text: '刚刚在外闲逛，观察人类、树叶、乱飞小虫。结论：世间万物，都不如午觉重要。',
    },
    mailReplies: [],
    mailMessageId: 0,
    mailScrollToView: '',
    isMailTyping: false,
    mailReplyModalVisible: false,
    mailReplyDraft: '',

    /* 猫的梦卡片（挂在明信片板块下方）*/
    dream: {
      no: 'No. 992-BUG-STARE',
      photo: '/assets/CodeBuddyAssets/1186_145/2.png',
      text: '我在屋顶做了一个梦：一只狗在漆黑的森林狼奔跑，路很明亮，月亮很弯，树在风中摇摆',
      interpreting: false,
      mine: '',
      result: '',
      saved: false,
    },

    /* 解梦对话框 */
    dreamDialogVisible: false,
    dreamDraft: '',
    dreamVoice: null,
    dreamRecording: false,
    dreamPlaying: false,
    dreamKeyboard: 0,

    /* 明信片 */
    postcard: {
      no: '992-BUG-STARE',
      quote: '“很久之前，听见你说了一段话。具体内容已经糊成一团，只记得你当时轻轻叹气。我那时候忙着盯墙上小虫，没好好听。”',
      photo: '/assets/CodeBuddyAssets/488_1503/2.png',
    },
    postcardReplyOpen: false,
    postcardReplySent: false,
    postcardReplyDraft: '',
    postcardReplyText: '',

    /* 物品 */
    items: [],
    itemReplyModalVisible: false,
    itemReplyDraft: '',
    itemReplyTargetId: '',
    itemNoteSentMap: {},
  },

  /* ==========================================================
     生命周期
     ========================================================== */

  async onLoad() {
    this.applyTimeOfDay()
    this.loadStatusBar()
    this.loadUserAvatar()
    await this.loadMoodContext()

    /* 优先接续星猫的聊天记录，没有历史才生成问候语 */
    if (!this.restoreMessages()) this.initChat()

    /* 物品：从 storage 续上，没有就给占位（首屏能见到面板） */
    this.restoreItems()

    /* 梦的解析：续上用户自己保存过的那句 */
    try {
      const note = wx.getStorageSync(DREAM_NOTE_STORAGE_KEY)
      if (note) this.setData({ 'dream.mine': note })
    } catch (e) {}

    /* 这张梦卡片是否已收进物品库（决定「保存」按钮显示状态） */
    this.setData({ 'dream.saved': this.isDreamCardSaved(this.data.dream.no) })
  },

  onShow() {
    /* 跨时段再进房间时刷新一下（如白天打开，逗留到黄昏） */
    this.applyTimeOfDay()
  },

  onHide()  { this.saveMessages(); this.stopDreamRecord(); this.stopDreamPlay() },
  onUnload() { this.saveMessages(); this.stopDreamRecord(); this.stopDreamPlay() },

  /* ==========================================================
     房间：点击随机换一只猫
     ========================================================== */
  onStageTap() {
    const pick = CAT_POSES[Math.floor(Math.random() * CAT_POSES.length)]
    this.setData({ catPoses: [pick] })
  },

  /* ==========================================================
     状态栏 / 时段
     ========================================================== */
  loadStatusBar() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      if (info && info.statusBarHeight) {
        this.setData({ statusBarHeight: info.statusBarHeight })
      }
    } catch (e) {}
  },

  applyTimeOfDay() {
    const hour = new Date().getHours()
    let tod = 'day'
    if (hour < 6 || hour >= 19) tod = 'night'
    else if (hour >= 17) tod = 'dusk'
    this.setData({ timeOfDay: tod })
  },

  /* ==========================================================
     用户头像 / 心情上下文
     ========================================================== */
  loadUserAvatar() {
    try {
      const profile = wx.getStorageSync('userProfile')
      if (profile && profile.avatarPath) {
        this.setData({ userAvatar: profile.avatarPath })
      }
    } catch (e) {}
  },

  async loadMoodContext() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: { action: 'getMoods', skip: 0, limit: 7 }
      })
      if (res.result && res.result.code === 0 && res.result.data && res.result.data.length > 0) {
        this.setData({ moodContext: this.buildMoodContext(res.result.data) })
      } else {
        this.setData({ moodContext: null })
      }
    } catch (e) {
      console.warn('[catRoom] 加载心情上下文失败:', e)
      this.setData({ moodContext: null })
    }
  },

  buildMoodContext(records) {
    const negativeMoods = ['有点沮丧', '烦躁生气', '想歇一会', '有点迷糊']
    let negCount = 0
    const moods = records.map(r => {
      if (negativeMoods.includes(r.currentMoodType)) negCount++
      return {
        mood: r.currentMoodType,
        energy: r.moodEnergy,
        time: r.recordTime || r.time || '',
      }
    })
    const dominant = (negCount * 2 > records.length) ? 'negative' : 'neutral'
    return { moods, dominant, total: records.length }
  },

  /* ==========================================================
     对话 · chat（与 catCare 共用 storage / chatHunyuan 云函数）
     ========================================================== */
  initChat() {
    const greeting = this.getGreeting()
    const msgs = [this.createMsg('ai', greeting, true)]
    this.setData({ messages: msgs, messageId: 1 }, () => {
      this.scrollToBottom()
      this.saveMessages(msgs, 1)
    })
  },

  getGreeting() {
    const hour = new Date().getHours()
    let timeGreeting
    if (hour < 6)       timeGreeting = '夜深了，还没休息呀～'
    else if (hour < 9)  timeGreeting = '早上好呀，新的一天开始了！'
    else if (hour < 12) timeGreeting = '上午好，今天心情怎么样？'
    else if (hour < 14) timeGreeting = '中午好，记得按时吃饭哦～'
    else if (hour < 18) timeGreeting = '下午好，喝杯茶歇一歇吧～'
    else if (hour < 22) timeGreeting = '晚上好，忙了一天累不累？'
    else                timeGreeting = '这么晚还不睡，星星猫陪着你～'

    const lines = ['喵～ ' + timeGreeting]
    const ctx = this.data.moodContext

    if (ctx && ctx.moods && ctx.moods.length > 0) {
      if (ctx.dominant === 'negative') {
        lines.push('看到你最近心情有些低落呢…别担心，星星猫会一直在这里陪你～')
        lines.push('想不想和我聊聊，把心里的不开心都倒出来？')
      } else {
        lines.push('我是你的星星猫伙伴，无论开心还是难过，我都在这儿陪着你～')
        lines.push('今天有什么想和我说的吗？')
      }
    } else {
      lines.push('我是你的星星猫伙伴，无论开心还是难过，我都在这儿陪着你～')
      lines.push('来跟我说说今天发生了什么事吧！')
    }
    return lines.join('\n')
  },

  createMsg(role, content, showTime) {
    const now = new Date()
    const pad = n => n < 10 ? '0' + n : n
    return {
      id: 'msg-' + (this.data.messageId + 1),
      role,
      content,
      timeText: pad(now.getHours()) + ':' + pad(now.getMinutes()),
      showTime: !!showTime,
      timestamp: now.getTime(),
    }
  },

  appendMsg(role, content, showTime) {
    const msg = this.createMsg(role, content, showTime)
    const newId = this.data.messageId + 1
    const newMessages = [...this.data.messages, msg]
    this.setData({ messages: newMessages, messageId: newId })
    this.saveMessages(newMessages, newId)
  },

  saveMessages(msgs, msgId) {
    msgs = msgs || this.data.messages
    msgId = (msgId !== undefined) ? msgId : this.data.messageId
    if (!msgs || msgs.length === 0) return
    try {
      wx.setStorageSync(STORAGE_KEY, { messages: msgs, messageId: msgId, savedAt: Date.now() })
    } catch (e) {
      console.warn('[catRoom] 保存聊天记录失败:', e)
    }
  },

  restoreMessages() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY)
      if (!saved || !saved.messages || saved.messages.length === 0) return false

      /* 超过 24 小时视为过期 */
      if (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) {
        wx.removeStorageSync(STORAGE_KEY)
        return false
      }

      this.setData({
        messages: saved.messages,
        messageId: saved.messageId || saved.messages.length,
      })
      this.scrollToBottom()
      return true
    } catch (e) {
      return false
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value })
  },

  onSend() {
    const text = this.data.inputText.trim()
    if (!text) return
    this.setData({ inputText: '' })
    this.sendText(text)
  },

  sendText(text) {
    if (!text || this.data.isTyping) return
    this.appendMsg('user', text, this.shouldShowTime())
    this.scrollToBottom()
    this.callHunyuan(text)
  },

  shouldShowTime() {
    const msgs = this.data.messages
    if (msgs.length === 0) return true
    return (Date.now() - msgs[msgs.length - 1].timestamp) > 3 * 60 * 1000
  },

  async callHunyuan(userText) {
    this.setData({ isTyping: true })
    this.scrollToBottom()

    const recentMessages = this.data.messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    }))

    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: {
          action: 'chatHunyuan',
          messages: recentMessages,
          moodContext: this.data.moodContext,
        },
      })
      this.setData({ isTyping: false })

      if (res.result && res.result.code === 0) {
        this.appendMsg('ai', res.result.data.reply, this.shouldShowTime())
        wx.cloud.callFunction({
          name: 'moodOperations',
          data: { action: 'updateGrowData', type: 'chat' },
        }).catch(() => {})
      } else {
        const errMsg = (res.result && res.result.msg) || '星星猫暂时不在服务区，请稍后再试～'
        this.appendMsg('ai', '😿 ' + errMsg, false)
      }
    } catch (err) {
      console.error('[catRoom] 云函数调用失败:', err)
      this.setData({ isTyping: false })
      this.appendMsg('ai', '😿 网络好像不太稳定，星星猫正在努力连接中…请稍后再试～', false)
    }

    this.scrollToBottom()
  },

  /* ==========================================================
     标签切换
     ========================================================== */
  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'chat') this.scrollToBottom()
  },

  onSwitchOtherTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.otherTab) return
    if (tab === 'mail' || tab === 'postcard' || tab === 'item' || tab === 'location') {
      this.setData({ otherTab: tab })
    }
  },

  /* ==========================================================
     邮件（398_536）
     ========================================================== */
  onMailMore() {
    wx.showActionSheet({
      itemList: ['收藏', '标记已读', '删除'],
      success: (res) => {
        if (res.tapIndex === 0)      wx.showToast({ title: '已收藏', icon: 'success' })
        else if (res.tapIndex === 1) wx.showToast({ title: '已标记为已读', icon: 'success' })
        else if (res.tapIndex === 2) wx.showToast({ title: '已删除', icon: 'success' })
      },
      fail: () => {},
    })
  },

  onMailForward() {
    wx.showToast({ title: '转发功能待开放', icon: 'none' })
  },

  /* 邮件回复弹窗 */
  onMailReply() {
    this.setData({ mailReplyModalVisible: true, mailReplyDraft: '' })
  },

  onMailReplyDraftInput(e) {
    this.setData({ mailReplyDraft: e.detail.value })
  },

  onMailReplyCancel() {
    this.setData({ mailReplyModalVisible: false, mailReplyDraft: '' })
  },

  onMailReplyConfirm() {
    const text = (this.data.mailReplyDraft || '').trim()
    if (!text || this.data.isMailTyping) return
    this.setData({ mailReplyModalVisible: false, mailReplyDraft: '' })
    this.sendMailReply(text)
  },

  sendMailReply(text) {
    this.appendMailMsg('user', text, this.shouldShowMailTime())
    this.scrollMailToBottom()
    this.callHunyuanForMail(text)
  },

  appendMailMsg(role, content, showTime) {
    const id = this.data.mailMessageId + 1
    const newReplies = [...this.data.mailReplies, {
      id, role, content,
      timestamp: Date.now(),
      showTime: !!showTime,
    }]
    this.setData({ mailReplies: newReplies, mailMessageId: id })
  },

  shouldShowMailTime() {
    const msgs = this.data.mailReplies
    if (msgs.length === 0) return true
    return (Date.now() - msgs[msgs.length - 1].timestamp) > 3 * 60 * 1000
  },

  scrollMailToBottom() {
    setTimeout(() => {
      this.setData({ mailScrollToView: 'mail-reply-bottom' })
    }, 100)
  },

  async callHunyuanForMail(userText) {
    this.setData({ isMailTyping: true })
    this.scrollMailToBottom()

    /* 把邮件原文作为 system 上下文，让 AI 知道是邮件场景 */
    const messages = [
      { role: 'system', content: `猫刚给用户发了一封邮件：${this.data.mail.text}\n你现在需要判断是否回复这封邮件；如果回，请保持猫的口吻，简短自然。` },
      ...this.data.mailReplies.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
    ]

    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: {
          action: 'chatHunyuan',
          messages,
          moodContext: this.data.moodContext,
          context: 'mail_reply',
        },
      })
      this.setData({ isMailTyping: false })

      if (res.result && res.result.code === 0) {
        const reply = res.result.data.reply
        /* 猫自主判断：不回复协议 —— [NO_REPLY] / [SILENT] / 空 → 不回 */
        if (!reply) return
        if (/^\[(NO_REPLY|SILENT)\]$/i.test(reply.trim())) return

        this.appendMailMsg('ai', reply, this.shouldShowMailTime())
        if (getApp().addCatFood) getApp().addCatFood('mail_reply')
      }
    } catch (err) {
      console.warn('[catRoom] 邮件猫回复失败:', err)
      this.setData({ isMailTyping: false })
    }

    this.scrollMailToBottom()
  },

  /* ==========================================================
     明信片（488_1503）· 独立功能，不复用邮件
     ========================================================== */
  onPostcardReply() {
    this.setData({ postcardReplyOpen: true, postcardReplySent: false, postcardReplyDraft: '' })
  },

  onPostcardReplyDraftInput(e) {
    this.setData({ postcardReplyDraft: e.detail.value })
  },

  onPostcardReplyCancel() {
    this.setData({ postcardReplyOpen: false, postcardReplyDraft: '' })
  },

  onPostcardReplyConfirm() {
    const text = (this.data.postcardReplyDraft || '').trim()
    if (!text) return
    this.setData({
      postcardReplyOpen: false,
      postcardReplySent: true,
      postcardReplyDraft: '',
      postcardReplyText: text,
    })
    wx.showToast({ title: '已寄出', icon: 'success', duration: 1200 })
    if (getApp().addCatFood) getApp().addCatFood('postcard_reply')
  },

  /* 点已寄出区域 → 重新展开可改写 */
  onPostcardReplyAgain() {
    this.setData({
      postcardReplyOpen: true,
      postcardReplySent: false,
      postcardReplyDraft: this.data.postcardReplyText || '',
    })
  },

  /* 「保存」按钮 → 写入本地收藏 */
  onPostcardSave() {
    try {
      const saved = wx.getStorageSync('savedPostcards') || []
      const id = this.data.postcard.no
      if (!saved.includes(id)) saved.push(id)
      wx.setStorageSync('savedPostcards', saved)
      wx.showToast({ title: '已收藏到相册', icon: 'success', duration: 1200 })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  /* ==========================================================
     猫的梦卡片（1186_145）+ 解梦对话框（1190_148）
     ========================================================== */
  onDreamInterpret() {
    if (this.data.dream.interpreting) return
    if (this.data.dream.result) {
      wx.showToast({ title: '猫已经解析过了', icon: 'none' })
      return
    }
    this.setData({ dreamDialogVisible: true })
  },

  isDreamCardSaved(no) {
    try {
      const cards = wx.getStorageSync(ITEM_CARD_STORAGE_KEY) || []
      return Array.isArray(cards) && cards.some(c => c && c.dreamNo === no)
    } catch (e) {
      return false
    }
  },

  onDreamSaveCard() {
    const dream = this.data.dream
    if (dream.saved) {
      wx.showToast({ title: '已经在物品库卡片里了', icon: 'none' })
      return
    }

    const card = {
      id: 'card_dream_' + dream.no,
      name: dream.no,
      category: 'cards',
      source: 'dream',
      icon: dream.photo,
      dreamNo: dream.no,
      text: dream.text,
      mine: dream.mine,
      result: dream.result,
      savedAt: Date.now(),
    }

    let cards = []
    try { cards = wx.getStorageSync(ITEM_CARD_STORAGE_KEY) || [] } catch (e) {}
    if (!Array.isArray(cards)) cards = []
    const next = [card, ...cards.filter(c => c && c.id !== card.id)]

    try {
      wx.setStorageSync(ITEM_CARD_STORAGE_KEY, next)
    } catch (e) {
      wx.showToast({ title: '保存失败了，再试一次', icon: 'none' })
      return
    }

    this.setData({ 'dream.saved': true })
    wx.showToast({ title: '已收进物品库 · 卡片', icon: 'none', duration: 1200 })
  },

  onDreamDialogClose() {
    this.stopDreamRecord()
    this.stopDreamPlay()
    this.setData({ dreamDialogVisible: false, dreamKeyboard: 0 })
  },

  onDreamDraftInput(e) {
    this.setData({ dreamDraft: e.detail.value })
  },

  /* 键盘高度变化：面板整体上移，别被键盘盖住 */
  onDreamKeyboard(e) {
    this.setData({ dreamKeyboard: Math.max(0, e.detail.height || 0) })
  },

  /* 工具条 · 🗑 清空：文字 + 语音一起丢掉 */
  onDreamClear() {
    this.stopDreamPlay()
    this.setData({ dreamDraft: '', dreamVoice: null })
  },

  /* ---------- 工具条 · 🎤 语音输入 ----------
     注：语音转文字原本接「微信同声传译」插件，但插件要先在小程序后台
     设置 → 第三方设置 → 插件管理 里添加并授权，否则模拟器起不来。
     所以这里只录音，交给猫的文字仍然来自输入框。 */

  /* 麦克风权限：没授权先申请，被拒了引到设置页 */
  ensureRecordAuth() {
    return new Promise((resolve) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting && res.authSetting['scope.record']) { resolve(true); return }
          wx.authorize({
            scope: 'scope.record',
            success: () => resolve(true),
            fail: () => {
              wx.showModal({
                title: '需要麦克风权限',
                content: '打开后才能按着说话，猫才听得到你',
                confirmText: '去设置',
                success: (m) => { if (m.confirm) wx.openSetting() },
                fail: () => {},
              })
              resolve(false)
            },
          })
        },
        fail: () => resolve(true),
      })
    })
  },

  /* 录音器：录下来可回放 */
  ensureDreamRecorder() {
    if (this._dreamRecorder) return this._dreamRecorder

    const recorder = wx.getRecorderManager()
    recorder.onStart(() => {
      this._dreamStarting = false
      this.setData({ dreamRecording: true })
    })
    recorder.onStop((res) => {
      this._dreamStarting = false
      const duration = Math.max(1, Math.round((res.duration || 0) / 1000))
      this.setData({
        dreamRecording: false,
        dreamVoice: res.tempFilePath ? { path: res.tempFilePath, duration } : null,
      })
      if (!res.tempFilePath) wx.showToast({ title: '这条没录上，再试一次', icon: 'none' })
    })
    recorder.onError(() => {
      this._dreamStarting = false
      this.setData({ dreamRecording: false })
      wx.showToast({ title: '录音没成功，检查一下麦克风权限', icon: 'none' })
    })

    this._dreamRecorder = recorder
    return recorder
  },

  async onDreamVoice() {
    if (this.data.dreamRecording) { this.stopDreamRecord(); return }
    this.stopDreamPlay()
    if (!(await this.ensureRecordAuth())) return

    try {
      this._dreamStarting = true
      this.ensureDreamRecorder().start({
        duration: 60000,
        format: 'mp3',
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
      })
    } catch (e) {
      this._dreamStarting = false
      wx.showToast({ title: '录音没起来，再试一次', icon: 'none' })
    }
  },

  stopDreamRecord() {
    /* dreamRecording 由 onStart 回调才置 true，连点时要靠 _dreamStarting 兜住 */
    if (!this.data.dreamRecording && !this._dreamStarting) return
    this._dreamStarting = false
    try { this.ensureDreamRecorder().stop() } catch (e) {}
  },

  /* 语音条 · 播放 / 停止 */
  onDreamVoicePlay() {
    const voice = this.data.dreamVoice
    if (this.data.dreamRecording || !voice || !voice.path) return
    if (this.data.dreamPlaying) { this.stopDreamPlay(); return }

    const audio = wx.createInnerAudioContext()
    audio.src = voice.path
    audio.onEnded(() => this.stopDreamPlay())
    audio.onError(() => this.stopDreamPlay())
    audio.play()
    this._dreamAudio = audio
    this.setData({ dreamPlaying: true })
  },

  stopDreamPlay() {
    if (this._dreamAudio) {
      try { this._dreamAudio.stop(); this._dreamAudio.destroy() } catch (e) {}
      this._dreamAudio = null
    }
    if (this.data.dreamPlaying) this.setData({ dreamPlaying: false })
  },

  /* 语音条 · 删掉这条录音 */
  onDreamVoiceRemove() {
    this.stopDreamPlay()
    this.setData({ dreamVoice: null })
  },

  /* 工具条 · ✓ 保存：存下用户自己写的解析（卡片上显示「你：…」），
     同时把它当参考交给猫，让猫据此给出解析 */
  async onDreamSave() {
    if (this.data.dream.interpreting) return
    this.stopDreamRecord()

    const hint = this.data.dreamDraft.trim()
    if (!hint) {
      wx.showToast({ title: '先写一句，或者按麦克风说一句', icon: 'none' })
      return
    }

    try { wx.setStorageSync(DREAM_NOTE_STORAGE_KEY, hint) } catch (e) {}

    this.setData({
      dreamDialogVisible: false,
      dreamKeyboard: 0,
      dreamDraft: '',
      dreamVoice: null,
      'dream.mine': hint,
      'dream.interpreting': true,
    })

    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: {
          action: 'chatHunyuan',
          context: 'dream',
          dreamText: this.data.dream.text,
          dreamHint: hint,
          moodContext: this.data.moodContext,
          messages: [{ role: 'user', content: '我的看法：' + hint }],
        },
      })

      this.setData({ 'dream.interpreting': false })

      if (res.result && res.result.code === 0 && res.result.data && res.result.data.reply) {
        this.setData({ 'dream.result': res.result.data.reply })
        wx.showToast({ title: '已保存', icon: 'success', duration: 1000 })
        if (getApp().addCatFood) getApp().addCatFood('dream_interpret')
      } else {
        wx.showToast({ title: '猫解着解着睡着了，再试一次', icon: 'none' })
      }
    } catch (err) {
      console.warn('[catRoom] 解梦失败:', err)
      this.setData({ 'dream.interpreting': false })
      wx.showToast({ title: '网络不太稳定，稍后再试', icon: 'none' })
    }
  },

  /* ==========================================================
     物品（404_658）· 持久化 + addItem() 公共接入点
     ========================================================== */

  /* 从 storage 续上 items 和留言摘要；空列表时给占位 */
  restoreItems() {
    let items = []
    let noteMap = {}
    try { items = wx.getStorageSync(ITEM_STORAGE_KEY) || [] } catch (e) {}
    try { noteMap = wx.getStorageSync(ITEM_NOTE_STORAGE_KEY) || {} } catch (e) {}
    if (!Array.isArray(items)) items = []
    if (!items.length) items = [ITEM_PLACEHOLDER]
    this.setData({ items, itemNoteSentMap: noteMap })
  },

  /* 「猫外出」/「互动机制」回调入口。
     入参 item：{ id, icon, title, type?, bookmarked? }
       type 可选：
         'normal' 默认 —— 普通物品
         'seed'   特殊 —— 种子（带「去种下」按钮，种下后跳转「秘境」）
     插入到 items 队首并写入 storage（按 id 去重）。
     TODO：item.icon / title 由机制从素材池随机抽并配名；
           seed 何时推由「互动质量 / 坦诚度」信号判定。 */
  addItem(item) {
    if (!item || !item.id) return
    const normalized = {
      icon: '',
      title: '',
      type: 'normal',
      bookmarked: false,
      ...item,
    }
    const list = [normalized, ...this.data.items.filter(it => it.id !== normalized.id)]
    this.setData({ items: list })
    try { wx.setStorageSync(ITEM_STORAGE_KEY, list) } catch (e) {}
  },

  onItemCollect(e) {
    const id = e.currentTarget.dataset.id
    const items = this.data.items.map(it => {
      if (it.id !== id) return it
      return { ...it, bookmarked: !it.bookmarked }
    })
    const item = items.find(it => it.id === id)
    this.setData({ items })
    try { wx.setStorageSync(ITEM_STORAGE_KEY, items) } catch (e) {}
    wx.showToast({
      title: item.bookmarked ? '已收藏' : '取消收藏',
      icon: 'success',
      duration: 1000,
    })
  },

  onItemMessage(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      itemReplyModalVisible: true,
      itemReplyTargetId: id,
      itemReplyDraft: '',
    })
  },

  onItemDiscard(e) {
    const id = e.currentTarget.dataset.id
    const target = this.data.items.find(it => it.id === id)
    if (!target) return
    const items = this.data.items.filter(it => it.id !== id)
    const noteSentMap = { ...this.data.itemNoteSentMap }
    delete noteSentMap[id]
    this.setData({ items, itemNoteSentMap: noteSentMap })
    try { wx.setStorageSync(ITEM_STORAGE_KEY, items) } catch (e) {}
    try { wx.setStorageSync(ITEM_NOTE_STORAGE_KEY, noteSentMap) } catch (e) {}
    wx.showToast({
      title: '已扔掉「' + target.title + '」',
      icon: 'none',
      duration: 1200,
    })
  },

  onItemReplyDraftInput(e) {
    this.setData({ itemReplyDraft: e.detail.value })
  },

  onItemReplyCancel() {
    this.setData({
      itemReplyModalVisible: false,
      itemReplyDraft: '',
      itemReplyTargetId: '',
    })
  },

  onItemReplyConfirm() {
    const text = (this.data.itemReplyDraft || '').trim()
    if (!text) return
    const id = this.data.itemReplyTargetId
    const noteSentMap = { ...this.data.itemNoteSentMap, [id]: text }
    this.setData({
      itemReplyModalVisible: false,
      itemReplyDraft: '',
      itemReplyTargetId: '',
      itemNoteSentMap: noteSentMap,
    })
    try { wx.setStorageSync(ITEM_NOTE_STORAGE_KEY, noteSentMap) } catch (e) {}
    wx.showToast({ title: '留言已挂上', icon: 'success', duration: 1000 })
    if (getApp().addCatFood) getApp().addCatFood('item_message')
  },

  /* ==========================================================
     滚动到底部 / 底部导航 / 返回
     ========================================================== */
  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToView: 'bubble-bottom' })
    }, 100)
  },

  onTabChange(e) {
    const key = e.detail.key
    const routes = {
      room:    '/pages/catRoom/catRoom',
      mood:    '/pages/catMoodLib/catMoodLib',
      store:   '/pages/catItem/catItem',
      kitchen: '/pages/catFood/catFood',
      realm:   '/pages/realm/realm',
    }
    if (routes[key] && key !== 'room') {
      wx.redirectTo({ url: routes[key] })
    }
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
  },

  onShareAppMessage() {
    return {
      title: '毛布力猫不理 — 猫的房间',
      path: '/pages/catRoom/catRoom',
    }
  },
})