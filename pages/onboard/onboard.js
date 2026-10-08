// pages/onboard/onboard.js — 开屏页（Figma 503_1510）
// 无表单、无头像上传、无强制资料收集
// 唯一入口：点击「开门」图片进入主功能，无自动跳转
// 选猫页（catAdopt）暂时隐藏：统一默认黑猫，直接进猫房
//
// 8 向视线猫（canvas type=2d）：
//   · 8 张 512×512 整猫素材（catGaze/），身体一致仅头部/眼睛方向不同 → 换帧不跳动
//   · 全屏触摸 → 相对猫中心 atan2 角度 → 45° 一档的 8 向分区
//   · 防抖：45° 分区本身粗粒度 + 140ms 最短驻留，边界抖动不切帧
//   · 过渡：帧间线性交叉淡化 140ms（速度均匀不卡顿）
//   · 抬手 600ms 后淡回「上方」待机帧
//   · 8 帧全部预加载完成才首绘，静态 2.png 兜底图先画后藏，无闪烁

/* 默认黑猫（523_427/8.webp），首次进入自动认养 */
const DEFAULT_CAT = {
  index: 4,
  src: '/assets/CodeBuddyAssets/523_427/8.png',
  name: 'Aion 星星猫',
  desc: '',
  isShoot: false,
  adoptedAt: 0,
}

/* 8 向视线素材（索引即方向档位） */
const GAZE_FILES = [
  '/assets/CodeBuddyAssets/catGaze/up.png',          // 0 上
  '/assets/CodeBuddyAssets/catGaze/upperRight.png',  // 1 右上
  '/assets/CodeBuddyAssets/catGaze/right.png',       // 2 右
  '/assets/CodeBuddyAssets/catGaze/lowerRight.png',  // 3 右下
  '/assets/CodeBuddyAssets/catGaze/down.png',        // 4 下
  '/assets/CodeBuddyAssets/catGaze/lowerLeft.png',   // 5 左下
  '/assets/CodeBuddyAssets/catGaze/left.png',        // 6 左
  '/assets/CodeBuddyAssets/catGaze/upperLeft.png',   // 7 左上
]
const GAZE_IDLE = 0          // 待机帧：上方
const GAZE_FADE_MS = 140     // 交叉淡化时长
const GAZE_DWELL_MS = 140    // 同向最短驻留（防抖）
const GAZE_IDLE_DELAY = 600  // 抬手后回待机的延迟

