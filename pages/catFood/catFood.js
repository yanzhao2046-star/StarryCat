/* ============================================================
   pages/catFood/catFood.js — 猫粮 (Figma 460_1279 + 490_1508)
   · 12 种配方原料（三类 + 维生素），各有营养值/克
   · 点击一次 → 库存减 1 克、碗中加 1 克（长按退回 1 克）
   · 维生素至少 1 克才能合成；库存每天重置补给
   · 「碗中 xx 克」换算显示为营养值 = Σ(克数 × 营养值/克)
   · 点击「生成猫粮」→ 校验三类齐全 + 维生素 1 克，
     合成后粮袋累计营养值，碗清空，袋子弹一下
   · 粮袋状态（empty/low/medium/full）随营养值变化
   ============================================================ */

const APP = getApp()
const {
  FOODS, getFoodById,
  calcNutrition, calcBowlGram
} = require('../../utils/foods.js')

const BAG_LABELS = ['粮袋空', '干瘪', '半满', '饱满']
const BAG_FULL_VALUE = 80  // 与 app.js 的 _calcBagLevel 保持一致：≥80 为「饱满」

Page({

  data: {
    foods: [],                   // 展示用原料列表（含剩余库存 left）
    bowl: [],                    // 碗中：[{foodId, gram, icon, lx, ly, r, z}]
    bowlPreview: [],             // 碗中预览（最多渲染 6 种）
    bowlGram: 0,                 // 碗中总克数
    bowlNutrition: 0,            // 碗中营养值（Σ 克数 × 营养值/克）
    bowlCount: 0,                // 碗中原料种数
    totalGram: 0,                // 粮袋累计营养值
    bagLevel: 0,                 // 0 empty | 1 low | 2 medium | 3 full
    bagLabel: '粮袋空',
    bagPercent: 0,                // 粮袋进度（0~100，满值 80 营养）
    bagAnim: false                // 合成成功时袋子弹动
  },

  onLoad() {
    this._refresh()
    APP.checkStray && APP.checkStray()
  },

  onShow() {
    this._refresh()
    APP.checkStray && APP.checkStray()
  },

  /* ============================================================
     数据刷新
     ============================================================ */
  _refresh() {
    const state = APP.getCatFoodState ? APP.getCatFoodState() : { totalGram: 0, bowl: [], stock: {}, bagLevel: 0 }
    const stock = state.stock || {}

    /* 原料列表：带剩余库存 */
    const foods = FOODS.map(f => ({
      id: f.id,
      name: f.name,
      tier: f.tier,
      icon: f.icon,
      value: f.value,
      left: typeof stock[f.id] === 'number' ? stock[f.id] : f.gram
    }))

    /* 碗中数据：带 icon / 槽位等渲染信息 */
    const bowl = (state.bowl || []).map((b, i) => {
      const food = getFoodById(b.foodId) || {}
      const slot = this._slotAt(i)
      return {
        id: 'bowl-' + i + '-' + (b.foodId || ''),
        foodId: b.foodId,
        gram: b.gram,
        icon: food.icon || '',
        lx: slot.x, ly: slot.y, r: slot.r, z: 10 + i
      }
    })

    const bowlGram = calcBowlGram(state.bowl)
    const totalGram = state.totalGram || 0

    this.setData({
      foods,
      bowl,
      bowlPreview: bowl.slice(-6), // 碗中只渲染最近 6 种，避免堆太满
      bowlGram,
      bowlNutrition: calcNutrition(state.bowl),
      bowlCount: bowl.length,
      totalGram,
      bagLevel: state.bagLevel || 0,
      bagLabel: BAG_LABELS[state.bagLevel || 0] || '粮袋空',
      bagPercent: Math.min(100, Math.round((totalGram / BAG_FULL_VALUE) * 100))
    })
  },

  /* 碗中位置（错位叠放）—— 围绕中心 (50, 60%) 微旋转 */
  _slotAt(i) {
    const cx = 50, cy = 60
    if (i >= 6) {
      const k = i - 6
      return {
        x: cx + (k % 2 ? 6 : -6) - (k * 0.5),
        y: cy + ((k % 3) - 1) * 4,
        r: ((i * 37) % 20) - 10
      }
    }
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
    const r = 12
    return {
      x: cx + Math.cos(angle) * r - 1,
      y: cy + Math.sin(angle) * r,
      r: ((i * 53) % 30) - 15
    }
  },

  /* ============================================================
     点击原料一次 → 库存减 1 克、碗中加 1 克
     ============================================================ */
  onFoodTap(e) {
    const id = e.currentTarget.dataset.id
    const food = getFoodById(id)
    if (!food) return

    const state = APP.getCatFoodState()
    const stock = state.stock || (state.stock = {})
    const bowl = state.bowl || (state.bowl = [])

    /* 库存检查：点一次少一克 */
    const left = typeof stock[id] === 'number' ? stock[id] : food.gram
    if (left <= 0) {
      wx.showToast({ title: '「' + food.name + '」库存用完了，明天补给', icon: 'none', duration: 1200 })
      return
    }

    stock[id] = left - 1
    const entry = bowl.find(b => b.foodId === id)
    if (entry) entry.gram += 1
    else bowl.push({ foodId: id, gram: 1 })

    APP._saveCatFoodState(state)
    this._refresh()
  },

  /* ============================================================
     长按原料 → 退回 1 克（碗 → 库存）
     ============================================================ */
  onFoodLongPress(e) {
    const id = e.currentTarget.dataset.id
    const state = APP.getCatFoodState()
    const bowl = state.bowl || []
    const entry = bowl.find(b => b.foodId === id)
    if (!entry || entry.gram <= 0) return

    entry.gram -= 1
    if (entry.gram <= 0) {
      bowl.splice(bowl.indexOf(entry), 1)
    }

    const stock = state.stock || (state.stock = {})
    stock[id] = (stock[id] || 0) + 1

    APP._saveCatFoodState(state)
    this._refresh()
  },

  /* ============================================================
     生成猫粮 → 喂猫（三类齐全 + 维生素至少 1 克）
     ============================================================ */
  onFeed() {
    if (this.data.bowlGram <= 0) {
      wx.showToast({ title: '碗里还没有原料', icon: 'none', duration: 900 })
      return
    }
    const r = APP.feedCatFromBowl()
    if (!r || !r.ok) {
      wx.showToast({ title: (r && r.reason) || '生成失败', icon: 'none', duration: 1600 })
      return
    }
    wx.showToast({
      title: '合成 ' + r.gram + 'g → 营养值 +' + r.nutrition,
      icon: 'success',
      duration: 1400
    })
    this._refresh()
    this._popBag()
  },

  /* 粮袋弹动一下（合成成功反馈） */
  _popBag() {
    if (this._bagTimer) clearTimeout(this._bagTimer)
    this.setData({ bagAnim: false })
    // 先复位再置位，保证连续合成也能重新触发动画
    setTimeout(() => {
      this.setData({ bagAnim: true })
      this._bagTimer = setTimeout(() => {
        this.setData({ bagAnim: false })
        this._bagTimer = null
      }, 520)
    }, 20)
  },

  /* ============================================================
     点击粮袋 → 查看剩余营养值
     ============================================================ */
  onBagTap() {
    const { totalGram, bagLabel } = this.data
    wx.showToast({
      title: totalGram > 0 ? `粮袋${bagLabel} · 营养值 ${totalGram}` : '粮袋空了，快去合成猫粮吧',
      icon: 'none',
      duration: 1400
    })
  },

  onUnload() {
    if (this._bagTimer) clearTimeout(this._bagTimer)
  },

  /* ============================================================
      返回
      ============================================================ */
  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
  },

  /* ========== 底部导航 ========== */
  onTabChange(e) {
    const key = e.detail.key
    const routes = {
      room: '/pages/catRoom/catRoom',
      mood: '/pages/catMoodLib/catMoodLib',
      store: '/pages/catItem/catItem',
      kitchen: '/pages/catFood/catFood',
      realm: '/pages/realm/realm'
    }
    if (routes[key] && key !== 'kitchen') {
      wx.redirectTo({ url: routes[key] })
    }
  }
})
