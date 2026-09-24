/* ============================================================
   pages/realm/realm.js — 秘境 · 等距体素攀爬关卡

   【坐标系 · 真正的 90³ 立方体网格】
     等距三轴 X / Y / Z；一个单元格 = 90 × 90 × 90（Z 也参与单位系统）
     屏幕投影：X/Y 每格 = (hw, -hh)，Z 每格 = Z_K · hh = 2·hh（三轴等长，真等距）
     块体落在网格列上会向上堆叠：z（底面高度）由该列当前顶面高度决定
     1 级立方 = CELL = 90；半高台阶 = HALF = CELL/2 = 45（A / B 的高度）

     【关卡构成 · A·B 固定，9 件搭桥】
    棋盘 12 × 12 = 144 格（A / B 各占 1 格，可落 142 格）
     BASE（关卡自带）：
       · A 起点  绿色半高台阶  90×90×45    初始 (7, 3)，顶面 z = 45   ← 完全锁定，不可拖动
       · B 终点  粉色半高台阶  90×90×45    在 (7, 9)，顶面 z = 315  ← 完全锁定（抬升 3 格）
     A 是「可堆叠的固定块」：本身不可拖动，但其它块可以叠在它顶上（半高块叠 A = 拼成完整立方）
     A 被盖住时不可直接拖动，需先移开上面的块
     A 的实时位置就是 BFS 起点（不读 LEVEL.start 静态值）
     物料库（tray）= 9 个块体（三种体块：半高 / 正方体 / 长方体）：
       · half  ×5     半高块  90 × 90 × 45
       · cube  ×3     正方体  90 × 90 × 90
       · bar   ×1     长方体  270 × 90 × 90（占 3 格）
     玩家拖出全部 9 件，从 A 顶（z=45）沿高差规则 BFS 到 B 顶（z=315）即为通关

     【连通规则 · 本关核心 · Z 必须参与】
     只有「块体顶面」才是路 —— 某列没有块体（空地）就是坑，站不上去
     相邻两格顶面高差满足下列条件之一即「可通行」：
           Δz =    0   同一水平面   可通行（平接 / 同高）
           Δz = ± 45   半高台阶      可通行（A / B 就是这一级，上得去下得来）
           Δz = ± 90   一级立方      可通行（玩家堆上去的 / 走下来）
           Δz ≠ {0, ±45, ±90}        不通 —— 高度跳变没有落脚点
     从「起点」按该规则 BFS 扩散，能到达「终点」即判定连通
     ※「空地不是路」是必须的：否则 A(45) → 平地(0) → B(45) 开局即连通，关卡失去意义

   【画布层次】
       ① 最底层：单元网格参考线（z = 0 地面平面）+ 四角竖线暗示 Z 轴 —— SHOW_GRID 开关，默认关
       ② 块体：画家算法 远→近 / 同列 低→高
       ③ 起点 / 终点标记（A / B 文字浮在绿/粉顶面）
       ④ 拖拽预览（绿=可放 / 红=不可放）

     【拖动吸附规则（三层）】
       ① 边线磁吸：拖动块的某个角贴近现存块（A 或可互动块）的某个角时，自动角对角对齐
          —— 1×1 块紧挨 A 时无缝咬合，1×3 长方体端头与 A 棱线齐平；B 也作为吸附参考
       ② 默认吸附：地面格子吸附 + resolvePlacement 自动堆到该列顶面（地面 / 已叠块体顶上）
       ③ A 的特例吸附：拖的是非 A 块（half / cube / bar）、且指尖压在 A 顶面菱形内 → 强制叠到 A 顶
          （半高 / 正方体叠 A 时接缝严丝合缝，组成完整立方）
     ============================================================ */

/* ---------------- 基本量 ---------------- */
/* 物料来源：猫叼回的楼梯部件（catRoom 的 giveStairs 行为落盘，见 utils/catBehaviorOutputs.js） */
const outputs = require('../../utils/catBehaviorOutputs.js')

const CELL = 90            // 单元格棱长（X / Y / Z 三轴共用，整数化）
const Z_UNIT = CELL        // 1 个 z 单位 = 1 个 CELL = 90（90³ 体系下和 CELL 等价）
const HALF = CELL / 2      // 半高台阶 = 45 —— A / B 的高度，也是最小可迈高差

/* Z 轴在屏幕上的投影系数 —— 真等距成立的关键
   依据设计稿 assets/CodeBuddyAssets/realm/cube.svg（棱长 1 的立方体）：
     顶面菱形   水平 1.732 = 2·hw   竖直 1.0 = 2·hh
     侧面竖棱   1.0       = 2·hh   （中棱 (0.866,1) → (0.866,2)）
   X / Y / Z 三轴的屏幕投影长度相等，故 1 个 CELL 的竖直投影 = 2·hh。
   即 zScale = Z_K · hh / Z_UNIT；取 1 会把立方体压成一半厚的「贴地薄片」。 */
const Z_K = 2

const ALLOW_STEP_DOWN = true    // 是否允许往下走（下一级台阶 / 下一级立方）；只升不降则改为 false
const REQUIRE_ALL_USED = true   // 通关是否要求组件池全部用完

const DEBUG_TOUCH = false       // 调试开关：true 时把触摸命中的诊断信息打到控制台

/* 边线磁吸阈值（screen px）
   THRESH = max(THRESH_BASE, THRESH_K · hw)
   · 14 是「最小有效吸附距离」，低于这个对用户来说只是「抖」
   · 0.32 是「边线吸住」相对格宽的敏感度；
     之前 24 / 0.6 太敏感（远处就被吸住） */
const THRESH_BASE = 14
const THRESH_K    = 0.32

/* 贴地 vs 悬空歧义消解：长方体拖到现有块背面附近时，
   悬空吸附（顶/边）候选的距离 ≥ 此系数 × 贴地（face）候选时，
   强制回落到贴地面吸附，避免「总吸到棱线上」。
   0.85 是经验值；调小→更激进走悬空，调大→更保守走贴地 */
const SUSPENDED_SNAP_RATIO = 0.85

/* ---------------- 块体定义（90³ 基准） ---------------- */
const PIECE_DEF = {
  half:       { w: 1, d: 1, h: HALF },   // 半高块 90×90×45（三种体块之一）
  cube:       { w: 1, d: 1, h: CELL },   // 正方体 90×90×90
  bar:        { w: 3, d: 1, h: CELL },   // 长方体 270×90×90（占 3 格）
  half_start: { w: 1, d: 1, h: HALF },   // A 起点：绿色半高台阶 90×90×45
  half_end:   { w: 1, d: 1, h: HALF },   // B 终点：粉色半高台阶 90×90×45
}

/* ---------------- 配色 / 描边（取自 assets/CodeBuddyAssets/1318_344 面片） ---- */
const PALETTE = {
  normal: { top: '#DDE5F4', left: '#C8D4E8', right: '#B8C5DC' },
  pink:   { top: '#F5E0EA', left: '#E8C9DB', right: '#DCB7D2' },   // half_end
  green:  { top: '#DDEFD9', left: '#C8DDC0', right: '#B8D5A8' },   // half_start
}
const STROKE = '#4A5568'
const STROKE_K = 1.6 / 77.94        // 描边宽 = 0.0205 × hw（与 Figma 面片同比例）

const ISO_K = Math.sqrt(3) / 3      // 真等距 hh/hw ≈ 0.5774（30° 轴测，非 2:1）

const SHOW_GRID = true                  // 地面网格参考线：默认开，画面里隐约能看到格子走向（很淡，不抢戏）
const GRID_FILL = 'rgba(74, 85, 104, 0.02)'    // 单元网格：填充（比描边还淡，仅在亮底色时能感觉到）
const GRID_LINE = 'rgba(74, 85, 104, 0.08)'    // 单元网格：描边
const GRID_AXIS = 'rgba(74, 85, 104, 0.05)'    // 四角竖线

/* ============================================================
   关卡数据（样板：以后由编辑器 / 猫定期发放）
   ============================================================ */

/* 把一列固定块写成块体数组（自地面往上堆，全部 90 整数倍） */
function stack(x, y, heights, opts = {}) {
  const out = []
  let z = 0
  heights.forEach(h => {
    out.push({ x, y, z, w: 1, d: 1, h, kind: 'cube', fixed: true, ...opts })
    z += h
  })
  return out
}

/* 物料库分组定义 → N 个独立块体（每个块体各自可被拖出 / 收回 / 用掉） */
function expandTray(tray) {
  const out = []
  tray.forEach(g => {
    for (let i = 0; i < g.count; i++) out.push({ type: g.type, used: false })
  })
  return out
}

/* 物料库以 storage 为准：猫带回多少块体，这里就有多少（没带回就是空库） */
function buildTray() {
  const m = outputs.getMaterials()
  return [
    { type: 'half', count: m.half },   // 半高块 90×90×45
    { type: 'cube', count: m.cube },   // 正方体 90×90×90
    { type: 'bar',  count: m.bar  },   // 长方体 270×90×90
  ]
}

const BASE = [
  // A：意识，绿色半高台阶（顶 z=45）· 完全锁定：不可拖动；stackable = 其它块可叠其顶（搭桥起点）
  // 位置按原型截屏摆：近端偏右 (7,3)
  { x: 7, y: 3, z: 0, w: 1, d: 1, h: HALF, kind: 'half_start', fixed: true, stackable: true },
  // B：潜意识，粉色半高台阶（抬升 3 格 = z 270 + h HALF = 顶面 z 315）
  // 完全锁定：不可拖动、其上不可堆叠（搭桥终点）。位置按原型截屏摆：第 7 列、第 8 行
  { x: 7, y: 9, z: CELL * 3, w: 1, d: 1, h: HALF, kind: 'half_end',   fixed: true },
]

