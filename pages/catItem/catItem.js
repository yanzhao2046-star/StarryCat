/* pages/catItem/catItem.js — 猫物 (Figma 429_1103) */
const APP = getApp()
const itemCatalog = require('../../utils/itemCatalog.js')

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
   当前为【现场调试】值：1 分钟——密封后 1 分钟回信送达，方便快速验证全链路；
   ⚠ 正式发版：DEBUG_REPLY 改回 false（= 3 天） */
const DEBUG_REPLY = true
const TEST_REPLY_MIN = 1                  // 现场调试：回信延迟（分钟）

/* 调试：仓库为空时自动塞入一批测试物品（用猫带回的真实目录数据，带象征含义），
   省得等猫出门带回。⚠ 正式发版改 false */
const DEBUG_SEED = true
const DEBUG_SEED_COUNT = 9
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

/* AI 回信拆行：先按标点断句，再对超长句硬切（回信卡按行渲染，太长会溢出） */
function splitReplyLines(text, max = 18) {
  const raw = String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean)
  const out = []
  raw.forEach(para => {
    const segs = para.match(/[^。！？；，、]+[。！？；，、]?/g) || [para]
    let buf = ''
    segs.forEach(s => {
      if ((buf + s).length > max && buf) { out.push(buf); buf = s }
      else buf += s
    })
    if (buf) out.push(buf)
  })
  return out.length ? out : REPLY_LINES
}

/* 猫的回信卡片底图（Figma 1205_175/bg，透明底猫对话框）
   ⚠️ 仓库里 1205_175/ 目录为空，请后续把实际底图放进去再启用 */
const REPLY_BG = '/assets/CodeBuddyAssets/1205_175/bg.png'
/* 回信卡合成参数（Figma 1205_175：424×534px，正文 left 62 / top 165 / 行高 28.5） */
const REPLY_CARD = { w: 424, h: 534, textLeft: 62, textTop: 165, lineHeight: 28.5, fontSize: 15 }
const REPLY_BG_COLOR = '#FBEEDF'
/* 猫的回信信封（Figma 1207_179/1，与密封信件同一封信）
   ⚠️ 仓库里 1207_179/ 目录为空，请后续把实际信封图放进去再启用 */
const REPLY_ENVELOPE = '/assets/CodeBuddyAssets/1207_179/1.png'

/* 物品库不再预置占位物品：普通物品全部由猫带回（bringItem → catItems），
   卡片由梦卡/旅卡「保存」进来（catItemCards） */

const CATEGORIES = [
  { id: 'toys', label: '玩具' },
  { id: 'stationery', label: '文具' },
  { id: 'clothes', label: '衣物' },
  { id: 'nature', label: '自然' },
  { id: 'cards', label: '卡片' },
]

/* 分类归并：旧的「动物 animals」+「植物 plants」合并为「自然 nature」；
   「运动 sports」改名为「文具 stationery」。
   老 storage（catItems）里存的仍是旧分类 id，读取时统一归并，不改写历史数据。 */
const CATEGORY_ALIAS = { animals: 'nature', plants: 'nature', sports: 'stationery' }
const normalizeCategory = c => CATEGORY_ALIAS[c] || c || 'toys'

