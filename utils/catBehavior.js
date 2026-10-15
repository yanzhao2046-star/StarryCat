/* ============================================================
 * utils/catBehavior.js — 猫行为引擎 v2
 *
 * 核心抽象：行为 = when 谓词 + do 副作用
 * 节奏由 sensitivity = 0.3 * temperament + 0.7 * intimacy 统一缩放
 *
 * 入口：
 *   tick()          每 TICK_MS（5min）结算一次；返回本周期发生的事件数组
 *   onUserAction()  用户动作后按 sensitivity 排定延迟
 *   info()          状态概览
 *   debug.*         强制夜间/出门/回家/触发
 *
 * 时间：所有"用户能感知的时间"（出门时长、replyChat/replyMail 延迟）按 sens 缩放
 *       引擎内部节奏（TICK_MS、HOME_STAY_MS）保持固定
 * ============================================================ */

const STATE_KEY = 'catBehaviorState'

/* ---- 时间常量（毫秒，引擎内部固定） ---- */
const TICK_MS         = 5 * 60 * 1000     // 5min 结算一次
const HOME_STAY_MS    = 15 * 60 * 1000    // 回家后 15min 内不能出门
const OUT_MIN_MS      = 5 * 60 * 1000     // 出门最少
const OUT_MAX_MS      = 15 * 60 * 1000    // 出门最多
const REPLY_CHAT_MIN  = 2 * 60 * 1000
const REPLY_CHAT_MAX  = 5 * 60 * 1000
const REPLY_MAIL_MS   = 45 * 60 * 1000
const MAX_OFFLINE     = 288               // 离线补算上限（24h）

/* ---- 行为频率档（sensitivity=1 时 = 原值；sens=0 时 ×0.5） ---- */
const TIER_P = { rare: 0.08, common: 0.5, always: 1 }

/* ---- 性格三档（出厂设置；冷启动固定 warm） ---- */
const TEMPERAMENT_PRESETS = { cold: 0.3, warm: 0.5, clingy: 0.8 }

/* ---- 保留 CONFIG（页面 196 行读 CONFIG.global.tickMinutes） ---- */
const CONFIG = {
  version: 2,
  global: { tickMinutes: 5 },
  engine: {
    outMinMs: OUT_MIN_MS,
    outMaxMs: OUT_MAX_MS,
    homeStayMs: HOME_STAY_MS,
    eatGram: 2,
  },
}

/* ---- 行为表：id + name + tier（tier 决定 base p） ---- */
const BEHAVIORS = {
  dream:         { id: 'dream',         name: '做梦',         tier: 'rare' },
  cateat:        { id: 'cateat',        name: '猫吃粮食',     tier: 'common' },
  moveSpot:      { id: 'moveSpot',      name: '换位置',       tier: 'common' },
  proactiveTalk: { id: 'proactiveTalk', name: '主动说遭遇',   tier: 'common' },
  catmood:       { id: 'catmood',       name: '猫心情',       tier: 'common' },
  catLocation:   { id: 'catLocation',   name: '猫在哪地图',   tier: 'common' },
  /* progress 类（带回宝石 / 楼梯部件）留作占位，调试面板可触发；具体达成逻辑见 catRoom */
  bringCrystal:  { id: 'bringCrystal',  name: '带回水晶',     tier: 'rare' },
  giveStairs:    { id: 'giveStairs',    name: '给予楼梯部件', tier: 'rare' },
  bridgeReact:   { id: 'bridgeReact',   name: '拼成桥梁反馈', tier: 'rare' },
}

/* ---- 互斥组：回家带物（giveStairs 不在此列） ---- */
const RETURN_POOL = [
  { id: 'bringFood',    name: '带回食品',   p: 0.3 },
  { id: 'bringItem',    name: '带回物品',   p: 0.5 },
  { id: 'bringTravel',  name: '带回旅行卡', p: 0.4 },
  { id: 'bringNothing', name: '空手而归',   p: 0.1 },
]

/* ---- 内存单例 + storage 懒加载 ---- */
const _state = {}
let _loaded = false

function defaultState() {
  return {
    temperament: TEMPERAMENT_PRESETS.warm,   // 冷启动：温和 0.5
    intimacy: 0,                             // 0~1
    location: 'home',                        // home | outside
    wentOutAt: 0,
    backAt: 0,
    lastTickAt: Date.now(),
    lastBackAt: 0,
    lastInteractAt: 0,
    pending: [],                             // [{ behaviorId, dueAt, replyTo }]
    dreamInterpreted: 0,                     // 已解梦数
    stairCount: 0,                           // 楼梯部件数
    debugNight: null,                        // null=跟随现实；true/false 强制
    events: [],                              // 事件流水（给 syncOrphanDreams 用，保留）
  }
}

