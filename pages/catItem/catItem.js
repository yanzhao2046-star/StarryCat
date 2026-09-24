/* pages/catItem/catItem.js — 猫物 (Figma 429_1103) */
const APP = getApp()

const LIB_KEY = 'catItems'        // 猫带回的普通物品（catRoom addItem 落盘），仓库初始为空
const COMBO_KEY = 'catItemSandbox'
const CARD_KEY = 'catItemCards'
const MSG_KEY = 'catItemMessage'
const SEALED_KEY = 'catItemSealed'
const SLOT_COUNT = 3 // 3
/* 密封动画时间轴：信出现 → 2.4s 被猫拿走 → 4.2s 动画收尾 */
const LETTER_TAKEN_MS = 2400
const LETTER_END_MS = 4200

/* 猫回信延迟：猫把信拿走 N 天后抵达（正式值 3 天）
   DEBUG_REPLY = true 时用短延迟方便现场调试；
   当前为【过夜测试分支 2026-09-19】值：45 分钟（原 5 秒）——
   今晚密封留言 → 明早 8:30 打开时回信应已送达；测试后还原为 5000 或改 false 回 3 天 */
const DEBUG_REPLY = true
const TEST_REPLY_MIN = 45                 // 过夜测试：回信延迟（分钟）
const REPLY_DELAY = DEBUG_REPLY
  ? LETTER_TAKEN_MS + TEST_REPLY_MIN * 60 * 1000
  : LETTER_TAKEN_MS + 3 * 24 * 60 * 60 * 1000   // 3 天

/* 猫的回信正文（Figma 1205_175：Londrina Solid 15px / 行高 1.9em）
   ⚠️ 这 4 行是「猫的设定」文本，留给产品决定 */
const REPLY_LINES = [
  '我感觉你已经迷茫徘徊了很久',
  '想想看，老鼠是什么，而且你还放在了第一位',
  '第二个是雨伞，意味着你天阴了',
  '第三个是喇叭，你喜欢喧闹',
]

/* 猫的回信卡片底图（Figma 1205_175/bg，透明底猫对话框）
   ⚠️ 仓库里 1205_175/ 目录为空，请后续把实际底图放进去再启用 */
const REPLY_BG = '/assets/CodeBuddyAssets/1205_175/bg.png'
/* 回信卡合成参数（Figma 1205_175：424×534px，正文 left 62 / top 165 / 行高 28.5） */
const REPLY_CARD = { w: 424, h: 534, textLeft: 62, textTop: 165, lineHeight: 28.5, fontSize: 15 }
const REPLY_BG_COLOR = '#FBEEDF'
/* 猫的回信信封（Figma 1207_179/1，与密封信件同一封信）
   ⚠️ 仓库里 1207_179/ 目录为空，请后续把实际信封图放进去再启用 */
const REPLY_ENVELOPE = '/assets/CodeBuddyAssets/1207_179/1.png'

const ICON_BASE = '/assets/CodeBuddyAssets/401_620/'
/* 物品库不再预置占位物品：普通物品全部由猫带回（bringItem → catItems），
   卡片由梦卡/旅卡「保存」进来（catItemCards） */

const CATEGORIES = [
  { id: 'toys', label: '玩具' },
  { id: 'sports', label: '运动' },
  { id: 'clothes', label: '衣物' },
  { id: 'animals', label: '动物' },
  { id: 'plants', label: '植物' },
  { id: 'cards', label: '卡片' },
]

