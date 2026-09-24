/* ============================================================
   pages/catRoom/catRoom.js — 猫的房间
   上半：房间画面（点一下随机召唤一只猫替换当前猫）
   下半：对话台
        · chat  标签 —— 星猫聊天记录（与 catCare 共用 storage / 云函数）
        · Other 标签 —— 邮件 / 明信片 / 物品 / 位置
   ============================================================ */

const behavior = require('../../utils/catBehavior.js')
const outputs = require('../../utils/catBehaviorOutputs.js')
const foods = require('../../utils/foods.js')

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

/* ---------- 猫行为的本地文案池（正式版换 AI 生成） ---------- */
const TALK_LINES = [
  '刚才在窗台上看见一只很凶的鸽子，我们对峙了十分钟。',
  '外面下过雨，空气里有泥土的味道。我蹭了一路回来的。',
  '路过隔壁院子，那边的猫又胖了一圈。它过得很好。',
  '我在墙角发现了一个很适合打盹的纸箱，可惜太远了。',
  '今天的风很软，适合把尾巴竖起来走路。',
]
const NOTHING_LINES = [
  '（猫两手空空地回来了，还装作若无其事）',
  '（猫今天什么都没带回来，但心情好像还不错）',
]
/* 猫带回物品的素材池（icon 401_620/1~7 与名称/分类一一对应，category 对齐物品库的 6 个分类）
   8.svg 是 62×22 横条素材、9.svg 是空图，不作物品图标用 */
const BRING_ITEM_POOL = [
  { icon: '/assets/CodeBuddyAssets/401_620/1.svg', title: '不怕人的小老鼠', category: 'animals' },
  { icon: '/assets/CodeBuddyAssets/401_620/2.svg', title: '一根蓝色的羽毛', category: 'animals' },
  { icon: '/assets/CodeBuddyAssets/401_620/3.svg', title: '一只干干净净的小袜子', category: 'clothes' },
  { icon: '/assets/CodeBuddyAssets/401_620/4.svg', title: '不知道谁家的拨浪鼓', category: 'toys' },
  { icon: '/assets/CodeBuddyAssets/401_620/5.svg', title: '缺了个角的积木', category: 'toys' },
  { icon: '/assets/CodeBuddyAssets/401_620/6.svg', title: '瘪了一点的网球', category: 'sports' },
  { icon: '/assets/CodeBuddyAssets/401_620/7.svg', title: '坐得很端正的玩具熊', category: 'toys' },
]
const pick = arr => arr[Math.floor(Math.random() * arr.length)]

/* chat 开场白池：getGreeting() 随机抽一句（猫的语气·短句·冷幽默） */
const CAT_FIRST_LINES = [
  '肚子大不可怕，可怕的是肚子里没有好东西。',
  '爱我，喂饱我，永远别丢下我。',
  '我会起床，但不会精神满满。',
  '如果你耐心等得足够久，什么事都不会发生。',
  '嘘 —— 千万不要告诉别人我做了好事，这会破坏我的形象。',
  '我身上唯一活跃的部分，只有想象力。',
  '糟糕，我睡过头了！午睡要迟到了。',
]

/* 房间空态提示：猫回家会自动出现（不需要点房间召唤），只有出门时提示去向 */
const CAT_OUT_HINT = '猫出门流浪去了，等它回来……'

/* 房间背景图：白天用本地包内 room_01；黄昏/夜晚大图放云存储（5MB+ 进包会超限），直接用 fileID 引用
   ⚠️ 测试版先统一用 room_01 —— 上线前把 UNIFY_ROOM_FOR_TEST 改回 false 启用分时段换图 */
const UNIFY_ROOM_FOR_TEST = true
const ROOM_FILE_IDS = UNIFY_ROOM_FOR_TEST ? {} : {
  dusk: 'cloud://cloudbase-d8gwx8su1d600bb46.636c-cloudbase-d8gwx8su1d600bb46-1451953166/room/room_02.webp',
  night: 'cloud://cloudbase-d8gwx8su1d600bb46.636c-cloudbase-d8gwx8su1d600bb46-1451953166/room/room_03.webp',
}
/* 房间背景：云图优先（day/dusk/night），云失败则降级到本地 room_01.jpg */
const ROOM_LOCAL = '/assets/CodeBuddyAssets/catRoom/room_01.jpg'

