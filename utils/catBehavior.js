/* ============================================================
   utils/catBehavior.js — 猫行为表配置 + 结算引擎
   ⚠️ 配置说明：本文件 CONFIG 由 tools/catBehaviorEditor.html 导出后落表，
   请勿直接修改具体数值，所有参数（含出门时长 / 回家冷却 / 离线补算等引擎常量）
   都已在编辑器的「全局参数」与「引擎节奏」面板里可视化调整。
   导出 JSON 后整体替换本 CONFIG 即可（4 块：global / behaviors / exclusiveGroups / engine）。

   引擎职责（纯逻辑，不碰 UI）：
   · tick()          每 tickMinutes 结算一次自主行为（含离线补算）
   · 回家结算        互斥组按 p 归一化抽一个 + 组外独立掷骰
   · onUserAction()  用户触发类（回复互动）按 p×延迟排定猫的回应
   · addIntimacy()   亲密度累积 / 衰减（只由用户主动互动累积）
   · debug 系列      强制夜间 / 出门 / 回家 / 直接触发行某行为（联调用）

   页面接入：tick() 返回本结算周期发生的事件数组，页面按事件做 UI。
   ============================================================ */

/* ---------- 配置（编辑器导出原样落表） ---------- */
const CONFIG = {
  version: 1,
  global: {
    reactivity: 0.5,        // 实际延迟 = min + (max-min) × (1-reactivity)
    tickMinutes: 60,        // 结算粒度（分钟，1 小时一结算）
    offlineSettle: true,    // 重进小程序时补算猫干了什么
    reactivityByIntimacy: true,
    pByIntimacy: true,
    intimacyBoostK: 1,
    intimacyDecay: true,
  },
  behaviors: [
    { id: 'moveSpot',      name: '换位置',          scene: 'home',    timeWindow: 'day', trigger: 'autonomous', p: 0.8,  intimacyBoost: false, weight: 10, delayMin: 10,   delayMax: 40,    output: '猫移动到房间新位置',                   page: 'catRoom',    enabled: true },
    { id: 'sleep',         name: '睡觉',            scene: 'home',    timeWindow: 'night', trigger: 'fixed',   p: 1,    intimacyBoost: false, weight: 0,  delayMin: 0,    delayMax: 0,     output: '夜间在家入睡（状态，非概率——晚上必睡，白天活动）', page: 'catRoom', enabled: true },
    { id: 'dream',         name: '做梦',            scene: 'home',    timeWindow: 'night', trigger: 'autonomous', p: 0.5, intimacyBoost: false, weight: 6, delayMin: 60,    delayMax: 120,   output: '产出梦卡 1 张',                         page: 'catRoom',    enabled: true },
    { id: 'goOut',         name: '出门',            scene: 'home',    timeWindow: 'any', trigger: 'autonomous', p: 0.2,  intimacyBoost: false, weight: 3,  delayMin: 0,    delayMax: 0,     output: '猫外出（进入在外状态）',                page: 'catRoom',    enabled: true },
    { id: 'proactiveTalk', name: '主动说遭遇或心情', scene: 'both',    timeWindow: 'any', trigger: 'autonomous', p: 0.35, intimacyBoost: false, weight: 4,  delayMin: 0,    delayMax: 0,     output: '主动气泡讲外面的见闻（p 随用户久未互动上升）', page: 'catRoom', enabled: true },
    { id: 'catmood',       name: '猫心情',          scene: 'both',    timeWindow: 'any', trigger: 'autonomous', p: 0.5,  intimacyBoost: false, weight: 5,  delayMin: 0,    delayMax: 0,     output: '猫产生的心情AI生产',                   page: 'catmoodLib', enabled: true },
    /* 互斥组 bringBack：每次回家只带一样东西，按 p 归一化抽一个。 */
    { id: 'bringFood',     name: '带回食品',        scene: 'outside', timeWindow: 'any', trigger: 'return',     p: 0.35, intimacyBoost: false, weight: 0,  delayMin: 0,    delayMax: 0,     output: '猫粮 +N g',                            page: 'catFood',    enabled: true },
    { id: 'cateat',        name: '猫吃粮食',        scene: 'home',    timeWindow: 'any', trigger: 'autonomous', p: 0.85, intimacyBoost: false, weight: 5,  delayMin: 0,    delayMax: 0,     output: '猫在厨房消耗粮食',                     page: 'catFood',    enabled: true },
    { id: 'bringItem',     name: '带回物品',        scene: 'outside', timeWindow: 'any', trigger: 'return',     p: 0.65, intimacyBoost: false, weight: 0,  delayMin: 0,    delayMax: 0,     output: '物品入库 1 件',                        page: 'catItem',    enabled: true },
    { id: 'bringTravel',   name: '带回旅行卡',      scene: 'outside', timeWindow: 'any', trigger: 'return',     p: 0.45, intimacyBoost: false, weight: 0,  delayMin: 0,    delayMax: 0,     output: '旅行卡 1 张',                          page: 'catItem',    enabled: true },
    { id: 'catLocation',   name: '猫在哪地图',      scene: 'both',    timeWindow: 'any', trigger: 'autonomous', p: 0.65, intimacyBoost: false, weight: 5,  delayMin: 0,    delayMax: 0,     output: '地图卡1张',                            page: 'catRoom',    enabled: true },
    { id: 'bringNothing',  name: '空手而归',        scene: 'outside', timeWindow: 'any', trigger: 'return',     p: 0.1,  intimacyBoost: false, weight: 0,  delayMin: 0,    delayMax: 0,     output: '（可配一句吐槽）',                     page: '',           enabled: true },
    { id: 'replyChat',     name: '回复互动',        scene: 'both',    timeWindow: 'any', trigger: 'userAction', p: 1,    intimacyBoost: false, weight: 0,  delayMin: 2,    delayMax: 60,    output: '用户动作后的猫回复总入口：聊天窗口回复、旅行卡回信点评、梦的解析点评、心情点评回复等——用户回复完，猫按概率×延迟由 AI 生成回应', page: 'chat', enabled: true },
    { id: 'takeMail',      name: '取走邮件',        scene: 'both',    timeWindow: 'any', trigger: 'fixed',      p: 1,    intimacyBoost: false, weight: 0,  delayMin: 0,    delayMax: 0,     output: '2.4 秒叼信演出',                       page: 'catItem',    enabled: true },
    { id: 'replyMail',     name: '回复邮件',        scene: 'both',    timeWindow: 'any', trigger: 'fixed',      p: 1,    intimacyBoost: false, weight: 0,  delayMin: 4320, delayMax: 4320, output: '回信卡（3 天）',                       page: 'catItem',    enabled: true },
    { id: 'bringCrystal',  name: '带回水晶',      scene: 'outside', timeWindow: 'any', trigger: 'progress',   p: 1,   intimacyBoost: false, weight: 0, delayMin: 0,  delayMax: 0,  output: '解锁秘境功能（门槛：主人解析 5 个梦且猫全部回复后触发）', page: 'realm', enabled: true },
    { id: 'giveStairs',    name: '给予楼梯部件',  scene: 'outside', timeWindow: 'any', trigger: 'progress',   p: 0.3,  intimacyBoost: false, weight: 0, delayMin: 0,  delayMax: 0,  output: '秘境物料 +1',                           page: 'realm',      enabled: true },
    { id: 'bridgeReact',   name: '拼成桥梁反馈',  scene: 'both',    timeWindow: 'any', trigger: 'progress',   p: 1,   intimacyBoost: false, weight: 0, delayMin: 0,  delayMax: 0,  output: '猫的祝贺语',                            page: 'realm',      enabled: true },
  ],
  exclusiveGroups: [
    { id: 'bringBack', name: '回家携带产物', members: ['bringFood', 'bringItem', 'bringTravel', 'bringNothing', 'giveStairs'] },
  ],
  /* 引擎常量（出门时长 / 回家冷却 / 离线补算 / 事件流水 / 亲密度衰减 / 吃粮量）由编辑器生成 */
  engine: {
    outMin: 5,                    // 出门时长下限（分钟）
    outMax: 15,                   // 出门时长上限（分钟）
    homeStayMin: 15,              // 回家后冷却（分钟，冷却期内不再出门）
    eatGram: 2,                   // 猫每次吃掉的猫粮营养值
    intimacyDecayDays: 3,         // 连续 N 天不互动开始衰减
    intimacyDecayPerDay: 0.1,     // 每天衰减量
    maxOfflineTicks: 288,         // 离线补算上限（tick 数，防一次补太多）
    eventsKeep: 300,              // 事件流水保留条数
  },
}