const LEVEL = {
  nx: 12, ny: 12,                               // 12 列 × 12 排 = 144 格（更细的网格）
  // A / B 完全锁定：位置固定，BFS 起终点由 board 上的固定块实时取（startAnchor / endAnchor）
  end:   { x: 7, y: 9, z: CELL * 3 + HALF },     // B 潜意识：固定半高台阶，顶面 z = 315（3 格抬升 + h=HALF）
  tray: [                                       // 物料库：11 个块体（顺序 = 界面分组顺序）
    { type: 'half', count: 5 },                 // 半高块 90×90×45
    { type: 'cube', count: 3 },                 // 正方体 90×90×90
    { type: 'bar',  count: 1 },                 // 长方体 270×90×90
  ],
  base: BASE,
}

/* 实时时钟：HH:MM:SS，每秒走动（当前系统时间） */
function fmtClock(d) {
  const p = n => (n < 10 ? '0' + n : '' + n)
  /* 带年：「2026年 14:23:45」—— 居中放在物料气泡上方 */
  return `${d.getFullYear()}年 ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/* 竖直方向需要预留的高度（同时决定画面比例尺）
   本关 A·B 顶面 z = 45，搭桥通常在 2~3 层内；预留 6 层（z = 540）足够。
   预留越大 → calcLayout 里竖直约束越紧 → 整体比例尺越小 */
const MAX_Z = CELL * 6

/* ============================================================
   等距几何（纯函数）
     sx = ox + (x - y) * hw
     sy = oy - (x + y) * hh - z * zScale
   · 近角是 (0,0)：屏幕最下方，+x 朝右上、+y 朝左上
   · 可见面：顶面 + x=x1 面（左）+ y=y1 面（右）
   ============================================================ */

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

function proj(L, gx, gy, gz) {
  return [L.ox + (gx - gy) * L.hw, L.oy - (gx + gy) * L.hh - gz * L.zScale]
}

/* 块体类型 → 配色（half_start 绿 / half_end 粉 / 其他 normal） */
function palForKind(kind) {
  if (kind === 'half_start') return PALETTE.green
  if (kind === 'half_end')   return PALETTE.pink
  return PALETTE.normal
}

/* box: { x, y, z, w, d, h } —— z 是底面高度 */
function boxQuads(box, L) {
  const { x: x1, y: y1, w, d, h } = box
  const zb = box.z || 0
  const zt = zb + h
  const x2 = x1 + w, y2 = y1 + d
  const P = (gx, gy, gz) => proj(L, gx, gy, gz)
  return {
    top:   [P(x2, y2, zt), P(x2, y1, zt), P(x1, y1, zt), P(x1, y2, zt)],
    left:  [P(x1, y2, zt), P(x1, y1, zt), P(x1, y1, zb), P(x1, y2, zb)],
    right: [P(x1, y1, zt), P(x2, y1, zt), P(x2, y1, zb), P(x1, y1, zb)],
  }
}

function quadPath(ctx, pts) {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

/* 高度投影：在 xz / yz 两个可见墙面上画块体 4 个顶角到地面的很淡虚线
   · 4 角下投虚线同时落在两个墙面上（线段在固定 x 处属于 yz 面，在固定 y 处属于 xz 面）
   · 在块体绘制之前调用，块面会盖掉内部那一段，露出块体下方真实的高度
   · 仅对 z>0 的块画投影（贴地块已无需高度提示）*/
function drawHeightProjection(ctx, box, L) {
  const z = box.z || 0
  if (z <= 0) return
  const { x, y, w, d, h } = box
  const zt = z + h
  const corners = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]]
  ctx.save()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  for (const [cx, cy] of corners) {
    const [tx, ty] = proj(L, cx, cy, zt)
    const [bx, by] = proj(L, cx, cy, 0)
    ctx.beginPath()
    ctx.moveTo(tx, ty)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }
  ctx.restore()
}

function drawIsoBox(ctx, box, L, pal, opts = {}) {
  const q = boxQuads(box, L)
  const lw = opts.lineWidth != null ? opts.lineWidth : STROKE_K * L.hw
  ctx.save()
  if (opts.alpha != null) ctx.globalAlpha = opts.alpha
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const face = (pts, fill) => {
    quadPath(ctx, pts)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.lineWidth = lw
    ctx.strokeStyle = opts.stroke || STROKE
    ctx.stroke()
  }
  face(q.top, pal.top)
  face(q.left, pal.left)
  face(q.right, pal.right)
  ctx.restore()
}

function overlayTop(ctx, box, L, color) {
  const q = boxQuads(box, L)
  quadPath(ctx, q.top)
  ctx.fillStyle = color
  ctx.fill()
}

function inPoly(px, py, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/* 画布像素 → 网格坐标（真等距的逆变换）
   gz = 反投影所在的水平面高度（默认 0 = 地面）；传块体底面高度就能算出「块体所在的那一层格子」
   返回 x / y 为整数格（floor）；u / v 为浮点格坐标，供抓取偏移（相对步进）使用 */
function cellFromPoint(px, py, L, gz = 0) {
  const dx = px - L.ox, dy = L.oy - gz * L.zScale - py
  const u = (dx / L.hw + dy / L.hh) / 2       // → x
  const v = (dy / L.hh - dx / L.hw) / 2       // → y
  return { x: Math.floor(u), y: Math.floor(v), u, v }
}

/* ============================================================
   页面
   ============================================================ */

Page({

  data: {
    headIcon: '/assets/CodeBuddyAssets/458_1225/3.svg',
    catSrc:   '/assets/CodeBuddyAssets/458_1225/5.png',
    clock:    '',
    statusBarHeight: 20,
    tray: [],
    tipText: '拖动上方块体到这里',
    linked: false,
    /* 秘境工具条：最近一次生成的留言 + 猫回复（保存时一并落盘） */
    realmMessage: '',
    catReply: '',
    /* 调试：吸附模式（'edge' = 边线磁吸 + A 特例；'off' = 仅地面格子吸附） */
    snapMode: 'edge',
    snapLabel: '边线+A',
    showGridLabel: '开',
  },

  /* 实时时钟：每秒刷新 HH:MM:SS（当前系统时间） */
  startClock() {
    this.stopClock()
    this.setData({ clock: fmtClock(new Date()) })
    this._clockTimer = setInterval(() => {
      this.setData({ clock: fmtClock(new Date()) })
    }, 1000)
  },

  stopClock() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer)
      this._clockTimer = null
    }
  },

  /* ---------------- 生命周期 ---------------- */

  onLoad() {
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      if (info && info.statusBarHeight) {
        this.setData({ statusBarHeight: info.statusBarHeight })
      }
    } catch (e) { /* 保持默认 */ }

    /* 物料库：从猫带回来的物料初始化 */
    this._tray = buildTray()

    /* 游戏运行态（不进 data，避免频繁 setData） */
    this.game = {
      board: LEVEL.base.map(b => ({ ...b })),
      pieces: expandTray(this._tray),   // 猫叼回的块体：{ type, used }
      drag: null,        // { from: 'tray'|'board', type, index, origin }
      pendingDraw: false, // 一帧一次重绘的合并标记
      preview: null,     // { box, valid }
      linked: false,
      won: false,
      ctx: null, canvas: null,
      layout: null, cssW: 0, cssH: 0,
      boardRect: null, invRect: null,   // 存的是「页面坐标」= 视口坐标 + 测量时的 scrollTop
      scrollTop: 0,
      /* 调试开关（由调试条控制） */
      _snapMode: 'edge', // 'edge' 边线+A；'off' 仅地面
      _showGrid: true,
    }

    this.syncTray()
    this.syncTip()
    this.startClock()
  },

  onReady() {
    this.initBoardCanvas()
    this.initThumbs()
  },

  onShow() {
    if (this.game && this.game.ctx) this.syncRects()
    this.refreshTrayIfNew()    // 期间猫又叼回了新物料 → 补进物料库
    this.startClock()          // 从别的页面回来继续走
  },

  /* 猫带回的物料变多了 → 重建物料库（已放上画布的块由 reconcilePieces 重新核对占用） */
  refreshTrayIfNew() {
    if (!this.game) return
    const fresh = buildTray()
    const sum = t => (t || []).reduce((s, g) => s + g.count, 0)
    if (sum(fresh) <= sum(this._tray)) return
    this._tray = fresh
    this.game.pieces = expandTray(this._tray)
    this.reconcilePieces()
    this.syncTray()
    this.syncTip()
  },

  onHide() { this.stopClock() },
  onUnload() { this.stopClock() },

  /* 页面滚动 → 只更新基准值（rect 存的是页面坐标，触摸点要 +scrollTop 才对齐）
     拖动途中若还收到滚动事件 = 页面在偷偷滚（画面会「抖」且坐标会漂）→ 打日志便于定位 */
  onPageScroll(e) {
    if (!this.game) return
    this.game.scrollTop = e.scrollTop || 0
    if (DEBUG_TOUCH && this.game.drag) {
      console.warn('[realm] 拖动中页面仍在滚动 scrollTop=', this.game.scrollTop)
    }
  },

  /* ---------------- 画布初始化 ---------------- */

  initBoardCanvas() {
    const query = this.createSelectorQuery()
    query.select('#board').fields({ node: true, size: true, rect: true })
    query.select('.inventory').boundingClientRect()
    query.selectViewport().scrollOffset()      // 页面可能已经滚动过 → 取当前 scrollTop 当基准
    query.exec((res) => {
      const board = res[0]
      if (!board || !board.node) return
      const canvas = board.node
      const ctx = canvas.getContext('2d')
      const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
      canvas.width = board.width * dpr
      canvas.height = board.height * dpr
      ctx.scale(dpr, dpr)

      this.game.ctx = ctx
      this.game.canvas = canvas
      this.game.cssW = board.width
      this.game.cssH = board.height
      this.game.scrollTop = res[2] ? (res[2].scrollTop || 0) : 0
      this.setRects(board, res[1], this.game.scrollTop)
      this.game.layout = this.calcLayout(board.width, board.height)

      this.draw()
    })
  },

  /* 重新量 rect（回本页 / 布局变化时用） */
  syncRects() {
    const query = this.createSelectorQuery()
    query.select('#board').boundingClientRect()
    query.select('.inventory').boundingClientRect()
    query.selectViewport().scrollOffset()
    query.exec((res) => {
      const g = this.game
      if (!g || !res || !res[0]) return
      g.scrollTop = res[2] ? (res[2].scrollTop || 0) : g.scrollTop
      this.setRects(res[0], res[1], g.scrollTop)
    })
  },

  /* 统一口径：rect 一律换算成「页面坐标」存放
     boundingClientRect 给的是视口坐标，页面滚动后会变；加上测量时的 scrollTop 就与滚动无关了 */
  setRects(boardR, invR, st) {
    const g = this.game
    g.boardRect = {
      left: boardR.left, right: boardR.right,
      top: boardR.top + st, bottom: boardR.bottom + st,
    }
    g.invRect = invR ? {
      left: invR.left, right: invR.right,
      top: invR.top + st, bottom: invR.bottom + st,
    } : null
  },

  /* 组件池缩略图（各画一个等距块体，共用一套比例尺，与画布同一套公式） */
  initThumbs() {
    const defs = this._tray || buildTray()
    const query = this.createSelectorQuery()
    defs.forEach((_, i) => query.select(`#thumb${i}`).fields({ node: true, size: true }))
    query.exec((res) => {
      if (!res) return
      const first = res.find(r => r && r.node)
      if (!first) return

      const PAD = 4
      /* 以组件池里「占地面积最大」的块体定标尺，其余同比例居中 */
      const spans = defs.map(d => {
        const def = PIECE_DEF[d.type]
        return { x: def.w + def.d, y: def.w + def.d + (def.h / Z_UNIT) * Z_K }
      })
      const spanX = Math.max(...spans.map(s => s.x))
      const spanY = Math.max(...spans.map(s => s.y))
      const hwMax = Math.min(
        (first.width  - PAD * 2) / spanX,
        (first.height - PAD * 2) / (spanY * ISO_K),
      )

      res.forEach((r, i) => {
        if (!r || !r.node) return
        const canvas = r.node
        const ctx = canvas.getContext('2d')
        const dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).pixelRatio || 2
        canvas.width = r.width * dpr
        canvas.height = r.height * dpr
        ctx.scale(dpr, dpr)

        const def = PIECE_DEF[defs[i].type]
        const hh = hwMax * ISO_K
        const L = { hw: hwMax, hh, zScale: hh * Z_K / Z_UNIT, ox: 0, oy: 0 }
        const w = (def.w + def.d) * L.hw
        const h = (def.w + def.d) * L.hh + def.h * L.zScale
        L.ox = (r.width - w) / 2 + def.d * L.hw
        L.oy = (r.height - h) / 2 + h
        drawIsoBox(ctx, { x: 0, y: 0, z: 0, ...def }, L, palForKind(defs[i].type))
      })
    })
  },

  /* 等距布局：网格铺满画布并居中
     · 水平跨度 = (nx + ny) · hw
     · 竖直跨度 = [(nx + ny) + MAX_Z/Z_UNIT · Z_K] · hh
     · 取横竖两个约束里更小的 hw，保证整体不溢出 */
  calcLayout(cw, ch) {
    const { nx, ny } = LEVEL
    const PAD = 24
    const spanX = nx + ny
    const spanY = (nx + ny) + (MAX_Z / Z_UNIT) * Z_K
    const hw = Math.floor(Math.min((cw - PAD) / spanX, (ch - PAD) / spanY / ISO_K))
    const hh = hw * ISO_K
    const zScale = hh * Z_K / Z_UNIT
    const contentH = spanY * hh
    const ox = cw / 2 + (ny - nx) * hw / 2
    const oy = (ch + contentH) / 2
    return { hw, hh, zScale, ox, oy }
  },

  /* ---------------- 高度场 / 连通 ---------------- */

  /* 每列「有块体时」的顶面高度；没出现的键 = 空列（topOf 返回 null） */
  columnTops(board) {
    const tops = {}
    board.forEach(b => {
      const t = b.z + b.h
      for (let dx = 0; dx < b.w; dx++) {
        for (let dy = 0; dy < b.d; dy++) {
          const k = `${b.x + dx},${b.y + dy}`
          if (tops[k] == null || t > tops[k]) tops[k] = t
        }
      }
    })
    return tops
  },

  /* 顶面高度；null = 该列没有块体（空地，不算路） */
  topOf(tops, x, y) {
    const t = tops[`${x},${y}`]
    return t == null ? null : t
  },

  /* 核心规则：相邻两格「顶面高差」∈ {0, ±HALF, ±CELL} 时可通行
     · 地面（该列没有块体）不是路 —— toTop 为 null 直接不通，否则开局就能踩平地过去 */
  canStep(fromTop, toTop) {
    if (fromTop == null || toTop == null) return false         // 空地是坑，没有落脚点
    const dz = toTop - fromTop
    if (dz === 0)     return true                             // 同一水平面（平接 / 同高）
    if (dz === HALF)  return true                             // 上一级半高台阶（A / B 就是这一级）
    if (dz === CELL)  return true                             // 上一级立方（玩家堆上去的）
    if (!ALLOW_STEP_DOWN) return false
    return dz === -HALF || dz === -CELL                        // 下一级台阶 / 下一级立方
  },

  /* A 的实时锚点（A 已锁定：恒取 board 上那个 half_start 块）
     · 历史遗留：A 可拖动时的预览兜底分支保留（防御性），现在不会触发 */
  startAnchor() {
    const g = this.game
    if (!g) return null
    const b = g.board.find(o => o.kind === 'half_start')
    if (b) return { x: b.x, y: b.y, top: b.z + b.h }
    if (g.drag && g.drag.type === 'half_start' && g.preview) {
      const p = g.preview.box
      return { x: p.x, y: p.y, top: p.z + p.h }
    }
    return null
  },

  /* B 的实时锚点：B 完全锁定，不可拖动，位置恒等于 LEVEL.end
     · 正常：取 board 上的 half_end 块
     · 兜底：返回 LEVEL.end（关卡初始位置）
     ⚠️ 历史代码曾保留 half_end 的预览落点分支，是给 B 也可拖动设计的；
        现 A / B 都已 fixed，这里那段逻辑只作为防御性兜底。 */
  endAnchor() {
    const g = this.game
    const fallback = { x: LEVEL.end.x, y: LEVEL.end.y, top: LEVEL.end.z }
    if (!g) return fallback
    const b = g.board.find(o => o.kind === 'half_end')
    if (b) return { x: b.x, y: b.y, top: b.z + b.h }
    if (g.drag && g.drag.type === 'half_end' && g.preview) {
      const p = g.preview.box
      return { x: p.x, y: p.y, top: p.z + p.h }
    }
    return fallback
  },

  /* BFS：自 A 出发按台阶规则扩散，返回可达格集合（起点实时跟随 A） */
  computeReach(tops) {
    const { nx, ny } = LEVEL
    const s = this.startAnchor()
    if (!s) return new Set()
    const seen = new Set([`${s.x},${s.y}`])
    const queue = [[s.x, s.y]]

    while (queue.length) {
      const [cx, cy] = queue.shift()
      const ch = this.topOf(tops, cx, cy)
      for (let i = 0; i < DIRS.length; i++) {
        const gx = cx + DIRS[i][0], gy = cy + DIRS[i][1]
        if (gx < 0 || gy < 0 || gx >= nx || gy >= ny) continue
        const k = `${gx},${gy}`
        if (seen.has(k)) continue
        if (!this.canStep(ch, this.topOf(tops, gx, gy))) continue
        seen.add(k)
        queue.push([gx, gy])
      }
    }
    return seen
  },

  /* ---------------- 渲染 ---------------- */

  draw() {
    const g = this.game
    if (!g.ctx || !g.layout) return
    const { ctx, layout: L, cssW, cssH } = g

    ctx.clearRect(0, 0, cssW, cssH)

    /* ① 最底层：单元网格参考线（SHOW_GRID 调试条上可临时打开） */
    if (SHOW_GRID || g._showGrid) this.drawUnitGrid(ctx, L)

    /* ② 连通性（顺便拿到自 A 可达的格子，用于高亮） */
    const tops = this.columnTops(g.board)
    const reach = this.computeReach(tops)
    const e = this.endAnchor()
    g.linked = reach.has(`${e.x},${e.y}`)

    /* ③ 块体：画家算法 远 → 近 / 同列 低 → 高 */
    this.paintOrder(g.board).forEach(b => {
      const pal = palForKind(b.kind)
      /* 先画高度投影（块面会盖掉内部段，露出块下方的「高度投影」淡虚线） */
      drawHeightProjection(ctx, b, L)
      drawIsoBox(ctx, b, L, pal)
      if (b.kind !== 'half_start' && b.kind !== 'half_end' && this.boxOnReach(b, reach, tops)) {
        overlayTop(ctx, b, L, 'rgba(255, 120, 150, 0.20)')
      }
    })

    /* ④ 起点 A / 终点 B */
    this.drawMarkers(ctx, L)

    /* ⑤ 拖拽预览：幽灵整格吸附跟手，z 自动顶到目标列顶面 —— 边线磁吸
          绿 = 可放 / 红 = 不可放 */
    if (g.preview) {
      const pv = g.preview.box
      /* 拖的是 A 就用绿色幽灵，和它在画布上的样子一致 */
      const pal = pv.kind === 'half_start' ? PALETTE.green
        : pv.kind === 'half_end' ? PALETTE.pink
          : PALETTE.normal
      /* 预览也画高度投影，让用户感知「叠上去会有多高」 */
      drawHeightProjection(ctx, pv, L)
      drawIsoBox(ctx, pv, L, pal, {
        alpha: 0.45,
        stroke: g.preview.valid ? '#5FB865' : '#E5484D',
        lineWidth: 1.5,
      })
      /* ⑥ 吸附指示器：ref 块上画「面 = 虚线面」「边 = 实线 + 端点圆」让用户看清吸到了哪 */
      if (g.preview.snap) this.drawSnapIndicator(ctx, L, g.preview.snap)
    }

    this.syncTip()
  },

  /* 吸附指示器（仿 Figma Make snapIndicator）：
     面 snap  → ref 的对应面画虚线蓝色半透明四边形
     边 snap  → ref 的对应边画实线蓝线 + 两端圆点 */
  drawSnapIndicator(ctx, L, snap) {
    const ref = snap.ref
    if (!ref) return
    const { x, y, z, w, d, h } = ref
    const zb = z || 0, zt = zb + h
    const x2 = x + w, y2 = y + d
    const P = (gx, gy, gz) => proj(L, gx, gy, gz)

    const facePoly = {
      right:  [P(x2, y, zt), P(x2, y, zb), P(x2, y2, zb), P(x2, y2, zt)],
      left:   [P(x, y, zt),  P(x, y, zb),  P(x, y2, zb),  P(x, y2, zt)],
      front:  [P(x, y, zt),  P(x2, y, zt), P(x2, y, zb),  P(x, y, zb)],
      back:   [P(x, y2, zt), P(x2, y2, zt), P(x2, y2, zb), P(x, y2, zb)],
      top:    [P(x, y, zt),  P(x2, y, zt), P(x2, y2, zt), P(x, y2, zt)],
      bottom: [P(x, y, zb),  P(x2, y, zb), P(x2, y2, zb), P(x, y2, zb)],
    }

    const edgeLine = {
      'edge-right-top': [[x2, y, zt], [x2, y2, zt]],
      'edge-right-bot': [[x2, y, zb], [x2, y2, zb]],
      'edge-left-top':  [[x, y, zt],  [x, y2, zt]],
      'edge-left-bot':  [[x, y, zb],  [x, y2, zb]],
      'edge-back-top':  [[x, y2, zt], [x2, y2, zt]],
      'edge-back-bot':  [[x, y2, zb], [x2, y2, zb]],
      'edge-front-top': [[x, y, zt],  [x2, y, zt]],
      'edge-front-bot': [[x, y, zb],  [x2, y, zb]],
    }

    ctx.save()
    const poly = facePoly[snap.face]
    if (poly) {
      ctx.beginPath()
      ctx.moveTo(poly[0][0], poly[0][1])
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1])
      ctx.closePath()
      ctx.fillStyle = 'rgba(14, 165, 233, 0.18)'
      ctx.fill()
      ctx.strokeStyle = '#0EA5E9'
      ctx.lineWidth = 2.5
      ctx.setLineDash([5, 3])
      ctx.stroke()
    } else {
      const edge = edgeLine[snap.face]
      if (edge) {
        const [a, b] = edge
        const [ax, ay] = P(a[0], a[1], a[2])
        const [bx, by] = P(b[0], b[1], b[2])
        ctx.strokeStyle = '#0EA5E9'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
        ctx.fillStyle = '#0EA5E9'
        for (const [px, py] of [[ax, ay], [bx, by]]) {
          ctx.beginPath()
          ctx.arc(px, py, 4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.restore()
  },

  /* 半透明单元网格：z = 0 地面平面逐格描边 + 四角竖线示意 Z 轴 */
  drawUnitGrid(ctx, L) {
    const { nx, ny } = LEVEL
    ctx.save()
    ctx.lineWidth = 1
    for (let x = 0; x < nx; x++) {
      for (let y = 0; y < ny; y++) {
        const q = boxQuads({ x, y, z: 0, w: 1, d: 1, h: 0 }, L)
        quadPath(ctx, q.top)
        ctx.fillStyle = GRID_FILL
        ctx.fill()
        ctx.strokeStyle = GRID_LINE
        ctx.stroke()
      }
    }
    ctx.strokeStyle = GRID_AXIS
    ;[[0, 0], [nx, 0], [0, ny], [nx, ny]].forEach(([cx, cy]) => {
      const [sx, sy] = proj(L, cx, cy, 0)
      const sy2 = proj(L, cx, cy, MAX_Z)[1]
      ctx.beginPath()
      ctx.moveTo(sx, sy)
      ctx.lineTo(sx, sy2)
      ctx.stroke()
    })
    ctx.restore()
  },

  /* 在固定 A（绿色半高）/ B（粉色半高）顶面写 A / B 文字 */
  drawMarkers(ctx, L) {
    const a = this.startAnchor()
    const e = this.endAnchor()
    ctx.save()
    ctx.font = '600 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = STROKE
    /* A / B 都实时取锚点（A / B 可被拖到塔顶，或被叠块覆盖） */
    if (a) {
      /* A 被其它块叠住时，标记浮到该列当前顶面（起点跟着堆叠层走） */
      const top = this.topOf(this.columnTops(this.game.board), a.x, a.y)
      const pa = proj(L, a.x + 0.5, a.y + 0.5, top == null ? a.top : top)
      ctx.fillText('A', pa[0], pa[1])
    }
    if (e) {
      const top = this.topOf(this.columnTops(this.game.board), e.x, e.y)
      const pb = proj(L, e.x + 0.5, e.y + 0.5, top == null ? e.top : top)
      ctx.fillText('B', pb[0], pb[1])
    }
    ctx.restore()
  },

  /* 画家算法：远角 (x+y) 大的先画；同深度低的先画 */
  paintOrder(board) {
    return [...board].sort((a, b) => {
      const fa = (a.x + a.w - 1) + (a.y + a.d - 1)
      const fb = (b.x + b.w - 1) + (b.y + b.d - 1)
      if (fa !== fb) return fb - fa
      if (a.z !== b.z) return a.z - b.z
      return b.x - a.x
    })
  },

  /* 块体顶面是否就是「从 A 可以站上去」的那一层 */
  boxOnReach(box, reach, tops) {
    for (let dx = 0; dx < box.w; dx++) {
      for (let dy = 0; dy < box.d; dy++) {
        const k = `${box.x + dx},${box.y + dy}`
        if (reach.has(k) && this.topOf(tops, box.x + dx, box.y + dy) === box.z + box.h) return true
      }
    }
    return false
  },

  /* 底部提示 / 连通状态 */
  syncTip() {
    const g = this.game
    if (!g) return
    if (g.drag) return          // 拖动途中不 setData：每帧改文案会让整页跟着重排、看着抖
    this.reconcilePieces()      // 与 syncTray 同源校准，两处数字永不打架
    const total = g.pieces.length
    const left = g.pieces.filter(p => !p.used).length
    const placed = total - left
    const tipText = total === 0
      ? '物料库还是空的 · 猫出门会叼楼梯块体回来'
      : placed === 0
      ? '拖动上方块体到这里 · A / B 已锁定，用块体搭桥'
      : `已放置 ${placed}/${total} · A→B ${g.linked ? '已连通' : '未连通'}`
    if (this.data.tipText !== tipText || this.data.linked !== !!g.linked) {
      this.setData({ tipText, linked: !!g.linked })
    }
  },

  /* ---------------- 落点解算 ---------------- */

  /* 不可被堆叠的格：只算「固定且不可动」的块（B 终点台阶）
     A 是 fixed + stackable：允许其它块叠在它顶上（半高块叠 A = 拼成完整立方） */
  noStackCells() {
    const s = new Set()
    this.game.board.forEach(b => {
      if (!b.fixed || b.stackable) return
      for (let dx = 0; dx < b.w; dx++) {
        for (let dy = 0; dy < b.d; dy++) s.add(`${b.x + dx},${b.y + dy}`)
      }
    })
    return s
  },

  /* 解算某个组件放在 (x, y) 的结果：自动堆叠到该列当前顶面 */
  resolvePlacement(type, x, y) {
    const def = PIECE_DEF[type]
    if (!def) return { box: { kind: type, x, y, w: 1, d: 1, h: CELL, z: 0 }, valid: false }
    const box = { kind: type, x, y, w: def.w, d: def.d, h: def.h, z: 0 }
    if (x < 0 || y < 0 || x + def.w > LEVEL.nx || y + def.d > LEVEL.ny) {
      return { box, valid: false }
    }

    const tops = this.columnTops(this.game.board)
    const blocked = this.noStackCells()
    let base = null
    let baseSet = false

    for (let dx = 0; dx < def.w; dx++) {
      for (let dy = 0; dy < def.d; dy++) {
        const gx = x + dx, gy = y + dy
        const k = `${gx},${gy}`
        if (blocked.has(k)) return { box, valid: false }      // B（固定锁定）之上不可堆叠
        const t = this.topOf(tops, gx, gy)                    // null = 空列；A 列顶面 = A 顶，叠上即拼接
        if (!baseSet) { base = t; baseSet = true }
        else if (t !== base) return { box, valid: false }     // 多格块必须落在等高的一排列上
      }
    }
    if (!baseSet) return { box, valid: false }

    box.z = base == null ? 0 : base                           // 空列 → 落到地面 z=0
    return { box, valid: true }
  },

  /* ---------------- 物料库：11 个块体（按类型分组显示） ---------------- */

  /* 某类型剩余（未使用）的块体数 */
  remain(type) {
    return this.game.pieces.filter(p => p.type === type && !p.used).length
  },

  /* 取出一个块体（标记已用） */
  takePiece(type) {
    const p = this.game.pieces.find(p => p.type === type && !p.used)
    if (!p) return false
    p.used = true
    return true
  },

  /* 收回一个块体（标记可用） */
  giveBackPiece(type) {
    const used = this.game.pieces.filter(p => p.type === type && p.used)
    if (!used.length) return false
    used[used.length - 1].used = false
    return true
  },

  /* 物料库显示：每种类型一格，显示剩余数量（顺序同 this._tray） */
  syncTray() {
    this.reconcilePieces()
    const tray = (this._tray || buildTray()).map(g => ({
      type: g.type,
      total: g.count,
      count: this.remain(g.type),
    }))
    /* 右侧文案：集齐（half5 / cube3 / bar1）才「物料已齐备」 */
    const caps = outputs.MATERIAL_CAPS
    const trayReady = tray.length > 0 && tray.every(t => t.total >= (caps[t.type] || 0))
    const trayLeft = Math.max(0,
      tray.reduce((s, t) => s + Math.max(0, (caps[t.type] || 0) - t.total), 0))
    this.setData({ tray, trayReady, trayLeft })
  },

  /* 计数自愈：以画布上的块体为唯一事实来源，反推 used 标记。
     board 上每有一个某类型的块（A / B 关卡自带块除外），就有一个对应 piece 被占用。
     任何路径漏调 takePiece / giveBackPiece 造成的计数漂移，都会在下次 syncTray 时被抹平 */
  reconcilePieces() {
    const onBoard = {}
    this.game.board.forEach(b => {
      if (b.fixed) return                       // A / B 不占物料库额度
      onBoard[b.kind] = (onBoard[b.kind] || 0) + 1
    })
    Object.keys(PIECE_DEF).forEach(type => {
      if (type === 'half_start' || type === 'half_end') return
      const need = onBoard[type] || 0
      const ps = this.game.pieces.filter(p => p.type === type)
      ps.forEach((p, i) => { p.used = i < need })
    })
  },

  /* ---------------- 拖拽：组件池 → 画布 ---------------- */

  onTrayTouchStart(e) {
    const i = e.currentTarget.dataset.index
    const g = (this._tray || buildTray())[i]
    if (!g || this.remain(g.type) <= 0 || this.game.drag) return
    this.game.drag = { from: 'tray', type: g.type, index: i }
    this.freezeDragRects()
  },

  onTrayTouchMove(e) {
    if (!this.game.drag) return
    const p = e.touches[0]
    if (p) this.updatePreview(p.clientX, p.clientY)
  },

  onTrayTouchEnd(e) {
    const g = this.game
    const drag = g.drag
    if (!drag) return
    g.drag = null
    const p = e.changedTouches && e.changedTouches[0]

    if (p) {
      const box = this.releaseSnap(drag, p)
      if (box) this.commitPlace(drag, box)
    }
    g.preview = null
    g.dragRect = null
    g.dragInvRect = null
    this.draw()
  },

  /* 手势被系统打断（滚动接管 / 来电等）→ 只中止，不落位不收回。
     之前 touchcancel 复用 touchend：取消点恰好在画布上时会「幽灵落位」，
     块凭空出现在奇怪的位置，还伴随物料库计数漂移 */
  onTrayTouchCancel() {
    const g = this.game
    if (!g.drag) return
    g.drag = null
    g.preview = null
    g.dragRect = null
    /* 取消时主动触发一次重绘，清掉画布上残留的 ghost 帧
       （否则下一个触摸事件到来之前画面会一直挂着上一帧） */
    this.scheduleDraw()
    g.dragInvRect = null
    this.draw()
  },

  onBoardTouchCancel() {
    const g = this.game
    const drag = g.drag
    if (!drag) return
    g.drag = null
    if (drag.piece) g.board.push(drag.piece)   // 画布内拖出的块：原样放回原格
    g.preview = null
    g.dragRect = null
    g.dragInvRect = null
    this.draw()
  },

  /* ---------------- 拖拽：画布内移动已放置的块 ---------------- */

  onBoardTouchStart(e) {
    const g = this.game
    if (!g.layout || g.drag) return
    const p = e.touches[0]
    if (!p) return
    const pt = this.canvasPoint(p.clientX, p.clientY)
    const px = pt.x, py = pt.y
    const hit = this.hitBlock(px, py)
    if (DEBUG_TOUCH) {
      console.log('[realm] touchstart 画布内', px.toFixed(1), py.toFixed(1),
        'scrollTop=', g.scrollTop, 'rect=', JSON.stringify(g.boardRect), 'hit=', hit ? hit.kind : null)
    }
    if (!hit) return

    /* 记下起手时指尖在「块体底面那一层」上的浮点格坐标
       拖动时只比较指尖相对起手点的位移（同一平面上的差值），换算成整数格增量
       → 起手瞬间不跳格、方向任意都跟手；落点层由 resolvePlacement 自动吸到目标列顶面 */
    const f = cellFromPoint(px, py, g.layout, hit.z)
    g.board = g.board.filter(b => b !== hit)
    g.drag = {
      from: 'board',
      type: hit.kind,
      piece: hit,                                    // 原块体对象：无效落点 → 原样放回
      isBase: !!hit.fixed,                           // 防御：A/B 已锁定不会走到这里，但保留兜底
      grab: { u: f.u, v: f.v },
      origin: { x: hit.x, y: hit.y, z: hit.z },
    }
    this.freezeDragRects()
    this.draw()
  },

  onBoardTouchMove(e) {
    if (!this.game.drag) return
    const p = e.touches[0]
    if (p) this.updatePreview(p.clientX, p.clientY)
  },

  onBoardTouchEnd(e) {
    const g = this.game
    const drag = g.drag
    if (!drag) return
    g.drag = null
    const p = e.changedTouches && e.changedTouches[0]

    if (p && !drag.isBase && this.inRectV(p, g.dragInvRect)) {
      /* 拖回组件池 = 收回（关卡自带块 A / B 不适用，只能挪位） */
      this.commitReturn(drag)
    } else {
      const box = p ? this.releaseSnap(drag, p) : null
      if (box) this.commitPlace(drag, box)
      else if (drag.piece) g.board.push(drag.piece)   // 无有效落点 → 原样放回原格
    }
    g.preview = null
    g.dragRect = null
    g.dragInvRect = null
    this.logAB()
    this.draw()
  },

  /* 调试：打印 A / B 当前落位坐标（格坐标 + 顶面高度）与连通状态。
     每次画布松手后调用 —— 想读「AB 对位」时开控制台看这行 */
  logAB() {
    const g = this.game
    if (!g) return
    const a = this.startAnchor()
    const b = this.endAnchor()
    const tops = this.columnTops(g.board)
    const linked = this.computeReach(tops).has(`${b.x},${b.y}`)
    console.log(`[realm] A=(${a.x},${a.y}) 顶=${a.top} | B=(${b.x},${b.y}) 顶=${b.top} | 连通=${linked ? '是' : '否'}`)
  },

  /* ---------------- 拖拽公共逻辑 ---------------- */

  /* 拖拽期间冻结坐标基准：把 rect 换算成「拖拽开始那一刻」的视口坐标，整个手势只用这一份。
     之前每帧都掺入实时 scrollTop —— 页面在拖动途中哪怕滚 1px（回弹 / 惯性 / 锁滚失效），
     画布上的块体就漂 1px，两个版本的拖拽（跟手 / 吸附）都因此抖。
     冻结后映射与滚动彻底解耦：这是消除「抖」的关键一步 */
  freezeDragRects() {
    const g = this.game
    const st = g.scrollTop || 0
    const freeze = r => r
      ? { left: r.left, right: r.right, top: r.top - st, bottom: r.bottom - st }
      : null
    g.dragRect = freeze(g.boardRect)
    g.dragInvRect = freeze(g.invRect)
  },

  /* 视口坐标版命中判断（配合冻结 rect 使用，不掺 scrollTop）
     pad：外扩像素，拖到手指出界一点点时预览不闪掉 */
  inRectV(p, r, pad = 0) {
    if (!r) return false
    return p.clientX >= r.left - pad && p.clientX <= r.right + pad &&
      p.clientY >= r.top - pad && p.clientY <= r.bottom + pad
  },

  /* 触摸点（视口坐标）→ 画布局部像素
     拖拽中用冻结的 dragRect（纯视口坐标）；非拖拽兜底退回 boardRect + scrollTop */
  canvasPoint(clientX, clientY) {
    const g = this.game
    if (g.dragRect) return { x: clientX - g.dragRect.left, y: clientY - g.dragRect.top }
    const r = g.boardRect
    return { x: clientX - r.left, y: clientY + (g.scrollTop || 0) - r.top }
  },

  /* 松手磁吸：在指尖落点附近找「最近的有效格」
     · 候选 = 指尖所在格 ±2 格，逐个 resolvePlacement（自动堆叠到该列顶面）
     · 打分 = 幽灵中心到候选中心的屏幕距离；顶面吸附已由拖动中的
       cellOverTopFace 实时完成，这里不再额外加分，避免边线处被抢到顶上
     · 返回 resolvePlacement 结果；周围没有有效格 → null（松手即取消 / 原样放回） */
  nearestValid(type, fx, fy, fz, px, py) {
    const g = this.game
    const def = PIECE_DEF[type]
    if (!def) return null
    const L = g.layout
    const c1 = proj(L, fx + def.w / 2, fy + def.d / 2, fz + def.h / 2)
    let best = null
    let bestScore = Infinity
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const res = this.resolvePlacement(type, Math.round(fx) + dx, Math.round(fy) + dy)
        if (!res.valid) continue
        const b = res.box
        const c2 = proj(L, b.x + b.w / 2, b.y + b.d / 2, b.z + b.h / 2)
        const score = Math.hypot(c1[0] - c2[0], c1[1] - c2[1])
        if (score < bestScore) { bestScore = score; best = res }
      }
    }
    return best
  },

  /* 松手落位：优先用当前有效幽灵；幽灵无效（红）时也兜底 ——
     按指尖在地面上的位置 ±2 格内找最近有效格（含叠到块体顶面）。
     找不到有效落点才返回 null（取消 / 原样放回）。
     之前「幽灵红 → 直接取消」会让块体看起来凭空消失，就是缺了这一步 */
  releaseSnap(drag, p) {
    const g = this.game
    if (!p || !g.layout || !this.inRectV(p, g.dragRect, 44)) return null
    const def = PIECE_DEF[drag.type]
    if (!def) return null
    const pt = this.canvasPoint(p.clientX, p.clientY)
    /* 显式 z 吸附落位（top/bot/edge-*）：直接采用预览盒。
       不能再走 nearestValid → resolvePlacement —— 那会按列顶自动堆栈，
       把吸附算出的 z（如 edge-right-top 的 sz+sH）覆盖回 z=0，
       表现为「拖着时指示器在、松手就掉回地面」 */
    if (g.preview && g.preview.valid && g.preview.snapZ) {
      return g.preview.box
    }
    let fx, fy, fz
    if (g.preview && g.preview.valid) {
      fx = g.preview.box.x; fy = g.preview.box.y; fz = g.preview.box.z
    } else {
      const f = cellFromPoint(pt.x, pt.y, g.layout, 0)
      fx = f.u - def.w / 2
      fy = f.v - def.d / 2
      fz = 0
    }
    const snap = this.nearestValid(drag.type, fx, fy, fz, pt.x, pt.y)
    return snap && snap.valid ? snap.box : null
  },

  updatePreview(clientX, clientY) {
    const g = this.game
    if (!g.dragRect || !g.drag || !g.layout) return
    const drag = g.drag
    const def = PIECE_DEF[drag.type]
    if (!def) return
    g.preview = null

    /* 出画布（外扩 44px 防贴边闪烁）→ 不显示幽灵 */
    const r = g.dragRect
    const pad = 44
    if (clientX < r.left - pad || clientX > r.right + pad ||
        clientY < r.top - pad || clientY > r.bottom + pad) {
      this.scheduleDraw()
      return
    }

    const pt = this.canvasPoint(clientX, clientY)

    /* 起手格 + 指尖反算 → 拖动时该落在哪个格子
       · 画布内挪动（含 A）：保留起手偏移（origin + Δ），起手瞬间不跳格
       · 物料库拖出：块体中心吸到指尖所在格 */
    let fx, fy
    if (drag.from === 'board' && drag.grab) {
      const f = cellFromPoint(pt.x, pt.y, g.layout, drag.origin.z || 0)
      fx = Math.round(drag.origin.x + (f.u - drag.grab.u))
      fy = Math.round(drag.origin.y + (f.v - drag.grab.v))
    } else {
      const f = cellFromPoint(pt.x, pt.y, g.layout, 0)
      fx = Math.round(f.u - def.w / 2)
      fy = Math.round(f.v - def.d / 2)
    }

    /* 边线 + 面对齐磁吸（仿 Figma Make 原型）：14 个候选面/边线，找出最近者
       · snapMode = 'off' 时关掉：退回纯地面格子吸附，对比手感差异
       · 候选若带回 z（top/bot/edge-*-top/bot）→ 显式落位（允许「卡」在 S 的某个面/边上）
         否则只锁 (fx, fy)，z 由 resolvePlacement 自动堆到目标列顶面 */
    let res = null
    let snap = null
    if (g._snapMode !== 'off') {
      /* fz = 拖动块当前所在的 z 平面：画布内挪动 = 原块 z，物料库拖出 = 0
         候选距离在「拖动平面 ↔ 候选投影」之间比，z 平面不一致会导致整体偏移 */
      const fz = drag.from === 'board' && drag.origin ? (drag.origin.z || 0) : 0
      snap = this.applyEdgeSnap(drag.type, fx, fy, fz)
      if (snap) {
        fx = snap.fx; fy = snap.fy
        if (snap.z != null) res = this.placeAt(drag.type, fx, fy, snap.z)
      }
    }

    /* 默认：地面格子吸附，z 由 resolvePlacement 自动堆到该列顶面 */
    if (!res) res = this.resolvePlacement(drag.type, fx, fy)

    /* A 的特例吸附：拖的是非 A 块、且指尖压在 A 顶面菱形内 → 强制叠到 A 顶
       （半高 / 正方体叠 A 时接缝严丝合缝，组成完整立方）
       —— 优先级最高，覆盖任何吸附结果 */
    const atop = this.applyATopSnap(drag, pt)
    if (atop && atop.valid) res = atop

    /* snapZ：盒子 z 来自吸附的显式落位（top/bot/edge-*），松手必须原样提交，
       不能再走 resolvePlacement 自动堆栈（会把 z 覆盖回列顶） */
    g.preview = {
      box: res.box, valid: res.valid, snap,
      snapZ: !!(snap && snap.z != null) && !(atop && atop.valid),
    }
    this.scheduleDraw()
  },

  /* 边线 + 面对齐磁吸（仿 Figma Make 原型 snapCandidates）
     对每个 ref 块枚举 14 个候选 D 锚点（6 面 + 8 边）：
       面  right/left/front/back      → D 落在 S 的右/左/前/后「外侧」同高度列
           top/bottom                 → D 落在 S 的正上/正下「同列」z=sH±dH
       边  edge-{right,left,front,back}-{top,bot}
                                   → D 锚点 = 面 snap 的 x/y，z 同 top/bottom
     取所有候选的「D 锚点到 free 锚点」的屏幕距离最小者，< THRESH 即采纳
     · THRESH = max(14, 0.32·hw)：敏感度收紧，「到很近再吸」
     · B 已锁定不可作吸附候选；A 可作为吸附候选
     · 返回 { fx, fy, z, face, ref }：z=null 表示走 resolvePlacement 自动堆栈 */
  applyEdgeSnap(type, fx, fy, fz) {
    const g = this.game
    const def = PIECE_DEF[type]
    const L = g.layout
    if (!def || g.board.length === 0) return null
    const dW = def.w, dD = def.d, dH = def.h

    /* 磁吸阈值：原 max(24, hw*0.6) 太敏感（远处就吸住）；改到 max(THRESH_BASE, hw*THRESH_K)，
       让「到很近再吸」更顺——和「棱线悬浮」精度同档（贴地歧义消解 SUSPENDED_SNAP_RATIO 不受影响） */
    const THRESH = Math.max(THRESH_BASE, L.hw * THRESH_K)
    /* 自由锚点必须投在拖动块当前所在的 z 平面（画布内挪动 = origin.z，物料库拖出 = 0）
       否则和带 z 的候选比距离会整体偏差 */
    const [freeSx, freeSy] = proj(L, fx, fy, fz || 0)

    let best = null   // { fx, fy, z, face, ref, dist }
    let bestFace = null // 贴地候选（z=null，走自动堆栈）中最近者

    for (const s of g.board) {
      if (s.fixed && !s.stackable) continue                // 跳过锁定的 B
      const sW = s.w, sD = s.d, sH = s.h
      const sx = s.x, sy = s.y, sz = s.z || 0

      /* 候选。pz = 距离比较用的投影高度；z = 落位高度（null → resolvePlacement 自动堆栈）
       面 right/left/front/back：D 与 S 贴面 → 投影在 S 底面 sz，落位交给自动堆栈
         · 全对齐（off=0）+ 沿面偏移：D 沿面的垂直方向滑动，只要与 S 的面仍有 ≥1 格
           接触就算候选 —— 支持「长条侧面错位一格」的 L 形贴接（整面对齐之外的补集）
       top / edge-*-top：D 底面 = S 顶面 → pz = z = sz+sH
       bottom / edge-*-bot：D 顶面 = S 底面 → pz = z = sz-dH */
      const cands = []
      for (let o = -(dD - 1); o <= sD - 1; o++) {
        cands.push({ fx: sx + sW, fy: sy + o, face: 'right', pz: sz })
        cands.push({ fx: sx - dW, fy: sy + o, face: 'left',  pz: sz })
      }
      for (let o = -(dW - 1); o <= sW - 1; o++) {
        cands.push({ fx: sx + o, fy: sy - dD, face: 'back',  pz: sz })
        cands.push({ fx: sx + o, fy: sy + sD, face: 'front', pz: sz })
      }
      cands.push(
        { fx: sx,      fy: sy,        face: 'top',     pz: sz + sH, z: sz + sH },
        { fx: sx,      fy: sy,        face: 'bottom',  pz: sz - dH, z: sz - dH },
        { fx: sx + sW, fy: sy,        face: 'edge-right-top', pz: sz + sH, z: sz + sH },
        { fx: sx + sW, fy: sy,        face: 'edge-right-bot', pz: sz - dH, z: sz - dH },
        { fx: sx - dW, fy: sy,        face: 'edge-left-top',  pz: sz + sH, z: sz + sH },
        { fx: sx - dW, fy: sy,        face: 'edge-left-bot',  pz: sz - dH, z: sz - dH },
        { fx: sx,      fy: sy - dD,   face: 'edge-back-top',  pz: sz + sH, z: sz + sH },
        { fx: sx,      fy: sy - dD,   face: 'edge-back-bot',  pz: sz - dH, z: sz - dH },
        { fx: sx,      fy: sy + sD,   face: 'edge-front-top', pz: sz + sH, z: sz + sH },
        { fx: sx,      fy: sy + sD,   face: 'edge-front-bot', pz: sz - dH, z: sz - dH },
      )

      for (const c of cands) {
        /* 候选按「它自己的 pz」投影 —— Figma 原型里 cy 是带 z 偏移的
           （如 edge-right-top = 面 snap 位置再抬升 sH）。
           若都投到 z=0，right / edge-right-top / edge-right-bot 三者屏幕点重合，
           数组序靠前的 right 永远赢 → 边线吸附永远不触发 */
        const [csx, csy] = proj(L, c.fx, c.fy, c.pz)
        const dist = Math.hypot(csx - freeSx, csy - freeSy)
        if (dist < (best ? best.dist : THRESH)) {
          best = { fx: c.fx, fy: c.fy, z: c.z != null ? c.z : null, face: c.face, ref: s, dist }
        }
        if (c.z == null && dist < (bestFace ? bestFace.dist : THRESH)) {
          bestFace = { fx: c.fx, fy: c.fy, z: null, face: c.face, ref: s, dist }
        }
      }
    }

    if (!best) return null
    /* 贴地优先的歧义消解：悬空吸附（top / edge-*）投影被抬高了 sH，贴地拖拽时
       屏幕距离常与贴地候选（face-*）接近甚至更小，导致「想贴立方体背面」的长块
       总被吸到棱线上。规则：悬空候选必须明显更近（dist < SUSPENDED_SNAP_RATIO × 贴地候选距离）
       才采纳，否则回落到贴地面候选 */
    if (best.z != null && bestFace && best.dist >= bestFace.dist * SUSPENDED_SNAP_RATIO) {
      best = bestFace
    }
    if (DEBUG_TOUCH) {
      console.log('[realm] snap face=', best.face, 'kind=', best.ref.kind,
        'dist=', best.dist.toFixed(1), 'z=', best.z)
    }
    return { fx: best.fx, fy: best.fy, z: best.z, face: best.face, ref: best.ref }
  },

  /* 显式 z 落位（绕过 resolvePlacement 的列顶自动堆栈）
     用于：applyEdgeSnap 返回了 z 的吸附（top/bot/edge-*）——「卡」在 S 的某个面/边上
     允许悬浮预览（吸附的本意就是 D 借 S 的支撑悬空）
     · 仅校验：越界、与任何现有块体体积相交 → invalid
     · 不校验：底部是否悬空、不重叠于 ref 自身（吸附的几何保证）
     · 「边线 / 面」平贴（共享一条棱 / 一个面，零体积重叠）— 通过判定为合法
       这条规则是关卡吸附的核心：长块挂在立方体侧面、悬空吸附的 cuboid 等都依赖于此 */
  placeAt(type, x, y, z) {
    const def = PIECE_DEF[type]
    if (!def) return { box: { kind: type, x, y, w: 1, d: 1, h: CELL, z: 0 }, valid: false }
    const box = { kind: type, x, y, w: def.w, d: def.d, h: def.h, z }
    if (x < 0 || y < 0 || x + def.w > LEVEL.nx || y + def.d > LEVEL.ny || z < 0) {
      return { box, valid: false }
    }
    const g = this.game
    for (const b of g.board) {
      /* AABB 三轴相交：与任意现有块体（含 ref 自己）有体积重叠则 invalid */
      if (b.x + b.w <= x || x + def.w <= b.x) continue
      if (b.y + b.d <= y || y + def.d <= b.y) continue
      if ((b.z || 0) + b.h <= z || z + def.h <= (b.z || 0)) continue
      return { box, valid: false }
    }
    /* B 的列被占了 → invalid（fixed 未标 stackable，列不可堆叠） */
    for (const b of g.board) {
      if (!(b.fixed && !b.stackable)) continue
      if (b.x + b.w <= x || x + def.w <= b.x) continue
      if (b.y + b.d <= y || y + def.d <= b.y) continue
      return { box, valid: false }
    }
    return { box, valid: true }
  },

  /* A 的特例吸附：拖的是非 A 块（half / cube / bar），且指尖压在 A 顶面菱形内 → 叠到 A 顶
     · bar 是 1×3，A 只有 1×1，resolvePlacement 会自动判 invalid（多格必须等高），红色幽灵正确
     · A 自身被拖时此规则不触发 —— A 走自己的格子步进 */
  applyATopSnap(drag, pt) {
    if (drag.type === 'half_start') return null
    const g = this.game
    const L = g.layout
    /* A 可能正被自己拖动（短暂不在 board 上） → 跳过；
       想叠 A 必须先把 A 放回原位 */
    const a = g.board.find(b => b.kind === 'half_start')
    if (!a) return null
    const top = boxQuads(a, L).top
    if (!inPoly(pt.x, pt.y, top)) return null
    return this.resolvePlacement(drag.type, a.x, a.y)
  },

  /* 拖动时 touchmove 触发得比屏幕刷新还密：把一帧内的多次重绘合并成一次
     （每帧全量重绘会让人看着整个画面在抖） */
  scheduleDraw() {
    const g = this.game
    if (!g || !g.canvas) { this.draw(); return }
    if (g.pendingDraw) return
    g.pendingDraw = true
    g.canvas.requestAnimationFrame(() => {
      g.pendingDraw = false
      this.draw()
    })
  },

  commitPlace(drag, box) {
    const g = this.game
    /* A / B 已完全锁定，物料块落位即普通块 */
    g.board.push({ ...box })
    if (drag.from === 'tray') this.takePiece(drag.type)
    this.syncTray()          // 无条件重算：reconcile 以画布为准，多算少算都会被抹平
    this.checkWin()
  },

  commitReturn(drag) {
    this.giveBackPiece(drag.type)
    this.syncTray()
  },

  /* ---------------- 命中检测 ---------------- */

  /* 近→远找第一个命中的块；只有该列最上面那一块（且可拿起）可以被拿起
     · A / B 完全锁定（fixed）：永远拿不起，只能用物料库块搭桥 */ 
  hitBlock(px, py) {
    const g = this.game
    const sorted = this.paintOrder(g.board)
    for (let i = sorted.length - 1; i >= 0; i--) {
      const b = sorted[i]
      if (b.fixed) continue
      if (!this.isColumnTop(b)) continue
      const q = boxQuads(b, g.layout)
      if (inPoly(px, py, q.top) || inPoly(px, py, q.left) || inPoly(px, py, q.right)) return b
    }

    /* 容差兜底：一格菱形在屏幕上是 2·hw × 2·hh（6×8 下只有 44 × 25px），手指点不准
       多边形都没中时，取「投影中心最近且在容差内」的那一块 */
    const R = Math.max(28, g.layout.hw * 1.5)
    let best = null
    let bestD = R * R
    for (let i = sorted.length - 1; i >= 0; i--) {
      const b = sorted[i]
      if (b.fixed) continue
      if (!this.isColumnTop(b)) continue
      const c = proj(g.layout, b.x + b.w / 2, b.y + b.d / 2, b.z + b.h / 2)
      const d = (c[0] - px) * (c[0] - px) + (c[1] - py) * (c[1] - py)
      if (d < bestD) { bestD = d; best = b }
    }
    return best
  },

  isColumnTop(b) {
    for (let dx = 0; dx < b.w; dx++) {
      for (let dy = 0; dy < b.d; dy++) {
        const cx = b.x + dx, cy = b.y + dy
        const covered = this.game.board.some(o => o !== b &&
          o.z >= b.z + b.h &&
          cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.d)
        if (covered) return false
      }
    }
    return true
  },

  /* ---------------- 通关判定 ---------------- */

  checkWin() {
    const g = this.game
    if (g.won) return
    const e = this.endAnchor()          // 判定点实时从 board 上的 B 取（B 位置固定，恒等于 LEVEL.end）
    const reach = this.computeReach(this.columnTops(g.board))
    if (!reach.has(`${e.x},${e.y}`)) return
    if (REQUIRE_ALL_USED && g.pieces.some(p => !p.used)) return
    g.won = true
    wx.vibrateLong({ fail: () => {} })
    wx.showToast({ title: '意识连上了潜意识', icon: 'none', duration: 2200 })
  },

  /* ---------------- 秘境工具条：提示 / 留言 / 保存 ---------------- */

  /* 反向 BFS：从 B 出发，算每格「到 B 还差几步」（步进规则对称，直接复用 canStep）
     返回 { 'x,y': 距离 }；B 自身不可达的格子不在表里 */
  distToB(tops) {
    const e = this.endAnchor()
    const dist = {}
    if (this.topOf(tops, e.x, e.y) == null) return dist
    dist[`${e.x},${e.y}`] = 0
    const queue = [[e.x, e.y]]
    while (queue.length) {
      const [cx, cy] = queue.shift()
      const ch = this.topOf(tops, cx, cy)
      for (const [dx, dy] of DIRS) {
        const gx = cx + dx, gy = cy + dy
        if (gx < 0 || gy < 0 || gx >= LEVEL.nx || gy >= LEVEL.ny) continue
        const k = `${gx},${gy}`
        if (dist[k] != null) continue
        /* 反向走一步：从 (gx,gy) 迈到 (cx,cy) 可行 */
        if (!this.canStep(this.topOf(tops, gx, gy), ch)) continue
        dist[k] = dist[`${cx},${cy}`] + 1
        queue.push([gx, gy])
      }
    }
    return dist
  },

  /* 网格方向词（投影约定：+x 朝右上、+y 朝左上） */
  dirWords(dx, dy) {
    const xs = dx > 0 ? '右上' : dx < 0 ? '左下' : ''
    const ys = dy > 0 ? '左上' : dy < 0 ? '右下' : ''
    return [xs, ys].filter(Boolean).join('·') || '原地'
  },

  /* 秘境提示：从 A 可达的格子里找「离 B 最近」的一个，告诉玩家该往哪搭 */
  onHint() {
    const g = this.game
    const tops = this.columnTops(g.board)
    const reach = this.computeReach(tops)
    const e = this.endAnchor()

    if (reach.has(`${e.x},${e.y}`)) {
      wx.showModal({
        title: '秘境提示',
        content: 'A 和 B 已经连通啦。剩下没用的块体也搭上去，秘境会更完整。',
        showCancel: false, confirmText: '收到',
      })
      return
    }

    const distB = this.distToB(tops)
    let best = null
    reach.forEach(k => {
      const d = distB[k]
      if (d != null && (!best || d < best.d)) best = { k, d }
    })

    let content
    if (!best) {
      content = '现在摆的块和 B 完全接不上。试着从 A 旁边重新搭：先放一块半高块，再一级一级往 B 那边延。'
    } else {
      const [x, y] = best.k.split(',').map(Number)
      const dir = this.dirWords(e.x - x, e.y - y)
      content = `从 A 出发能走到的格子里，(${x}, ${y}) 离 B 最近，还差 ${best.d} 步。` +
        `下一块往「${dir}」方向搭，落在它附近试试。`
    }
    wx.showModal({ title: '秘境提示', content, showCancel: false, confirmText: '收到' })
  },

  /* 留言：用户自己输入一句话，猫按当前进度随机回复 */
  onGenerateMessage() {
    const g = this.game
    wx.showModal({
      title: '写一句留言',
      editable: true,
      placeholderText: '想对这座秘境 / 猫说点什么…',
      confirmText: '留言',
      cancelText: '算了',
      success: res => {
        if (!res.confirm) return
        const message = (res.content || '').trim() || '（盯着画布，一时不知道说什么。）'
        const pick = arr => arr[Math.floor(Math.random() * arr.length)]

        /* 猫的回复：随机一句心境话 + 另起一段的「阴影回廊」寄语 */
        const shadow =
          '这是阴影回廊，通向的是你不知道的那一部分自己，向前走，接纳他，才会完整。'
        let reply
        if (g.won) {
          reply = pick([
            '嗯，桥稳不稳猫踩过就知道了。这座秘境我替你收好。',
            '搭得不错。下次猫会把 B 放得更远一点哦。',
            '意识走到潜意识那里了。今晚做个好梦。',
            '留言猫收下了。这座桥，猫会常来看看。',
          ])
        } else if (g.linked) {
          reply = pick([
            '用完它们，秘境才算完整。猫在终点等你。',
            '通了就先走一遭吧，剩下的块猫不催你。',
            '已经能走到 B 了呢。猫有点佩服你。',
          ])
        } else if (g.pieces.some(p => p.used)) {
          reply = pick([
            '再往 B 的方向挪一挪。猫在高处看着你呢。',
            '差的那一截最难，也最值得。慢慢搭。',
            '留言猫记下了，等桥通了再来念给潜意识听。',
          ])
        } else {
          reply = pick([
            '别急，先把第一块半高块搭在 A 旁边，路是一步一步走出来的。',
            '从 A 出发就行。猫第一次搭的时候，也愣了很久。',
            '想好了就动手吧，点阵会接住你的第一块。',
          ])
        }
        reply = `${reply}\n\n${shadow}`
        this.setData({ realmMessage: message, catReply: reply })
        wx.showModal({
          title: '猫回复了',
          content: `${message}\n\n—— 猫：\n${reply}`,
          showCancel: false, confirmText: '嗯',
        })
      },
    })
  },

  /* 秘境保存：把当前画布（联通桥梁图形）导出成图片，存进猫物页的「卡片」分类
     同时把块体结构落盘（key: realm_saves），便于以后恢复 / 回看 */
  onSaveRealm() {
    const g = this.game
    const canvas = g.canvas
    if (!canvas || !g.ctx) {
      wx.showToast({ title: '画布还没准备好，稍后再试', icon: 'none' })
      return
    }
    if (this._savingRealm) return
    this._savingRealm = true
    const done = () => { this._savingRealm = false }

    wx.canvasToTempFilePath({
      canvas,
      success: res => {
        /* 临时文件会随会话失效 → 落到本地用户目录（失败则退回临时路径） */
        const fs = wx.getFileSystemManager()
        fs.saveFile({
          tempFilePath: res.tempFilePath,
          success: r => this._addRealmToCards(r.savedFilePath, done),
          fail: () => this._addRealmToCards(res.tempFilePath, done),
        })
      },
      fail: () => {
        done()
        wx.showToast({ title: '保存失败，重试一下', icon: 'none' })
      },
    })
  },

  /* 把秘境图形作为一张「卡片」放进猫物页的卡片栏（catItemCards → 卡片分类） */
  _addRealmToCards(filePath, done) {
    const g = this.game
    const d = new Date()

    /* 结构数据落盘（realm_saves），供以后恢复 */
    try {
      const saves = wx.getStorageSync('realm_saves') || []
      saves.push({
        createdAt: d.getTime(),
        timeText: fmtClock(d),
        linked: !!g.linked,
        won: !!g.won,
        blocks: g.board.map(b => ({ x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, h: b.h, kind: b.kind })),
        message: this.data.realmMessage || '',
        reply: this.data.catReply || '',
      })
      wx.setStorageSync('realm_saves', saves)
    } catch (e) {}

    /* 图形图片 → 卡片库（与 catItem 页的 catItemCards 同一 key、同一结构） */
    let list = []
    try { list = wx.getStorageSync('catItemCards') || [] } catch (e) {}
    if (!Array.isArray(list)) list = []
    list.unshift({
      id: 'realm_' + d.getTime(),
      name: g.won ? '秘境 · 已连通' : '秘境 · 搭建中',
      category: 'cards',
      icon: filePath,
      cover: filePath,
      source: 'realm',
      linked: !!g.linked,
      won: !!g.won,
      message: this.data.realmMessage || '',
      reply: this.data.catReply || '',
      createdAt: d.getTime(),
    })
    try {
      wx.setStorageSync('catItemCards', list)
      wx.showToast({ title: '已保存到卡片库', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败，重试一下', icon: 'none' })
    }
    done && done()
  },

  /* ---------------- 秘境生成（重置本关） ---------------- */

  onReset() {
    const g = this.game
    g.board = LEVEL.base.map(b => ({ ...b }))
    this._tray = buildTray()
    g.pieces = expandTray(this._tray)
    g.drag = null
    g.preview = null
    g.won = false
    g.linked = false
    this.syncTray()
    this.draw()
  },

  /* ---------------- 调试：吸附模式 / 网格开关 ---------------- */

  /* 切换吸附模式：边线+A ↔ 仅地面 */
  onCycleSnap() {
    const modes = [
      { mode: 'edge', label: '边线+A' },
      { mode: 'off',  label: '仅地面' },
    ]
    const cur = this.data.snapMode
    const idx = modes.findIndex(m => m.mode === cur)
    const next = modes[(idx + 1) % modes.length]
    this.game._snapMode = next.mode
    this.setData({ snapMode: next.mode, snapLabel: next.label })
  },

  /* 切换地面网格参考线（默认关，调出来方便核对格子吸附） */
  onToggleShowGrid() {
    const on = !this.game._showGrid
    this.game._showGrid = on
    this.setData({ showGridLabel: on ? '开' : '关' })
    this.draw()
  },

  /* ---------------- 底部导航 / 分享 ---------------- */

  onTabChange(e) {
    const routes = {
      room:    '/pages/catRoom/catRoom',
      mood:    '/pages/catMoodLib/catMoodLib',
      store:   '/pages/catItem/catItem',
      kitchen: '/subpkg_food/pages/catFood/catFood',
    }
    if (routes[e.detail.key]) {
      wx.redirectTo({ url: routes[e.detail.key] })
    }
  },

  onShareAppMessage() {
    return { title: 'Aion 星星猫 — 秘境', path: '/pages/realm/realm' }
  },
})
