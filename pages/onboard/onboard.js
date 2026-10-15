// pages/onboard/onboard.js — 开屏页（Figma 1800_312）
// 无表单、无头像上传、无强制资料收集
// 唯一入口：长按猫 3 秒（时间环压满）进入猫房，无自动跳转
// 选猫页（catAdopt）暂时隐藏：统一默认黑猫，直接进猫房
//
// 时间环：canvas 2d 画环形进度，touchstart 淡入 → 每 33ms 步进
//        松手 / 移出 → 立刻清零，压满后走 goHome()

/* 默认黑猫（523_427/8.png），首次进入自动认养 */
const DEFAULT_CAT = {
  index: 4,
  src: '/assets/CodeBuddyAssets/523_427/8.png',
  name: 'Aion 星星猫',
  desc: '',
  isShoot: false,
  adoptedAt: 0,
}

const HOLD_MS = 3000   // 长按压满时长（3 秒）
const TICK_MS = 33     // 进度刷新间隔（约 30fps）

Page({

  data: {
    pressing: false,   // 是否正在长按（控制时间环淡入淡出）
  },

  onLoad() {},
  onReady() { this._initRing() },

  /* ==========================================================
     长按时间环（canvas 2d）
     ========================================================== */
  _initRing() {
    wx.createSelectorQuery().in(this)
      .select('#ringCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!(res && res[0] && res[0].node)) return
        const node = res[0].node
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
        node.width = res[0].width * dpr
        node.height = res[0].height * dpr
        const ctx = node.getContext('2d')
        ctx.scale(dpr, dpr)
        this._ring = { ctx, w: res[0].width, h: res[0].height }
      })
  },

  onPressStart() {
    if (this._gone || this._pressing) return
    this._pressing = true
    this._startAt = Date.now()
    this.setData({ pressing: true })
    this._drawRing(0)
    this._ringTimer = setInterval(() => {
      const p = Math.min(1, (Date.now() - this._startAt) / HOLD_MS)
      this._drawRing(p)
      if (p >= 1) {
        this._resetPress()
        this.goHome()
      }
    }, TICK_MS)
  },

  onPressEnd() {
    if (!this._pressing) return
    this._resetPress()
  },

  /* 松手 / 压满后：清计时器 + 清环 */
  _resetPress() {
    if (this._ringTimer) { clearInterval(this._ringTimer); this._ringTimer = null }
    this._pressing = false
    this.setData({ pressing: false })
    this._drawRing(0)
  },

  /* 画环：p ∈ [0,1]，底环淡黑 + 进度环实黑，起点正上方顺时针 */
  _drawRing(p) {
    if (!this._ring) return
    const { ctx, w, h } = this._ring
    const cx = w / 2
    const cy = h / 2
    const r = Math.min(w, h) / 2 - 5
    const lw = 5
    ctx.clearRect(0, 0, w, h)

    /* 底环（始终有，给用户一个"要按住这里"的暗示） */
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)'
    ctx.lineWidth = lw
    ctx.stroke()

    /* 进度环 */
    if (p > 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = lw
      ctx.lineCap = 'round'
      ctx.stroke()
    }
  },

  /* ==========================================================
     进入猫房（压满后触发；未领养过则先自动认养默认黑猫）
     ========================================================== */
  goHome() {
    if (this._gone) return
    this._gone = true

    let chosen = wx.getStorageSync('selectedCat')
    if (!(chosen && typeof chosen.index === 'number' && chosen.index >= 0)) {
      chosen = { ...DEFAULT_CAT, adoptedAt: Date.now() }
      wx.setStorageSync('selectedCat', chosen)
      /* 同步互动身份：猫名 + 猫作为头像（与 catAdopt 认养逻辑一致） */
      try {
        const profile = wx.getStorageSync('userProfile') || {}
        profile.catName = chosen.name
        profile.avatarPath = chosen.src
        if (!profile.nickname) profile.nickname = chosen.name
        wx.setStorageSync('userProfile', profile)
      } catch (err) {
        console.warn('[onboard] 保存互动身份失败:', err)
      }
    }

    wx.redirectTo({
      url: '/pages/catRoom/catRoom',
      fail() {
        wx.navigateTo({ url: '/pages/catRoom/catRoom' })
      }
    })
  },

  onShow() {},
  onHide() {},
  onUnload() { this._resetPress() },
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {
    return {
      title: 'Aion 星星猫 — 记录情绪 了解内心',
      path: '/pages/onboard/onboard'
    }
  }
})