/* ---------- 引擎常量已迁入 CONFIG.engine（编辑器导出原样落表） ---------- */

const STATE_KEY = 'catBehaviorState'
const B = {}   // id -> behavior 索引
CONFIG.behaviors.forEach(b => { B[b.id] = b })
const GROUP_OF = {}
CONFIG.exclusiveGroups.forEach(g => g.members.forEach(id => { GROUP_OF[id] = g }))

/* ---------- 状态 ---------- */
function defaultState() {
  return {
    location: 'home',        // home | outside
    wentOutAt: 0,            // 出门时刻
    backAt: 0,               // 计划回家时刻（回到家后清 0）
    lastTickAt: Date.now(),  // 上次结算时刻
    lastBackAt: 0,           // 上次回家时刻（出门冷却基准）
    intimacy: 0,             // 0~1 亲密度
    lastInteractAt: 0,       // 最近一次用户主动互动
    pending: [],             // 用户触发的待回应 [{ behaviorId, dueAt }]
    events: [],              // 事件流水 [{ id, name, at, data }]
    debugNight: null,        // 调试：强制夜间 true / 白天 false / null=跟随现实
  }
}

function getState() {
  let s = null
  try { s = wx.getStorageSync(STATE_KEY) } catch (e) {}
  if (!s || typeof s.location !== 'string') {
    s = defaultState()
    try { wx.setStorageSync(STATE_KEY, s) } catch (e) {}
  }
  if (!Array.isArray(s.pending)) s.pending = []
  if (!Array.isArray(s.events)) s.events = []
  return s
}
function saveState(s) {
  try { wx.setStorageSync(STATE_KEY, s) } catch (e) {}
}
function resetState() {
  const s = defaultState()
  saveState(s)
  return s
}