function getState() {
  if (_loaded) return _state
  let s
  try { s = wx.getStorageSync(STATE_KEY) } catch (e) {}
  if (!s || typeof s.location !== 'string') {
    s = defaultState()
    try { wx.setStorageSync(STATE_KEY, s) } catch (e) {}
  }
  Object.assign(_state, s)
  if (!Array.isArray(_state.pending)) _state.pending = []
  if (!Array.isArray(_state.events)) _state.events = []
  _loaded = true
  return _state
}

function saveState() {
  try { wx.setStorageSync(STATE_KEY, _state) } catch (e) {}
}

function resetState() {
  Object.assign(_state, defaultState())
  _loaded = true
  saveState()
  return _state
}

/* ---- 基础计算 ---- */
function sensitivity(s) {
  return 0.3 * s.temperament + 0.7 * s.intimacy
}

function isNight(now) {
  const s = getState()
  if (s.debugNight !== null && s.debugNight !== undefined) return !!s.debugNight
  const h = new Date(now || Date.now()).getHours()
  return h >= 22 || h < 8
}

/* 用户能感知的时间：sens=0 → ×1.4（更慢），sens=1 → ×0.6（更快） */
function userTimeMs(base) {
  const s = getState()
  return Math.round(base * (1.4 - 0.8 * sensitivity(s)))
}

function outsideDuration() {
  const span = userTimeMs(OUT_MAX_MS - OUT_MIN_MS)
  const min = userTimeMs(OUT_MIN_MS)
  return min + Math.floor(Math.random() * span)
}

/* 实际触发概率 = base × (0.5 + 0.5 × sens) */
function actualP(tier, sens) {
  return TIER_P[tier] * (0.5 + 0.5 * sens)
}

/* ---- 事件记录 ---- */
function pushEvent(state, list, b, at, data) {
  const ev = { id: b.id, name: b.name, at, data: data || null }
  list.push(ev)
  state.events.unshift({ ...ev })
  if (state.events.length > 100) state.events.length = 100
  return ev
}

/* ---- 互斥组：回家带物按权重抽一个 ---- */
function settleReturn(state, list, at) {
  const total = RETURN_POOL.reduce((s, x) => s + x.p, 0)
  let roll = Math.random() * total
  for (const x of RETURN_POOL) {
    roll -= x.p
    if (roll <= 0) { pushEvent(state, list, x, at); return }
  }
  pushEvent(state, list, RETURN_POOL[RETURN_POOL.length - 1], at)
}

/* ---- 单 tick 结算（t = 本 tick 时刻） ---- */
function _stepOnce(state, list, t) {
  const sens = sensitivity(state)
  const night = isNight(t)

  /* chain 1：在家 + 非夜 + 满足回家冷却 → 按 common tier 概率出门 */
  if (state.location === 'home' && !night && (t - state.lastBackAt) >= HOME_STAY_MS) {
    if (Math.random() < actualP('common', sens)) {
      state.location = 'outside'
      state.wentOutAt = t
      state.backAt = t + outsideDuration()
      pushEvent(state, list, { id: 'goOut', name: '出门' }, t)
      return   // 出门本 tick 就不再走其他行为了（防止瞬时连续触发）
    }
  }

  /* chain 2：在外 + 到点 → 回家 + 抽带物 */
  if (state.location === 'outside' && t >= state.backAt) {
    state.location = 'home'
    state.wentOutAt = 0
    state.backAt = 0
    state.lastBackAt = t
    settleReturn(state, list, t)
  }

  /* behaviors：4 段分支（home+夜 / home+白天 / 通用 / outside） */
  if (state.location === 'home' && night) {
    /* 夜间在家 = 睡觉状态（ctx.isNight 即"睡"）；只触发 dream */
    if (Math.random() < actualP('rare', sens)) {
      pushEvent(state, list, BEHAVIORS.dream, t)
    }
  }
  if (state.location === 'home' && !night) {
    if (Math.random() < actualP('common', sens)) pushEvent(state, list, BEHAVIORS.cateat, t)
    if (Math.random() < actualP('common', sens)) pushEvent(state, list, BEHAVIORS.moveSpot, t)
  }
  /* 通用：proactiveTalk / catmood 不挑场景 */
  if (Math.random() < actualP('common', sens)) pushEvent(state, list, BEHAVIORS.proactiveTalk, t)
  if (Math.random() < actualP('common', sens)) pushEvent(state, list, BEHAVIORS.catmood, t)
  /* 在外专属：地图 */
  if (state.location === 'outside') {
    if (Math.random() < actualP('common', sens)) pushEvent(state, list, BEHAVIORS.catLocation, t)
  }

  /* pending 队列到期 */
  state.pending = state.pending.filter(p => {
    if (t >= p.dueAt) {
      const b = BEHAVIORS[p.behaviorId] || { id: p.behaviorId, name: p.behaviorId }
      pushEvent(state, list, b, t, { replyTo: p.replyTo || null })
      return false
    }
    return true
  })
}