Page({

  data: {
    /* 房间空态提示（猫出门时显示，回家自动出现猫就隐藏） */
    stageHint: CAT_OUT_HINT,
    /* 房间：猫只受行为引擎驱动（在家自动随机日常 / 出门流浪），点 stage 无玩法功能 */
    timeOfDay: 'day',            // day | dusk | night（控制 stage 背景色）
    roomSrc: ROOM_LOCAL,          // 当前时段的房间背景图（dusk/night 换云存储大图）
    catPoses: [],
    catMood: '',                 // 猫当前心情标签（行为引擎 catmood 事件更新）

    /* 对话台 · chat */
    tab: 'chat',                 // chat | other
    messages: [],
    messageId: 0,
    inputText: '',
    scrollToView: '',
    isTyping: false,
    catAvatar: '/assets/CodeBuddyAssets/1542_56/1.png',
    userAvatar: '',
    moodContext: null,
    statusBarHeight: 20,

    /* 对话台 · Other 4 个功能 */
    otherTab: 'mail',

    /* 邮件：猫出发（goOut）才发来，没发过就是 null → 空态 */
    mail: null,
    mailReplies: [],
    mailMessageId: 0,
    mailScrollToView: '',
    isMailTyping: false,
    mailReplyModalVisible: false,
    mailReplyDraft: '',

    /* 猫的梦卡片（挂在明信片板块下方）：做梦（dream）行为才产出 */
    dream: null,

    /* 解梦对话框 */
    dreamDialogVisible: false,
    dreamDraft: '',
    dreamVoice: null,
    dreamRecording: false,
    dreamPlaying: false,
    dreamKeyboard: 0,

    /* 明信片：带回旅卡（bringTravel）才有一张 Meow Post */
    postcard: null,
    /* 位置：猫出门（goOut）才会留下去处，地图才有内容 */
    locationPlace: null,
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

    /* 行为产出物：从 storage 续上最新一份（猫没触发过就是 null → 空态） */
    this.restoreBehaviorOutputs()

    /* 猫行为引擎：启动结算（含离线补算） */
    this.startBehaviorEngine()
  },

  onShow() {
    /* 跨时段再进房间时刷新一下（如白天打开，逗留到黄昏） */
    this.applyTimeOfDay()
    /* 回到页面时补算一次（离开期间猫可能换了位置/回了家） */
    if (this._behaviorInited) this.runBehaviorTick()
  },

  onHide()  { this.saveMessages(); this.stopDreamRecord(); this.stopDreamPlay(); this.stopBehaviorEngine() },
  onUnload() { this.saveMessages(); this.stopDreamRecord(); this.stopDreamPlay(); this.stopBehaviorEngine() },

  /* ==========================================================
     猫行为引擎：tick 定时结算 + 事件分发到 UI
     ========================================================== */
  startBehaviorEngine() {
    this._behaviorInited = true
    this.runBehaviorTick()
    const ms = behavior.CONFIG.global.tickMinutes * 60000
    this._behaviorTimer = setInterval(() => this.runBehaviorTick(), ms)
  },

  stopBehaviorEngine() {
    if (this._behaviorTimer) { clearInterval(this._behaviorTimer); this._behaviorTimer = null }
  },

  runBehaviorTick() {
    const fired = behavior.tick()
    if (fired && fired.length) this.applyBehaviorEvents(fired)
    this.renderBehaviorState()
  },

  /* 引擎状态 → 房间 UI（猫在不在家） */
  renderBehaviorState() {
    const bi = behavior.info()
    if (bi.location === 'outside') {
      // 猫不在家：清掉房间里的猫（点房间也不再随机召唤），提示换成去向
      const patch = {}
      if (this.data.catPoses.length) patch.catPoses = []
      if (this.data.stageHint !== CAT_OUT_HINT) patch.stageHint = CAT_OUT_HINT
      if (Object.keys(patch).length) this.setData(patch)
    } else if (!this.data.catPoses.length) {
      // 回家了：放一只回原来的位置（自动出现，不需要点房间召唤）
      const back = this._lastCatPose || CAT_POSES[0]
      this.setData({ catPoses: [back] })
    }
  },

  /* 行为产出物 → 从 storage 续显最新一份（没有就是 null，页面显示空态） */
  restoreBehaviorOutputs() {
    /* 孤儿梦事件对账：把漏建卡片的 dream 事件补成梦卡（过夜测试 0920 修复） */
    outputs.syncOrphanDreams(behavior.getState().events)
    const dream = outputs.getLatestDream()
    const patch = {
      mail: outputs.getLatestMail(),
      postcard: outputs.getLatestTravel(),
      dream: dream ? { ...dream, interpreting: false } : null,
      locationPlace: outputs.getLatestPlace(),
    }
    if (dream) patch['dream.saved'] = dream.saved || this.isDreamCardSaved(dream.no)
    this.setData(patch)
  },

  /* 引擎事件 → 各自的 UI / 数据落库 */
  applyBehaviorEvents(events) {
    events.forEach(ev => {
      switch (ev.id) {
        case 'moveSpot': {           // 换位置（编辑器概率结算）：6 个动作换一个不同的
          const cur = this.data.catPoses[0]
          const rest = CAT_POSES.filter(p => p !== cur)
          const p = rest.length ? pick(rest) : CAT_POSES[0]
          this._lastCatPose = p
          if (behavior.info().location === 'home') this.setData({ catPoses: [p] })
          break
        }
        case 'goOut': {              // 出门：猫从房间消失 + 发来邮件 + 留下去处（位置地图）
          this._lastCatPose = this.data.catPoses[0] || this._lastCatPose
          this.setData({ catPoses: [] })
          const place = outputs.addPlace()
          const mail = outputs.addMail()
          this.setData({ locationPlace: place, mail })
          this.catBubble('（猫溜出门去了，还发来一封邮件）')
          break
        }
        case 'bringFood': {          // 带回食品：进厨房原料库存（厨房初始全 0，全靠猫叼回）
          const app = getApp()
          const s = app.getCatFoodState()
          const gram = (ev.data && ev.data.gram) || 8
          const food = pick(foods.FOODS)
          if (!s.stock || typeof s.stock !== 'object') s.stock = foods.emptyStock()
          s.stock[food.id] += gram
          if (!Array.isArray(s.records)) s.records = []
          s.records.unshift({ time: Date.now(), type: 'bring', gram, desc: '猫叼回了' + food.name + ' ×' + gram + 'g' })
          if (s.records.length > 20) s.records.length = 20
          s.lastEarnAt = Date.now()
          app._saveCatFoodState(s)
          this.catBubble('（猫叼回来了 ' + food.name + ' ' + gram + 'g，放进厨房了）')
          break
        }
        case 'bringItem': {          // 带回物品：进物品库（catItem 仓库同源）
          const src = pick(BRING_ITEM_POOL)
          this.addItem({
            id: 'item_bring_' + Date.now(),
            icon: src.icon,
            title: src.title,
            type: 'normal',
            category: src.category,
          })
          this.catBubble('（猫带回来一件东西，放进物品库了）')
          break
        }
        case 'bringTravel': {        // 带回旅行卡：生成一张 Meow Post 明信片
          const card = outputs.addTravelCard()
          this.setData({ postcard: card })
          this.catBubble('（猫带回来一张旅行卡，寄到明信片那栏了）')
          break
        }
        case 'bringNothing':         // 空手而归
          this.catBubble(pick(NOTHING_LINES))
          break
        case 'catLocation': {        // 猫在哪地图：随机生成一张外出去处地图卡（位置 tab 同源）
          const place = outputs.addPlace()
          this.catBubble('（我溜达到「' + place.name + '」，位置地图上多了一张卡片）')
          break
        }
        case 'giveStairs': {         // 楼梯部件：进秘境物料库（realm 读同一份 storage）
          const got = outputs.addRealmMaterial()
          this.catBubble(got
            ? '（猫叼回来一块' + got.name + '，秘境物料 +1）'
            : '（猫看了看已经齐了的物料堆，决定先不叼了）')
          break
        }
        case 'dream': {              // 做梦：生成一张梦卡，寄到明信片栏的 DR Post
          const dreamCard = outputs.addDreamCard()
          this.setData({
            dream: { ...dreamCard, interpreting: false },
            'dream.saved': this.isDreamCardSaved(dreamCard.no),
          })
          this.catBubble('（猫睡着了，一张梦卡寄到了明信片那栏）')
          break
        }
        case 'proactiveTalk':        // 主动搭话（正式版换 AI 生成）
          this.catBubble(pick(TALK_LINES))
          break
        case 'catmood': {            // 猫心情：写一条记录进心情库（catMoodLib 同源）
          const rec = outputs.addMoodRecord()
          this.setData({ catMood: rec.currentMoodType })
          break
        }
        case 'cateat': {             // 猫吃粮食：扣粮袋
          const app = getApp()
          const s = app.getCatFoodState()
          if (s.totalGram > 0) {
            const eat = Math.min(s.totalGram, behavior.EAT_GRAM)
            s.totalGram -= eat
            s.eatenTotal += eat
            s.bagLevel = app._calcBagLevel(s.totalGram)
            app._saveCatFoodState(s)
            this.catBubble('（猫去厨房吃掉了 ' + eat + ' 营养值的猫粮）')
          } else {
            this.catBubble('（猫在厨房的碗边转了两圈，碗是空的……）')
          }
          break
        }
        case 'bringCrystal':         // 带回水晶：解锁秘境
          outputs.unlockRealm()
          this.catBubble('（猫叼回一颗水晶，某个地方好像被点亮了……）')
          break
        case 'replyChat':           // 回复互动：catRoom.sendText 已经直连 callHunyuan 显示过回复，
                                    // 引擎事件流这里不再 catBubble，避免双显示。
                                    // TODO: 其它页面的 replyChat（catItem / 梦解析 / 心情点评）扩展时，
                                    // 在此按 ev.data.replyTo / 目标页路由派发到对应 UI。
          break
        default:
          break
      }
    })
  },

  /* 猫的气泡：走聊天流，标记为猫的主动发言 */
  catBubble(text) {
    this.appendMsg('ai', text, this.shouldShowTime())
    this.scrollToBottom()
  },

  /* ==========================================================
    房间：点击无玩法功能
    猫只受行为引擎驱动：出门流浪，或在家随机日常（6 个动作自动轮换）
    仅保留连点 5 次呼出行为调试面板（联调用，正式版无入口）
    ========================================================== */
  onStageTap() {
    const now = Date.now()
    if (now - (this._stageTapAt || 0) > 2000) this._stageTapCount = 0
    this._stageTapAt = now
    this._stageTapCount = (this._stageTapCount || 0) + 1
    if (this._stageTapCount >= 5) {
      this._stageTapCount = 0
      this.showBehaviorDebugPanel()
    }
  },

  /* 行为调试面板（联调用；正式版不删也无入口） */
  showBehaviorDebugPanel() {
    wx.showActionSheet({
      itemList: ['强制夜间（测睡觉/做梦）', '恢复真实时间', '强制出门', '强制回家（结算带回）',
                 '触发：做梦', '触发：猫吃粮食', '触发：带回水晶', '触发：主动搭话',
                 '触发：带回旅卡', '触发：楼梯部件', '触发：带回物品', '重置行为状态'],
      success: (res) => {
        const i = res.tapIndex
        if (i === 0) { behavior.debug.forceNight(true); this.applyTimeOfDayDebug(); this.catBubble('（猫打了个哈欠，钻进被窝……）') }
        else if (i === 1) { behavior.debug.forceNight(false); this.applyTimeOfDayDebug(); this.catBubble('（猫醒了）') }
        else if (i === 2) {
          behavior.debug.forceGoOut()
          this._lastCatPose = this.data.catPoses[0] || this._lastCatPose
          this.setData({ catPoses: [] })
          this.catBubble('（猫溜出门去了……）')
        }
        else if (i === 3) {
          const r = behavior.debug.forceReturn()
          if (r.events && r.events.length) this.applyBehaviorEvents(r.events)
          this.renderBehaviorState()
        }
        else if (i === 4) this.applyBehaviorEvents(behavior.debug.trigger('dream').events)
        else if (i === 5) this.applyBehaviorEvents(behavior.debug.trigger('cateat').events)
        else if (i === 6) this.applyBehaviorEvents(behavior.debug.trigger('bringCrystal').events)
        else if (i === 7) this.applyBehaviorEvents(behavior.debug.trigger('proactiveTalk').events)
        else if (i === 8) this.applyBehaviorEvents(behavior.debug.trigger('bringTravel').events)
        else if (i === 9) this.applyBehaviorEvents(behavior.debug.trigger('giveStairs').events)
        else if (i === 10) this.applyBehaviorEvents(behavior.debug.trigger('bringItem').events)
        else if (i === 11) { behavior.debug.reset(); this.renderBehaviorState(); wx.showToast({ title: '行为状态已重置', icon: 'none' }) }
      },
      fail: () => {},
    })
  },

  /* 调试强制夜间时，房间氛围也跟着切（不依赖真实小时） */
  applyTimeOfDayDebug() {
    const bi = behavior.info()
    const tod = bi.isNight ? 'night' : 'day'
    this.setData({ timeOfDay: tod, roomSrc: ROOM_FILE_IDS[tod] || ROOM_LOCAL })
    this.renderBehaviorState()
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

  /* 时段划分：白天 06:00–18:00 · 黄昏 18:00–20:30 · 夜晚 20:30–次日06:00 */
  applyTimeOfDay() {
    const d = new Date()
    const t = d.getHours() * 60 + d.getMinutes()
    let tod = 'day'
    if (t < 6 * 60 || t >= 20 * 60 + 30) tod = 'night'
    else if (t >= 18 * 60) tod = 'dusk'
    this.setData({ timeOfDay: tod, roomSrc: ROOM_FILE_IDS[tod] || ROOM_LOCAL })
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
    // 开场白从 8 句猫语录池里随机抽一句
    return pick(CAT_FIRST_LINES)
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
    behavior.addIntimacy(0.02)             // 用户主动互动 → 亲密度累积

    /* replyChat 行为：按概率掷骰 + 延迟回应（当前测试参数 p=1、延迟 0~1 分钟） */
    const r = behavior.onUserAction('replyChat')
    if (!r.ok) return                      // 这次猫没接话
    if (r.delayMs > 0) {
      setTimeout(() => this.callHunyuan(text), r.delayMs)
    } else {
      this.callHunyuan(text)
    }
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
          // 是否为本次对话猫的第一句回复（用户刚发出第一条消息）
          firstReply: recentMessages.filter(m => m.role === 'user').length === 1,
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
    behavior.addIntimacy(0.02)
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
    if (!this.data.mail) return             // 没有邮件就无从回复
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
    behavior.addIntimacy(0.02)
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
    outputs.updateDreamCard(this.data.dream.id, { saved: true })
    wx.showToast({ title: '已收进物品库 · 卡片', icon: 'none', duration: 1200 })
  },

  /* 水晶进度：解析满 CRYSTAL_NEED 个梦 → 猫带回水晶，解锁秘境 */
  checkCrystalProgress() {
    if (outputs.isRealmUnlocked()) return
    if (outputs.countInterpretedDreams() < outputs.CRYSTAL_NEED) return
    outputs.unlockRealm()
    this.catBubble('（猫叼回一颗水晶，某个地方好像被点亮了……）')
    wx.showToast({ title: '秘境解锁了', icon: 'none', duration: 2000 })
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
    behavior.addIntimacy(0.03)             // 解析梦 = 深度互动

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
        const reply = res.result.data.reply
        /* 解析结果落回梦卡（进度：解析满 5 个梦 → 猫带回水晶解锁秘境） */
        if (this.data.dream) {
          outputs.updateDreamCard(this.data.dream.id, { mine: hint, result: reply, interpreted: true })
        }
        this.setData({ 'dream.result': reply })
        wx.showToast({ title: '已保存', icon: 'success', duration: 1000 })
        if (getApp().addCatFood) getApp().addCatFood('dream_interpret')
        this.checkCrystalProgress()
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

  /* 从 storage 续上 items 和留言摘要；空列表 = 猫还没带东西回来过（空态） */
  restoreItems() {
    let items = []
    let noteMap = {}
    try { items = wx.getStorageSync(ITEM_STORAGE_KEY) || [] } catch (e) {}
    try { noteMap = wx.getStorageSync(ITEM_NOTE_STORAGE_KEY) || {} } catch (e) {}
    if (!Array.isArray(items)) items = []
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
      kitchen: '/subpkg_food/pages/catFood/catFood',
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
      title: 'Aion 星星猫 — 猫的房间',
      path: '/pages/catRoom/catRoom',
    }
  },
})