/* ---------- 基础计算 ---------- */
function isNight(now, state) {
  if (state && state.debugNight !== null && state.debugNight !== undefined) return !!state.debugNight
  const h = new Date(now).getHours()
  return h >= 22 || h < 8
}

/* 实际延迟（分钟）：min + (max-min) × (1-reactivity)；越熟越快（reactivityByIntimacy） */
function actualDelayMin(b, state) {
  let r = CONFIG.global.reactivity
  if (CONFIG.global.reactivityByIntimacy) {
    r = Math.min(1, r + state.intimacy * (1 - r))
  }
  return b.delayMin + (b.delayMax - b.delayMin) * (1 - r)
}

/* 有效概率：亲密度加成只作用于 intimacyBoost 的行为 */
function effectiveP(b, state) {
  if (!b.intimacyBoost || !CONFIG.global.pByIntimacy) return b.p
  return Math.min(1, b.p * (1 + CONFIG.global.intimacyBoostK * state.intimacy))
}

function pushEvent(state, list, b, at, data) {
  const ev = { id: b.id, name: b.name, at, data: data || null }
  list.push(ev)
  state.events.unshift({ ...ev })
  if (state.events.length > CONFIG.engine.eventsKeep) state.events.length = CONFIG.engine.eventsKeep
  return ev
}

/* ---------- 亲密度 ---------- */
function addIntimacy(delta) {
  const s = getState()
  s.intimacy = Math.max(0, Math.min(1, s.intimacy + delta))
  s.lastInteractAt = Date.now()
  saveState(s)
  return s.intimacy
}

function decayIntimacy(state, now) {
  if (!CONFIG.global.intimacyDecay || !state.lastInteractAt || state.intimacy <= 0) return
  const e = CONFIG.engine
  const days = (now - state.lastInteractAt) / 86400000
  if (days > e.intimacyDecayDays) {
    state.intimacy = Math.max(0, state.intimacy - (days - e.intimacyDecayDays) * e.intimacyDecayPerDay)
  }
}