Page({

  data: {
    categories: CATEGORIES,
    activeCategory: 'toys',
    itemsByCategory: {},
    slots: [],
    dragItem: null,
    comboMessage: '',
    /* 卡片放大预览：点卡片栏里的卡全屏放大，点任意处收起 */
    cardPreview: null,
    msgModalVisible: false,
    msgDraft: '',
    /* 密封信件状态：'' 无信件 → 'letter' 信件出现 → 'taken' 被猫拿走 */
    sealState: '',
    /* 「猫已拿走…」提示：与 sealState 解耦，信件动画收尾后仍保留，
       一直到回信抵达（replyReady）才收起 */
    takenTip: false,
    /* 猫的回信：replyReady 密封圆可点击入口；replyOpen 展开回信卡 */
    replyReady: false,
    replyOpen: false,
    replyLines: REPLY_LINES,
    replyBg: REPLY_BG,
    replyEnvelope: REPLY_ENVELOPE,
  },

  onLoad() {
    /* 调试：仓库为空时自动放一批测试物品，方便直接组合密封 */
    if (DEBUG_SEED) {
      let has = []
      try { has = wx.getStorageSync(LIB_KEY) || [] } catch (e) {}
      if (!has || !has.length) {
        const n = this._debugSeedItems()
        wx.showToast({ title: '放入 ' + n + ' 件测试物品', icon: 'none' })
      }
    }
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
    /* 过滤掉用弃用素材（401_620）的历史物品，与 catRoom 的清理口径一致 */
    const normals = brought.filter(it => it && it.id && !itemCatalog.isRetiredItem(it)).map(it => ({
      id: it.id,
      name: it.title || it.name || '物品',
      category: normalizeCategory(it.category),   // 动物/植物 → 自然
      /* 象征含义：新物品自带；老数据（只有 icon）用 icon 反查目录补上 */
      symbol: it.symbol || itemCatalog.getSymbolByIcon(it.icon) || '',
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

  /* 调试：塞入一批测试物品（pickBringItem 出的真实目录数据，带 symbol）——
     写入 catItems 后返回件数。也支持 Console 手动触发：
       getCurrentPages().pop()._debugSeedItems() */
  _debugSeedItems() {
    const list = []
    for (let i = 0; i < DEBUG_SEED_COUNT; i++) {
      const it = itemCatalog.pickBringItem()
      list.push({
        id: 'item_bring_seed_' + Date.now() + '_' + i,
        title: it.title,
        name: it.title,
        icon: it.icon,
        category: it.category,
        tier: it.tier,
        symbol: it.symbol || '',
        createdAt: Date.now(),
      })
    }
    try { wx.setStorageSync(LIB_KEY, list) } catch (e) {}
    return list.length
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
    const item = (this._itemsById || {})[id]
    /* 卡片不参与组合：点按 → 全屏放大预览 */
    if (item && item.category === 'cards') {
      this.setData({ cardPreview: {
        id: item.id,
        icon: item.icon || '',
        name: item.name || '',
        note: item.note || item.quote || '',
        mine: item.mine || '',
        catReply: item.catReply || '',
      } })
      return
    }
    const idx = this._firstEmptySlot()
    if (idx < 0) {
      wx.showToast({ title: '最多放 3 件', icon: 'none' })
      return
    }
    this._placeIntoSlot(id, idx)
  },

  onCardPreviewClose() {
    this.setData({ cardPreview: null })
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
    /* 卡片不参与组合：不进入拖拽流程 */
    if (item.category === 'cards') return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const source = ds.source || 'grid'
    this._drag = {
      source, itemId: id, icon: item.icon, name: item.name,
      /* 槽位拖出时记录原槽位（用于松手在槽位外时取出） */
      fromSlot: source === 'slot' ? Number(ds.slot) : -1,
    }
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
    /* 拖动源是 grid：松手在 combo 外（idx<0）就什么都不做 */
    if (drag.source === 'grid') {
      if (idx < 0) return
      this._placeIntoSlot(drag.itemId, idx)
      return
    }
    /* 拖动源是 slot：松手在另一个槽位 → 移动/互换；松手在 combo 外 → 取出 */
    if (drag.source === 'slot') {
      if (idx >= 0 && idx !== drag.fromSlot) {
        this._placeIntoSlot(drag.itemId, idx)   /* 已有 _placeIntoSlot 内置互换 */
        return
      }
      this._removeFromSlot(drag.itemId)
      wx.showToast({ title: '已取出', icon: 'none' })
    }
  },

  _removeFromSlot(itemId) {
    const idx = this._combo.findIndex(c => c && c.itemId === itemId)
    if (idx < 0) return
    this._combo[idx] = null
    this._saveCombo()
    this._pushSlots()
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
    /* 按真实槽位记录摆放先后（只放 2 件时 slot 可能是 0 和 2）——顺序是释梦素材 */
    const items = this._combo.map((c, i) => {
      if (!c) return null
      const it = byId[c.itemId] || {}
      return { itemId: c.itemId, slot: i, name: it.name || '', icon: it.icon || '', symbol: it.symbol || '' }
    }).filter(Boolean)
    const sealId = 'seal_' + Date.now()
    try {
      const list = wx.getStorageSync(SEALED_KEY) || []
      list.push({ id: sealId, items, message: this.data.comboMessage || '', sealedAt: Date.now() })
      wx.setStorageSync(SEALED_KEY, list)
    } catch (e) {}
    /* 记住这封信的 id：拆信时用它拉猫的回信 */
    this._lastSealId = sealId
    this._combo = this._combo.map(() => null)
    this._saveCombo()
    this._pushSlots()
    try { wx.removeStorageSync(MSG_KEY) } catch (e) {}
    /* 新一轮密封：回信入口收起，等待猫把信拿走后再送达回信 */
    this.setData({ comboMessage: '', msgDraft: '', replyReady: false, replyOpen: false, takenTip: false })
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
      /* 信被叼走的同时亮起提示，此后一直保留 */
      this.setData({ sealState: 'taken', takenTip: true })
    }, LETTER_TAKEN_MS)
    this._letterTimer2 = setTimeout(() => {
      /* 动画收尾只撤掉信封图，takenTip 不动——提示继续显示到回信来 */
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
        /* 冷启动时从这里找回最后一封信的 id */
        this._lastSealId = last.id || ''
      }
    } catch (e) {}
    /* 记下这封回信的密封时间，用于卡片栏去重 */
    this._lastSealedAt = sealedAt
    const ready = !!sealedAt && Date.now() - sealedAt >= REPLY_DELAY
    this._clearReplyTimer()
    if (ready) {
      /* 回信抵达：提示收起 */
      const patch = { replyReady: true, takenTip: false }
      this.setData(patch)
    } else {
      const patch = { replyReady: false }
      /* 信封已寄出、回信未到：显示「猫已拿走…」
         （冷启动回到本页也要显示；动画播放中除外） */
      if (this.data.sealState !== 'letter') {
        patch.takenTip = (this.data.sealState === 'taken') || !!sealedAt
      }
      this.setData(patch)
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

  /* 拆开信封：展开猫的回信内容（首次会去问 AI） */
  onReplyOpen() {
    this.setData({ replyOpen: true })
    this._fetchReply()
  },

  /* 猫的回信：把这次组合的物品「象征」+ 用户留言交给 AI，
     生成一段"我看着这几样东西，说我看到了什么"的回信。
     同一封信只生成一次（写回 storage 缓存，重开不再调 AI）。 */
  _fetchReply() {
    let list = []
    try { list = wx.getStorageSync(SEALED_KEY) || [] } catch (e) {}
    if (!Array.isArray(list) || !list.length) return

    /* 找到这一封信：优先用记住的 id，否则取最后一封 */
    let rec = this._lastSealId ? list.find(r => r && r.id === this._lastSealId) : null
    if (!rec) rec = list[list.length - 1]
    if (!rec) return

    /* 已生成过 → 直接用 */
    if (rec.replyText) {
      this.setData({ replyLines: splitReplyLines(rec.replyText) })
      return
    }

    const items = Array.isArray(rec.items) ? rec.items : []
    if (!items.length) {
      this.setData({ replyLines: REPLY_LINES })
      return
    }

    /* 等 AI 的过渡文案 */
    this.setData({ replyLines: ['（猫把这几样东西看了很久）'] })

    wx.cloud.callFunction({
      name: 'moodOperations',
      data: {
        action: 'comboReply',
        items: items.map((it, i) => ({
          slot: it.slot != null ? it.slot : i,
          name: it.name || '',
          symbol: it.symbol || '',
        })),
        message: rec.message || '',
      },
      success: (res) => {
        const r = res && res.result
        const reply = r && r.code === 0 && r.data ? r.data.reply : ''
        if (!reply) {
          this.setData({ replyLines: REPLY_LINES })
          return
        }
        /* 缓存回信，下次打开同一封信不再调 AI */
        rec.replyText = reply
        try { wx.setStorageSync(SEALED_KEY, list) } catch (e) {}
        this.setData({ replyLines: splitReplyLines(reply) })
      },
      fail: (err) => {
        console.warn('[catItem] 猫的回信生成失败:', err && err.message)
        this.setData({ replyLines: REPLY_LINES })
      },
    })
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
      return { slot: i, id: c.itemId, name: it.name || '', category: it.category || '', symbol: it.symbol || '' }
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