Page({

  data: {
    catFallback: true,   // canvas 8 帧就绪前显示静态兜底猫
  },

  onLoad() {},

  onReady() {
    this.initGaze()
  },

  /* ================= 8 向视线猫 ================= */

  initGaze() {
    const query = this.createSelectorQuery()
    query.select('#gazeCanvas').fields({ node: true, size: true, rect: true }).exec((res) => {
      const info = res && res[0]
      if (!info || !info.node) return
      const canvas = info.node
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
      canvas.width = Math.round(info.width * dpr)
      canvas.height = Math.round(info.height * dpr)
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)

      const gz = this._gaze = {
        canvas, ctx,
        cssW: info.width, cssH: info.height,
        rect: { left: info.left, top: info.top },   // 开屏页无滚动，量一次即可
        imgs: [], draw: null,
        shown: GAZE_IDLE,          // 当前（目标）显示帧
        fadeFrom: GAZE_IDLE, fadeTo: GAZE_IDLE, fadeStart: 0,
        animating: false,
        lastSwitch: 0,
        ready: false, idleTimer: null,
      }

      /* 预加载全部 8 帧；全部回调后统一首绘（onerror 也计数，避免个别失败卡死） */
      let done = 0
      GAZE_FILES.forEach((src, i) => {
        const img = canvas.createImage()
        img.onload = () => { gz.imgs[i] = img; if (++done === GAZE_FILES.length) this._gazeReady() }
        img.onerror = () => { if (++done === GAZE_FILES.length) this._gazeReady() }
        img.src = src
      })
    })
  },

  _gazeReady() {
    const gz = this._gaze
    const img = gz.imgs.find(Boolean)
    if (!img) return                        // 全部加载失败：保留静态兜底猫
    /* contain-fit 绘制矩形（素材 512×512 方形正好铺满；通用逻辑防御异形素材） */
    const s = Math.min(gz.cssW / img.width, gz.cssH / img.height)
    gz.draw = {
      x: (gz.cssW - img.width * s) / 2,
      y: (gz.cssH - img.height * s) / 2,
      w: img.width * s,
      h: img.height * s,
    }
    gz.ready = true
    gz.ctx.drawImage(gz.imgs[GAZE_IDLE], gz.draw.x, gz.draw.y, gz.draw.w, gz.draw.h)
    /* canvas 已画出待机帧 → 再隐藏静态兜底图（先画后藏，无闪烁窗口） */
    this.setData({ catFallback: false })
  },

  /* 手指位置 → 相对猫中心的角度 → 8 向档位 */
  onGazeTouch(e) {
    const t = e.touches && e.touches[0]
    const gz = this._gaze
    if (!t || !gz || !gz.ready || !gz.draw) return
    if (gz.idleTimer) { clearTimeout(gz.idleTimer); gz.idleTimer = null }

    const cx = gz.rect.left + gz.draw.x + gz.draw.w / 2   // 猫的视觉中心（client 坐标）
    const cy = gz.rect.top + gz.draw.y + gz.draw.h / 2
    const ang = Math.atan2(t.clientY - cy, t.clientX - cx)

    /* atan2：0=右、π/2=下、±π=左、-π/2=上 → 档位 k：0=上、2=右、4=下、6=左 */
    let k = Math.round(ang / (Math.PI / 4)) + 2
    k = ((k % 8) + 8) % 8

    /* 防抖：方向档位变了 且 距上次切帧 ≥ 140ms 才切 */
    const now = Date.now()
    if (k !== gz.shown && now - gz.lastSwitch >= GAZE_DWELL_MS) {
      gz.lastSwitch = now
      this._gazeFade(k)
    }
  },

  /* 手指离开 → 延迟淡回待机帧 */
  onGazeEnd() {
    const gz = this._gaze
    if (!gz || !gz.ready) return
    if (gz.idleTimer) clearTimeout(gz.idleTimer)
    gz.idleTimer = setTimeout(() => {
      gz.idleTimer = null
      this._gazeFade(GAZE_IDLE)
    }, GAZE_IDLE_DELAY)
  },

  /* 交叉淡化切帧：旧帧打底，新帧线性淡入 */
  _gazeFade(target) {
    const gz = this._gaze
    if (target === gz.shown || !gz.imgs[target]) return
    if (gz.animating) {
      /* 淡化中途被打断：以画面上更明显的那帧为新起点 */
      const half = (Date.now() - gz.fadeStart) >= GAZE_FADE_MS / 2
      gz.fadeFrom = half ? gz.fadeTo : gz.fadeFrom
    } else {
      gz.fadeFrom = gz.shown
    }
    gz.fadeTo = target
    gz.fadeStart = Date.now()
    gz.animating = true
    gz.shown = target
    this._gazeTick()
  },

  _gazeTick() {
    const gz = this._gaze
    if (!gz.animating) return
    const t = Math.min(1, (Date.now() - gz.fadeStart) / GAZE_FADE_MS)
    const d = gz.draw
    gz.ctx.clearRect(0, 0, gz.cssW, gz.cssH)
    gz.ctx.drawImage(gz.imgs[gz.fadeFrom], d.x, d.y, d.w, d.h)
    if (gz.fadeTo !== gz.fadeFrom && t > 0) {
      gz.ctx.globalAlpha = t            // 线性 → 速度均匀
      gz.ctx.drawImage(gz.imgs[gz.fadeTo], d.x, d.y, d.w, d.h)
      gz.ctx.globalAlpha = 1
    }
    if (t < 1) {
      gz.canvas.requestAnimationFrame(() => this._gazeTick())
    } else {
      gz.animating = false
    }
  },

  /* ================= 进主功能 ================= */

  /* 点击开门图 → 直入猫房；未领养过则先自动认养默认黑猫 */
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
  onUnload() {
    if (this._gaze && this._gaze.idleTimer) clearTimeout(this._gaze.idleTimer)
  },
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {
    return {
      title: 'Aion 星星猫 — 记录情绪 了解内心',
      path: '/pages/onboard/onboard'
    }
  }
})