/* ---- 主 tick：含离线补算 + steps=0 实时到家 ---- */
function tick(now) {
  now = now || Date.now()
  const state = getState()
  const list = []

  let steps = Math.floor((now - state.lastTickAt) / TICK_MS)
  steps = Math.max(0, Math.min(steps, MAX_OFFLINE))
  for (let i = 0; i < steps; i++) {
    const t = state.lastTickAt + (i + 1) * TICK_MS
    _stepOnce(state, list, t)
  }
  /* steps=0 也要看一眼到点回家（实时） */
  if (steps === 0 && state.location === 'outside' && now >= state.backAt) {
    state.location = 'home'
    state.wentOutAt = 0
    state.backAt = 0
    state.lastBackAt = now
    settleReturn(state, list, now)
  }

  state.lastTickAt = now - ((now - state.lastTickAt) % TICK_MS)
  saveState()
  return list
}

/* ---- 用户动作：按 sens 排定延迟 ---- */
function onUserAction(kind, replyTo) {
  const state = getState()
  const now = Date.now()
  if (kind === 'replyChat') {
    const min = userTimeMs(REPLY_CHAT_MIN)
    const max = userTimeMs(REPLY_CHAT_MAX)
    const delayMs = min + Math.floor(Math.random() * (max - min))
    state.pending.push({ behaviorId: 'replyChat', dueAt: now + delayMs, replyTo: replyTo || null })
    saveState()
    return { ok: true, delayMs }
  }
  if (kind === 'replyMail') {
    const delayMs = userTimeMs(REPLY_MAIL_MS)
    state.pending.push({ behaviorId: 'replyMail', dueAt: now + delayMs, replyTo: replyTo || null })
    saveState()
    return { ok: true, delayMs }
  }
  return { ok: true, delayMs: 0 }
}

/* ---- 亲密度：用户主动互动累积 ---- */
function addIntimacy(delta) {
  const state = getState()
  state.intimacy = Math.max(0, Math.min(1, state.intimacy + delta))
  state.lastInteractAt = Date.now()
  saveState()
  return state.intimacy
}

/* ---- 状态概览（给 catRoom UI 读） ---- */
function info() {
  const state = getState()
  const now = Date.now()
  return {
    location: state.location,
    sleeping: state.location === 'home' && isNight(now),
    isNight: isNight(now),
    intimacy: Math.round(state.intimacy * 100) / 100,
    temperament: state.temperament,
    sensitivity: Math.round(sensitivity(state) * 100) / 100,
    backInMs: state.location === 'outside' ? Math.max(0, state.backAt - now) : 0,
  }
}

/* ---- 调试（联调面板用） ---- */
const debug = {
  forceNight(v) {
    const s = getState()
    s.debugNight = v === false ? null : v
    saveState()
    return info()
  },
  forceGoOut() {
    const s = getState()
    const now = Date.now()
    s.location = 'outside'
    s.wentOutAt = now
    s.backAt = now + 5 * 60 * 1000
    saveState()
    return info()
  },
  forceReturn() {
    const s = getState()
    const fired = []
    s.location = 'home'
    s.wentOutAt = 0
    s.backAt = 0
    s.lastBackAt = Date.now()
    settleReturn(s, fired, Date.now())
    saveState()
    return { info: info(), events: fired }
  },
  /* 直接触发某个行为一次（跳过概率） */
  trigger(behaviorId) {
    const s = getState()
    const list = []
    const b = BEHAVIORS[behaviorId] || { id: behaviorId, name: behaviorId }
    pushEvent(s, list, b, Date.now())
    saveState()
    return { events: list }
  },
  reset() { resetState(); return info() },
}

module.exports = {
  CONFIG,
  tick,
  onUserAction,
  addIntimacy,
  info,
  isNight,
  getState,
  resetState,
  debug,
  EAT_GRAM: CONFIG.engine.eatGram,
  TEMPERAMENT_PRESETS,
}
