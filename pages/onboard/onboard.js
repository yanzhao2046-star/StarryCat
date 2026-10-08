// pages/onboard/onboard.js — 开屏页（Figma 503_1510）
// 无表单、无头像上传、无强制资料收集
// 唯一入口：点击「开门」图片进入主功能，无自动跳转
// 选猫页（catAdopt）暂时隐藏：统一默认黑猫，直接进猫房
//
// 8 向视线猫（canvas type=2d）：
//   · 8 张 512×512 整猫素材（catGaze/），脚部锚点对齐后身体重合、仅头/眼方向不同
//   · 全屏触摸 → 相对猫中心 atan2 角度 → 45° 一档的 8 向分区
//   · 防抖：45° 分区本身粗粒度 + 140ms 最短驻留，边界抖动不切帧
//   · 切帧 = 瞬切（不做交叉淡化：整猫素材头部位移大，淡化必出「双头重影」）
//   · 抬手 600ms 后切回「上方」待机帧
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

/* 8 向视线素材（索引即方向档位，顺时针从「上」开始）。
   想升级 16 向（22.5° 一档）：在两档之间补一张头位中间的图、按顺序插入此数组，
   档位角度/角度→档位的换算自动按数组长度推导，其余代码零改动 */
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
/* 档位角宽：8 张 = 45°/档，16 张 = 22.5°/档（由素材张数决定） */
const GAZE_SECTOR = Math.PI * 2 / GAZE_FILES.length
/* 档位 0 = 「上」在 atan2（0=右、逆时针为负）体系里偏移 N/4 档 */
const GAZE_UP_OFFSET = GAZE_FILES.length / 4
const GAZE_IDLE = 0          // 待机帧：上方
const GAZE_DWELL_MS = 140    // 同向最短驻留（防抖）
const GAZE_IDLE_DELAY = 600  // 抬手后回待机的延迟

/* 脚部锚点对齐（素材像素，实测）：每帧绘制位置的平移量，让 8 帧身体/脚完全重合。
   不对齐时 lowerLeft 偏 -13.6px、lowerRight 偏 +6.6px——瞬切时整猫错位会跳一下 */
const GAZE_FEET_DX = [0, -0.8, 0.6, 6.6, 0.3, -13.6, -0.4, -0.2]
const GAZE_FEET_DY = [0, 0, 0, 3, 0, 0, 0, -1]

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
        imgs: [], draw: null, srcScale: 1,
        shown: GAZE_IDLE,          // 当前显示帧
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
    gz.srcScale = s
    gz.draw = {
      x: (gz.cssW - img.width * s) / 2,
      y: (gz.cssH - img.height * s) / 2,
      w: img.width * s,
      h: img.height * s,
    }
    gz.ready = true
    this._gazeDrawImg(GAZE_IDLE)
    /* canvas 已画出待机帧 → 再隐藏静态兜底图（先画后藏，无闪烁窗口） */
    this.setData({ catFallback: false })
  },

  /* 带脚部锚点对齐的单帧绘制：idx 帧平移 GAZE_FEET_DX/DY × srcScale 后画 */
  _gazeDrawImg(idx) {
    const gz = this._gaze
    const img = gz.imgs[idx]
    if (!img) return
    const d = gz.draw
    const x = d.x + (GAZE_FEET_DX[idx] || 0) * gz.srcScale
    const y = d.y + (GAZE_FEET_DY[idx] || 0) * gz.srcScale
    gz.ctx.drawImage(img, x, y, d.w, d.h)
  },

  /* 瞬切帧：整猫素材头部位移大，交叉淡化必然「双头重影」；脚部已对齐，瞬切读作干脆转头 */
  _gazeSwitch(target) {
    const gz = this._gaze
    if (target === gz.shown || !gz.imgs[target]) return
    gz.shown = target
    gz.ctx.clearRect(0, 0, gz.cssW, gz.cssH)
    this._gazeDrawImg(target)
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

    /* atan2：0=右、π/2=下、±π=左、-π/2=上 → 档位 k = round(ang/档宽) + N/4（0=上，顺时针） */
    const N = GAZE_FILES.length
    let k = Math.round(ang / GAZE_SECTOR) + GAZE_UP_OFFSET
    k = ((k % N) + N) % N

    /* 防抖：方向档位变了 且 距上次切帧 ≥ 140ms 才切 */
    const now = Date.now()
    if (k !== gz.shown && now - gz.lastSwitch >= GAZE_DWELL_MS) {
      gz.lastSwitch = now
      this._gazeSwitch(k)
    }
  },

  /* 手指离开 → 延迟切回待机帧 */
  onGazeEnd() {
    const gz = this._gaze
    if (!gz || !gz.ready) return
    if (gz.idleTimer) clearTimeout(gz.idleTimer)
    gz.idleTimer = setTimeout(() => {
      gz.idleTimer = null
      this._gazeSwitch(GAZE_IDLE)
    }, GAZE_IDLE_DELAY)
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