/* ---------- 回家结算：互斥组归一化抽一个 + 组外独立掷骰 ---------- */
function settleReturn(state, list, now) {
  const done = new Set()
  CONFIG.exclusiveGroups.forEach(g => {
    const pool = g.members.map(id => B[id]).filter(b => b && b.enabled)
    if (!pool.length) return
    const total = pool.reduce((s, b) => s + effectiveP(b, state), 0)
    if (total <= 0) return
    let roll = Math.random() * total
    for (const b of pool) {
      roll -= effectiveP(b, state)
      if (roll <= 0) {
        pushEvent(state, list, b, now, returnPayload(b))
        done.add(b.id)
        break
      }
    }
    pool.forEach(b => done.add(b.id))
  })
  // 不在互斥组里的回家结算行为独立掷骰
  CONFIG.behaviors.forEach(b => {
    if (!b.enabled || b.trigger !== 'return' || done.has(b.id)) return
    if (Math.random() < effectiveP(b, state)) {
      pushEvent(state, list, b, now, returnPayload(b))
    }
  })
}

function returnPayload(b) {
  if (b.id === 'bringFood') return { gram: 5 + Math.floor(Math.random() * 11) }   // 5~15g
  return null
}

/* ---------- 主结算 tick ----------
   返回本次结算发生的事件数组（含离线补算期间的全部事件） */
function tick(now) {
  now = now || Date.now()
  const s = getState()
  const g = CONFIG.global
  const tickMs = g.tickMinutes * 60000
  const fired = []

  // 离线补算：把 lastTickAt 到 now 之间欠的 tick 补齐（有上限）
  let steps = Math.floor((now - s.lastTickAt) / tickMs)
  if (!g.offlineSettle) steps = Math.min(steps, 1)
  steps = Math.max(0, Math.min(steps, CONFIG.engine.maxOfflineTicks))

  for (let i = 0; i < steps; i++) {
    const t = s.lastTickAt + (i + 1) * tickMs
    stepOnce(s, fired, t)
  }

  // 步数不足以推进时（steps=0），也至少看一眼是否到了回家时间
  if (steps === 0 && s.location === 'outside' && now >= s.backAt) {
    arriveHome(s, fired, now)
  }

  s.lastTickAt = now - ((now - s.lastTickAt) % tickMs)
  decayIntimacy(s, now)
  saveState(s)
  return fired
}

/* 单个 tick 的结算（t = 本 tick 时刻） */
function stepOnce(s, fired, t) {
  // 到点回家
  if (s.location === 'outside' && t >= s.backAt) {
    arriveHome(s, fired, t)
  }

  const night = isNight(t, s)

  if (s.location === 'home') {
    if (night) {
      // 夜间在家 = 睡觉（状态）；只结算夜间行为（做梦）
      CONFIG.behaviors.forEach(b => {
        if (!b.enabled || b.trigger !== 'autonomous' || GROUP_OF[b.id]) return
        if ((b.timeWindow || 'any') !== 'night') return
        if (Math.random() < effectiveP(b, s)) pushEvent(s, fired, b, t)
      })
    } else {
      // 白天：结算不限/白天类自主行为
      CONFIG.behaviors.forEach(b => {
        if (!b.enabled || b.trigger !== 'autonomous' || GROUP_OF[b.id]) return
        if (b.scene === 'outside') return
        if ((b.timeWindow || 'any') === 'night') return
        if (b.id === 'goOut' && t - (s.lastBackAt || 0) < CONFIG.engine.homeStayMin * 60000) return   // 回家冷却，冷却过后可再出门
        if (Math.random() < effectiveP(b, s)) {
          pushEvent(s, fired, b, t)
          if (b.id === 'goOut') goOut(s, t)
        }
      })
    }
  } else {
    // 在外：通用场景的自主行为照常（如主动说遭遇 / 猫心情）
    CONFIG.behaviors.forEach(b => {
      if (!b.enabled || b.trigger !== 'autonomous' || GROUP_OF[b.id]) return
      if (b.scene === 'home') return
      if (night && (b.timeWindow || 'any') !== 'night') return
      if (!night && (b.timeWindow || 'any') === 'night') return
      if (Math.random() < effectiveP(b, s)) pushEvent(s, fired, b, t)
    })
  }

  // 到期的用户触发回应转正（页面在 processPending 里取走后调 AI）
  s.pending = s.pending.filter(p => {
    if (t >= p.dueAt) {
      pushEvent(s, fired, B[p.behaviorId], t, { replyTo: p.replyTo || null })
      return false
    }
    return true
  })
}