Page({

  data: {
    categories: CATEGORIES,
    activeCategory: 'toys',
    itemsByCategory: {},
    slots: [],
    dragItem: null,
    comboMessage: '',
    msgModalVisible: false,
    msgDraft: '',
    /* 密封信件状态：'' 无信件 → 'letter' 信件出现 → 'taken' 被猫拿走 */
    sealState: '',
    /* 猫的回信：replyReady 密封圆可点击入口；replyOpen 展开回信卡 */
    replyReady: false,
    replyOpen: false,
    replyLines: REPLY_LINES,
    replyBg: REPLY_BG,
    replyEnvelope: REPLY_ENVELOPE,
  },

  onLoad() {
    this._loadLib()
    this._loadCombo()
    this._loadMessage()
    this._checkReply()
    this._refreshSlots()
  },

  onReady() {
    this._refreshSlots()
  },

  onShow() {
    this._loadLib()
    this._loadCombo()
    this._loadMessage()
    this._checkReply()
    this._refreshSlots()
  },

  onHide() {
    this._clearLetterTimers()
    this._clearReplyTimer()
    if (this.data.sealState) this.setData({ sealState: '' })
  },

  onUnload() {
    this._clearLetterTimers()
    this._clearReplyTimer()
  },

  _loadLib() {
    /* 普通物品：猫带回的（catRoom addItem → 'catItems'），初始为空 */
    let brought = []
    try { brought = wx.getStorageSync(LIB_KEY) || [] } catch (e) {}
    if (!Array.isArray(brought)) brought = []
    const normals = brought.filter(it => it && it.id).map(it => ({
      id: it.id,
      name: it.title || it.name || '物品',
      category: it.category || 'toys',
      symbol: it.symbol || '',
      icon: it.icon || '',
    }))
    /* 卡片：梦卡/旅卡「保存」进来的 */
    let cards = []
    try { cards = wx.getStorageSync(CARD_KEY) || [] } catch (e) {}
    if (!Array.isArray(cards)) cards = []
    cards = cards.map(c => Object.assign({}, c, {
      category: 'cards',
      icon: c.icon || c.cover || c.image || '',
    }))
    const lib = normals.concat(cards)
    this._itemsById = {}
    lib.forEach(it => { this._itemsById[it.id] = it })
    const map = {}
    CATEGORIES.forEach(c => { map[c.id] = lib.filter(it => it.category === c.id) })
    this.setData({ itemsByCategory: map })
  },

  _loadCombo() {
    let raw = []
    try { raw = wx.getStorageSync(COMBO_KEY) || [] } catch (e) {}
    if (!Array.isArray(raw)) raw = []
    const byId = this._itemsById || {}
    this._combo = []
    for (let i = 0; i < SLOT_COUNT; i++) this._combo.push(null)
    raw.forEach((r, i) => {
      const idx = typeof r.slot === 'number' ? r.slot : i
      if (idx < 0 || idx >= SLOT_COUNT || !byId[r.itemId]) return
      if (!this._combo[idx]) this._combo[idx] = { itemId: r.itemId, placedAt: r.placedAt || 0 }
    })
    this._pushSlots()
  },

  _saveCombo() {
    const out = []
    this._combo.forEach((c, i) => {
      if (c) out.push({ itemId: c.itemId, slot: i, placedAt: c.placedAt || 0 })
    })
    try { wx.setStorageSync(COMBO_KEY, out) } catch (e) {}
  },

  _pushSlots() {
    const byId = this._itemsById || {}
    const slots = this._combo.map((c, i) => {
      const it = (c && byId[c.itemId]) || null
      return { slot: i, itemId: c ? c.itemId : '', icon: it ? it.icon : '', name: it ? it.name : '' }
    })
    this.setData({ slots })
  },

  _refreshSlots() {
    try {
      const q = wx.createSelectorQuery().in(this)
      q.select('#combo').boundingClientRect()
      q.selectAll('.combo-slot').boundingClientRect()
      q.exec(res => {
        this._comboRect = (res && res[0]) || null
        this._slotRects = (res && res[1]) || []
      })
    } catch (e) {}
  },

  _loadMessage() {
    let msg = null
    try { msg = wx.getStorageSync(MSG_KEY) } catch (e) {}
    const text = (msg && msg.text) || ''
    this.setData({ comboMessage: text, msgDraft: text })
  },

  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id
    if (id === this.data.activeCategory) return
    this.setData({ activeCategory: id })
  },

  onPickItem(e) {
    const id = e.currentTarget.dataset.id
    const idx = this._firstEmptySlot()
    if (idx < 0) {
      wx.showToast({ title: '最多放 3 件', icon: 'none' })
      return
    }
    this._placeIntoSlot(id, idx)
  },

  _firstEmptySlot() {
    return this._combo.findIndex(c => !c)
  },

  _placeIntoSlot(itemId, idx) {
    const byId = this._itemsById || {}
    if (!byId[itemId] || idx < 0 || idx >= SLOT_COUNT) return
    const from = this._combo.findIndex(c => c && c.itemId === itemId)
    if (from === idx) return
    const prev = this._combo[idx]
    this._combo[idx] = { itemId, placedAt: Date.now() }
    if (from >= 0) this._combo[from] = prev || null
    this._saveCombo()
    this._pushSlots()
  },

  onSlotItemLongPress(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    const idx = this._combo.findIndex(c => c && c.itemId === id)
    if (idx < 0) return
    this._combo[idx] = null
    this._saveCombo()
    this._pushSlots()
    wx.showToast({ title: '已取出', icon: 'none' })
  },

  _onTouchStart(e) {
    const ds = e.currentTarget.dataset || {}
    const id = ds.id
    const item = (this._itemsById || {})[id]
    if (!item) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    this._drag = { source: ds.source || 'grid', itemId: id, icon: item.icon, name: item.name }
    this.setData({
      dragItem: { itemId: id, icon: item.icon, name: item.name, x: touch.clientX, y: touch.clientY },
    })
  },

  _onTouchMove(e) {
    if (!this._drag || !this.data.dragItem) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    this.setData({ 'dragItem.x': touch.clientX, 'dragItem.y': touch.clientY })
  },

  _onTouchCancel() {
    this._drag = null
    this.setData({ dragItem: null })
  },

  _onTouchEnd(e) {
    const drag = this._drag
    this._drag = null
    this.setData({ dragItem: null })
    if (!drag || drag.source === 'drag') return
    const touch = e.changedTouches && e.changedTouches[0]
    if (!touch) return
    const idx = this._nearestSlot(touch.clientX, touch.clientY)
    if (idx < 0) return
    this._placeIntoSlot(drag.itemId, idx)
  },

  _nearestSlot(x, y) {
    const rect = this._comboRect
    const rects = this._slotRects || []
    if (rect && y < rect.top - 40) return -1
    let best = -1
    let bestD = Infinity
    rects.forEach((r, i) => {
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy)
      if (d < bestD) { bestD = d; best = i }
    })
    return best
  },

  onMessageTap() {
    this.setData({ msgModalVisible: true, msgDraft: this.data.comboMessage || '' })
  },

  onMessageInput(e) {
    this.setData({ msgDraft: e.detail.value })
  },

  onMessageCancel() {
    this.setData({ msgModalVisible: false })
  },

  onMessageConfirm() {
    const text = (this.data.msgDraft || '').trim()
    const items = this._combo.filter(Boolean).map(c => c.itemId)
    try { wx.setStorageSync(MSG_KEY, { text, items, updatedAt: Date.now() }) } catch (e) {}
    this.setData({ msgModalVisible: false, comboMessage: text })
    if (APP && APP.addCatFood) APP.addCatFood('item_message')
    wx.showToast({ title: text ? '已留言' : '已清空留言', icon: 'none' })
  },

  onSealTap() {
    const ids = this._combo.filter(Boolean).map(c => c.itemId)
    if (!ids.length) {
      wx.showToast({ title: '先拖入想组合的物品', icon: 'none' })
      return
    }
    const byId = this._itemsById || {}
    const items = ids.map(id => {
      const it = byId[id] || {}
      return { itemId: id, name: it.name || '', icon: it.icon || '' }
    })
    try {
      const list = wx.getStorageSync(SEALED_KEY) || []
      list.push({ id: 'seal_' + Date.now(), items, message: this.data.comboMessage || '', sealedAt: Date.now() })
      wx.setStorageSync(SEALED_KEY, list)
    } catch (e) {}
    this._combo = this._combo.map(() => null)
    this._saveCombo()
    this._pushSlots()
    try { wx.removeStorageSync(MSG_KEY) } catch (e) {}
    /* 新一轮密封：回信入口收起，等待猫把信拿走后再送达回信 */
    this.setData({ comboMessage: '', msgDraft: '', replyReady: false, replyOpen: false })
    if (APP && APP.addCatFood) APP.addCatFood('item_message')
    wx.showToast({ title: '已密封', icon: 'none', duration: 1200 })
    this._playLetter()
    this._checkReply()
  },

  /* 密封后：信件出现 → 停留片刻 → 猫把它拿走 → 回到无信件 */
  _playLetter() {
    this._clearLetterTimers()
    this.setData({ sealState: 'letter' })
    this._letterTimer1 = setTimeout(() => {
      this.setData({ sealState: 'taken' })
    }, LETTER_TAKEN_MS)
    this._letterTimer2 = setTimeout(() => {
      this.setData({ sealState: '' })
      this._letterTimer1 = null
      this._letterTimer2 = null
    }, LETTER_END_MS)
  },

  _clearLetterTimers() {
    if (this._letterTimer1) { clearTimeout(this._letterTimer1); this._letterTimer1 = null }
    if (this._letterTimer2) { clearTimeout(this._letterTimer2); this._letterTimer2 = null }
  },

  /* 猫的回信：密封满 REPLY_DELAY 后，密封圆变为可点击入口 */
  _checkReply() {
    let sealedAt = 0
    try {
      const list = wx.getStorageSync(SEALED_KEY) || []
      if (Array.isArray(list) && list.length) {
        const last = list[list.length - 1] || {}
        sealedAt = last.sealedAt || 0
      }
    } catch (e) {}
    /* 记下这封回信的密封时间，用于卡片栏去重 */
    this._lastSealedAt = sealedAt
    const ready = !!sealedAt && Date.now() - sealedAt >= REPLY_DELAY
    this._clearReplyTimer()
    if (ready) {
      if (!this.data.replyReady) this.setData({ replyReady: true })
    } else {
      if (this.data.replyReady) this.setData({ replyReady: false })
      /* 停留本页时，到点自动亮起「猫的回信」 */
      if (sealedAt) {
        const rest = sealedAt + REPLY_DELAY - Date.now()
        this._replyTimer = setTimeout(() => {
          this._replyTimer = null
          this.setData({ replyReady: true })
        }, Math.max(rest, 0))
      }
    }
    return ready
  },

  _clearReplyTimer() {
    if (this._replyTimer) { clearTimeout(this._replyTimer); this._replyTimer = null }
  },

  /* 点击回信卡收起，回到密封圆 */
  onReplyCardTap() {
    this.setData({ replyOpen: false })
  },

  /* 点击底部圆形：有猫的回信先拆信，否则执行密封 */
  onSealCircleTap() {
    if (this.data.replyReady) {
      this.onReplyOpen()
      return
    }
    this.onSealTap()
  },

  /* 拆开信封：展开猫的回信内容 */
  onReplyOpen() {
    this.setData({ replyOpen: true })
  },

  /* 「保存」：把回信卡（底图 + 正文）合成图片，收藏进物品栏的「卡片」分类 */
  onSaveReply() {
    if (this._savingReply) return
    this._savingReply = true
    wx.createSelectorQuery().in(this).select('#replyCanvas').fields({ node: true }).exec(res => {
      const canvas = res && res[0] && res[0].node
      if (!canvas) {
        this._savingReply = false
        wx.showToast({ title: '保存失败', icon: 'none' })
        return
      }
      const dpr = 2
      const { w, h, textLeft, textTop, lineHeight, fontSize } = REPLY_CARD
      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      ctx.fillStyle = REPLY_BG_COLOR
      ctx.fillRect(0, 0, w, h)
      const img = canvas.createImage()
      img.onload = () => {
        /* 与 Figma 一致：底图按 cover 铺满卡片 */
        const scale = Math.max(w / img.width, h / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
        ctx.fillStyle = '#000000'
        ctx.font = fontSize + 'px sans-serif'
        ctx.textBaseline = 'middle'
        this.data.replyLines.forEach((line, i) => {
          ctx.fillText(line, textLeft, textTop + lineHeight * (i + 0.5))
        })
        this._saveReplyToCards(canvas)
      }
      img.onerror = () => {
        this._savingReply = false
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
      img.src = this.data.replyBg
    })
  },

  /* 导出回信卡图片 → 落到本地用户目录（临时文件会随会话失效） */
  _saveReplyToCards(canvas) {
    const done = () => { this._savingReply = false }
    wx.canvasToTempFilePath({
      canvas,
      success: res => {
        const fs = wx.getFileSystemManager()
        fs.saveFile({
          tempFilePath: res.tempFilePath,
          success: r => { this._addReplyToCards(r.savedFilePath); done() },
          fail: () => { this._addReplyToCards(res.tempFilePath); done() },
        })
      },
      fail: () => {
        done()
        wx.showToast({ title: '保存失败', icon: 'none' })
      },
    })
  },

  /* 把这封回信作为一张「卡片」放进物品栏（catItemCards → 卡片分类） */
  _addReplyToCards(filePath) {
    let list = []
    try { list = wx.getStorageSync(CARD_KEY) || [] } catch (e) {}
    if (!Array.isArray(list)) list = []
    const replyAt = this._lastSealedAt || 0
    /* 同一封回信只收一次 */
    if (replyAt && list.some(c => c && c.replyAt === replyAt)) {
      this.setData({ replyOpen: false, activeCategory: 'cards' })
      wx.showToast({ title: '这封回信已在卡片栏', icon: 'none' })
      return
    }
    list.unshift({
      id: 'reply_' + Date.now(),
      name: '猫的回信',
      category: 'cards',
      icon: filePath,
      cover: filePath,
      source: 'reply',
      replyAt,
      createdAt: Date.now(),
    })
    try { wx.setStorageSync(CARD_KEY, list) } catch (e) {}
    /* 切到「卡片」分类并收回复信卡，让收藏结果直接可见 */
    this.setData({ replyOpen: false, activeCategory: 'cards' })
    this._loadLib()
    wx.showToast({ title: '已放入卡片栏', icon: 'none' })
  },

  getSandboxContext() {
    const byId = this._itemsById || {}
    return this._combo.map((c, i) => {
      if (!c) return null
      const it = byId[c.itemId] || {}
      return { slot: i, id: c.itemId, name: it.name || '', category: it.category || '' }
    }).filter(Boolean)
  },

  onTabChange(e) {
    const key = e.detail.key
    const routes = {
      room: '/pages/catRoom/catRoom',
      mood: '/pages/catMoodLib/catMoodLib',
      store: '/pages/catItem/catItem',
      kitchen: '/subpkg_food/pages/catFood/catFood',
      realm: '/pages/realm/realm',
    }
    if (routes[key] && key !== 'store') wx.redirectTo({ url: routes[key] })
  },
})