function goOut(s, t) {
  s.location = 'outside'
  s.wentOutAt = t
  s.backAt = t + (CONFIG.engine.outMin + Math.random() * (CONFIG.engine.outMax - CONFIG.engine.outMin)) * 60000
}

function arriveHome(s, fired, t) {
  s.location = 'home'
  s.wentOutAt = 0
  s.backAt = 0
  s.lastBackAt = t
  settleReturn(s, fired, t)
}

/* ---------- 用户触发：返回 { ok, delayMs } ----------
   ok=false 表示这次猫没接话（按概率掷骰失败） */
function onUserAction(kind, replyTo) {
  const s = getState()
  const now = Date.now()
  const b = CONFIG.behaviors.find(x => x.enabled && x.trigger === 'userAction' &&
    (kind === 'replyChat' || x.id === kind))
  if (!b) return { ok: true, delayMs: 0 }
  if (Math.random() >= effectiveP(b, s)) return { ok: false, delayMs: 0 }
  let d = actualDelayMin(b, s)
  /* 【过夜测试·回滚点】userAction 延迟在 min~max 区间随机掷一次（否则 reactivity=1 时
     恒等于 delayMin，每次都精确 2 分钟太机械）。正式语义：延迟由 reactivity/亲密度确定，
     测试结束把下面 1 行删掉即还原 */
  if (b.delayMax > b.delayMin) d = b.delayMin + Math.random() * (b.delayMax - b.delayMin)
  const delayMs = d * 60000
  if (delayMs <= 0) return { ok: true, delayMs: 0 }
  s.pending.push({ behaviorId: b.id, dueAt: now + delayMs, replyTo: replyTo || null })
  saveState(s)
  return { ok: true, delayMs }
}

/* ---------- 页面概览信息 ---------- */
function info() {
  const s = getState()
  const now = Date.now()
  return {
    location: s.location,
    sleeping: s.location === 'home' && isNight(now, s),
    isNight: isNight(now, s),
    intimacy: Math.round(s.intimacy * 100) / 100,
    backInMin: s.location === 'outside' ? Math.max(0, Math.ceil((s.backAt - now) / 60000)) : 0,
    recentEvents: s.events.slice(0, 10),
  }
}

/* ---------- 调试（联调面板用，正式版不暴露入口即可） ---------- */
const debug = {
  forceNight(v) { const s = getState(); s.debugNight = v; saveState(s); return info() },
  forceGoOut() {
    const s = getState(); const now = Date.now()
    goOut(s, now)   // 调试出门直接生效，不受回家冷却限制
    saveState(s)
    return info()
  },
  forceReturn() {
    const s = getState(); const fired = []
    arriveHome(s, fired, Date.now()); saveState(s)
    return { info: info(), events: fired }
  },
  /* 直接触发某个行为一次（如 bringCrystal / dream / cateat），跳过概率 */
  trigger(behaviorId) {
    const s = getState()
    const b = B[behaviorId]
    if (!b) return { events: [] }
    const fired = []
    pushEvent(s, fired, b, Date.now(), returnPayload(b))
    if (behaviorId === 'goOut') goOut(s, Date.now())
    saveState(s)
    return { events: fired }
  },
  reset() { resetState(); return info() },
}

module.exports = {
  CONFIG,
  tick,
  info,
  isNight,
  getState,
  resetState,
  addIntimacy,
  onUserAction,
  actualDelayMin,
  effectiveP,
  debug,
  EAT_GRAM: CONFIG.engine.eatGram,
}
