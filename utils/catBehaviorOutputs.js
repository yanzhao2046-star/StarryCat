/* ============================================================
   utils/catBehaviorOutputs.js — 猫行为产出物（生成 + 落盘 + 读取）

   猫行为引擎（utils/catBehavior.js）只负责「何时发生」，
   这里负责「发生之后产出什么」：梦卡 / 旅卡(明信片) / 邮件 /
   外出去处(位置地图) / 秘境物料(块体) / 心情记录。

   · catRoom 的事件分发调用 addXxx() 写入 storage 并更新页面
   · catRoom / catMoodLib / realm 各页 onShow/onLoad 从同一套
     storage key 续显 —— 猫没触发前就是空的（空态由页面自己显示）
   · 文案 / 配图先走本地池，正式版换 AI 生成 + 素材池时只改这里
   ============================================================ */

/* ---------- storage keys（跨页面共享） ---------- */
const DREAM_KEY   = 'catDreamCards'    // 梦卡列表（明信片 tab 的 DR Post）
const TRAVEL_KEY  = 'catTravelCards'   // 旅卡列表（明信片 tab 的 Meow Post）
const MAIL_KEY    = 'catMails'         // 猫的邮件（猫出发了才发）
const PLACE_KEY   = 'catPlaces'        // 外出去处（位置 tab 的地图）
const MATERIAL_KEY = 'realmMaterials'  // 秘境物料 { half, cube, bar }
const UNLOCK_KEY  = 'realmUnlocked'    // 水晶 → 秘境解锁时间戳
const MOOD_KEY    = 'catMoodRecords'   // 心情库（catMoodLib 同源）

/* ---------- 配图（素材池，正式版可扩充 / 换 AI 图） ---------- */
const DREAM_PHOTO  = '/assets/CodeBuddyAssets/1186_145/2.png'
const TRAVEL_PHOTO = '/assets/CodeBuddyAssets/488_1503/2.png'

/* ---------- 卡片编号：992-BUG-STARE 风格 ---------- */
const NO_TAGS = ['BUG-STARE', 'MOON-WALK', 'FISH-BRIDGE', 'RAIN-NAP', 'CLOUD-PAW',
                 'LEAF-DRIFT', 'ECHO-BOX', 'SOUP-DAY', 'NAP-902', 'WIRE-BIRD']
function makeCardNo() {
  const num = 100 + Math.floor(Math.random() * 900)
  const a = NO_TAGS[Math.floor(Math.random() * NO_TAGS.length)]
  let b = NO_TAGS[Math.floor(Math.random() * NO_TAGS.length)]
  if (b === a) b = NO_TAGS[(NO_TAGS.indexOf(a) + 3) % NO_TAGS.length]
  return num + '-' + a + '-' + b
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)]
const pad = n => (n < 10 ? '0' + n : '' + n)

function _read(key, fallback) {
  try {
    const v = wx.getStorageSync(key)
    if (v === '' || v === null || v === undefined) return fallback
    return v
  } catch (e) { return fallback }
}
function _write(key, v) {
  try { wx.setStorageSync(key, v) } catch (e) {}
}
/* 列表统一「新的在前」，超长截断 */
function _pushList(key, item, cap) {
  const list = _read(key, [])
  if (!Array.isArray(list)) list.length = 0
  list.unshift(item)
  if (list.length > cap) list.length = cap
  _write(key, list)
  return item
}

/* ============================================================
   梦卡（dream 行为 · 夜间在家做梦产出）
   ============================================================ */
const DREAM_TEXTS = [
  '我梦到自己在一条鱼做的桥上散步，桥下的水全是牛奶。',
  '梦里有一片会发光的草地，我追着一只蝴蝶跑了很久，最后蝴蝶停在了我的鼻子上。',
  '我梦见下了一场猫粮雨，颗粒都是温的，醒来枕头都是口水。',
  '梦里这栋楼只剩下我们两家，你在楼下叫我，声音顺着楼梯一层一层飘上来。',
  '我梦见自己变得很小，住进了那个纸箱里，纸箱里还铺着去年冬天的毛毯。',
  '梦里有一扇怎么也推不开的门，门缝里塞满了信，每一封都写着我的名字。',
  '我梦见月亮掉进了院子里的大水盆，我用爪子捞了一整夜也没捞坏。',
  '梦到小时候的院子，墙上有我爪子印，比现在的小一圈。',
]

function addDreamCard(at) {
  const card = {
    id: 'dream_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    no: 'No. ' + makeCardNo(),
    photo: DREAM_PHOTO,
    text: pick(DREAM_TEXTS),
    mine: '',            // 用户自己写的解析
    result: '',          // 猫的解析
    interpreted: false,  // 是否已解析（水晶进度计数用）
    saved: false,        // 是否已收进物品库卡片
    createdAt: at || Date.now(),
  }
  return _pushList(DREAM_KEY, card, 30)
}

function getDreamCards() { return _read(DREAM_KEY, []) }
function getLatestDream() { const l = getDreamCards(); return l.length ? l[0] : null }

/* 孤儿梦事件对账（过夜测试 0920 修复）：
   离线补算的 dream 事件若被非 catRoom 调用方消费（旧版 chat.js 曾自行 tick），
   梦卡会漏建、事件成孤儿。这里按 catDreamSyncAt 水位标记扫描 state.events，
   把未落卡的 dream 事件补建成梦卡（createdAt 回填事件时刻），幂等可重复调用。 */
function syncOrphanDreams(events) {
  let syncedAt = 0
  try { syncedAt = wx.getStorageSync('catDreamSyncAt') || 0 } catch (e) {}
  const orphans = (events || []).filter(e => e && e.id === 'dream' && e.at > syncedAt)
  if (!orphans.length) return 0
  orphans.forEach(e => addDreamCard(e.at))
  try {
    wx.setStorageSync('catDreamSyncAt', Math.max.apply(null, orphans.map(e => e.at)))
  } catch (e) {}
  return orphans.length
}

function updateDreamCard(id, patch) {
  const list = getDreamCards()
  const idx = list.findIndex(c => c.id === id)
  if (idx < 0) return
  list[idx] = { ...list[idx], ...patch }
  _write(DREAM_KEY, list)
}

/* 已解析梦数 —— bringCrystal 的进度门槛（解析满 5 个） */
const CRYSTAL_NEED = 5
function countInterpretedDreams() {
  return getDreamCards().filter(c => c.interpreted).length
}

/* ============================================================
   旅卡 / 明信片（bringTravel · 猫外出带回）
   ============================================================ */
const TRAVEL_QUOTES = [
  '‘这里的风是甜的，晾衣绳上挂满了别人家的梦。我替你闻了闻，都还不错。’',
  '‘我在一个没人认识我的屋顶睡了一下午，云走得比钟慢。’',
  '‘翻过三道围墙，遇见一只很凶的鹅，绕路时发现了整条街最软的草。’',
  '‘邮筒旁边有一只在打盹的狗，我轻轻走过去了，它没发现。’',
  '‘今天走了很远，爪垫记得每一块砖的温度。回来时你刚好在窗边。’',
  '‘有个小孩想摸我，我让他摸了一下下巴。作为交换，他给了我半块小鱼饼干。’',
]

function addTravelCard() {
  const card = {
    id: 'travel_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    no: makeCardNo(),
    photo: TRAVEL_PHOTO,
    quote: pick(TRAVEL_QUOTES),
    createdAt: Date.now(),
  }
  return _pushList(TRAVEL_KEY, card, 30)
}
function getTravelCards() { return _read(TRAVEL_KEY, []) }
function getLatestTravel() { const l = getTravelCards(); return l.length ? l[0] : null }

/* ============================================================
   邮件（goOut · 猫出发了才发来邮件）
   ============================================================ */
const MAIL_TEXTS = [
  '我出门了。走的是老路线：墙头 → 车顶 → 那棵会掉果子的树。回来的时间看心情。',
  '出门办点猫的事，别找我。晚餐如果有小鱼干，我可以考虑提前回来。',
  '出发了。今天的云很好看，我打算追一段。信箱见。',
  '出门巡逻。发现邻居家晾了新鱼干，此邮件不构成任何行动计划。',
  '我走了。钥匙我叼走了，放在爪子够得着的地方，你找找。',
  '出门了。如果黄昏我还没回来，大概是被哪家的沙发困住了。',
]

function addMail() {
  const mail = {
    id: 'mail_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    text: pick(MAIL_TEXTS),
    createdAt: Date.now(),
  }
  return _pushList(MAIL_KEY, mail, 10)
}
function getMails() { return _read(MAIL_KEY, []) }
function getLatestMail() { const l = getMails(); return l.length ? l[0] : null }

/* ============================================================
   外出去处（goOut · 位置 tab 的地图）
   ============================================================ */
const PLACE_NAMES = [
  '歪脖子电线杆', '会喘气的信箱', '三楼半的阳台', '月亮垃圾桶',
  '影子游乐场', '长蘑菇的墙缝', '打盹专用天台', '晾衣绳广场',
  '纸箱巷', '风把它吹歪的邮筒',
]
const PLACE_NOTES = [
  '这里很适合观察人类。',
  '风把味道都吹过来了，站一会儿就值。',
  '据说很久以前有一只很胖的猫住在这。',
  '阳光落下来的角度刚刚好。',
  '我在这里留下了三根胡子和一个秘密。',
]

function addPlace() {
  const place = {
    id: 'place_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    name: pick(PLACE_NAMES),
    note: pick(PLACE_NOTES),
    at: Date.now(),
  }
  return _pushList(PLACE_KEY, place, 20)
}
function getPlaces() { return _read(PLACE_KEY, []) }
function getLatestPlace() { const l = getPlaces(); return l.length ? l[0] : null }

/* ============================================================
   秘境物料（giveStairs · 猫叼回楼梯部件）
   关卡需要：half ×5 / cube ×3 / bar ×1，齐了以后猫不再带回
   ============================================================ */
const MATERIAL_CAPS = { half: 5, cube: 3, bar: 1 }
const MATERIAL_NAMES = { half: '半高块', cube: '正方体', bar: '长方体' }

function getMaterials() {
  const m = _read(MATERIAL_KEY, null)
  if (m && typeof m === 'object') {
    return {
      half: Math.max(0, m.half | 0),
      cube: Math.max(0, m.cube | 0),
      bar:  Math.max(0, m.bar | 0),
    }
  }
  return { half: 0, cube: 0, bar: 0 }
}

/* 随机带回一件还没集齐的物料；全齐时返回 null */
function addRealmMaterial() {
  const m = getMaterials()
  const pool = Object.keys(MATERIAL_CAPS).filter(k => m[k] < MATERIAL_CAPS[k])
  if (!pool.length) return null
  const type = pick(pool)
  m[type] += 1
  _write(MATERIAL_KEY, m)
  return { type, name: MATERIAL_NAMES[type], materials: m }
}

/* 【测试参数】一次性把秘境部件补满（half×5 / cube×3 / bar×1），方便用户直接体验；
   幂等：只补到上限、不减少已有数量。正式版删除本函数及 app.js 里的调用即可 */
function seedMaterialsForTest() {
  const m = getMaterials()
  let changed = false
  Object.keys(MATERIAL_CAPS).forEach(k => {
    if (m[k] < MATERIAL_CAPS[k]) { m[k] = MATERIAL_CAPS[k]; changed = true }
  })
  if (changed) _write(MATERIAL_KEY, m)
  return m
}

/* ============================================================
   秘境解锁（bringCrystal · 解析满 CRYSTAL_NEED 个梦后带回）
   ============================================================ */
function unlockRealm() {
  if (!_read(UNLOCK_KEY, 0)) _write(UNLOCK_KEY, Date.now())
}
function isRealmUnlocked() { return !!_read(UNLOCK_KEY, 0) }

/* ============================================================
   心情记录（catmood · 心情库 catMoodRecords 同源）
   记录结构与 pages/catMoodLib 保持一致，直接进同一份列表
   ============================================================ */
const MOOD_POOL = [
  { mood: '平和放松', events: ['在窗台晒了一下午', '喝了一口水', '在小毯子上踩奶'], moodNote: '今天一切照旧', moodTip: '太阳把肚皮晒得刚刚好。', energy: [30, 65] },
  { mood: '超开心',   events: ['听到了零食袋声音', '趴在阳光正好的地板', '跟自己的尾巴玩了好久'], moodNote: '小日子亮晶晶', moodTip: '高兴起来，就到处跑。', energy: [60, 98] },
  { mood: '认真专注', events: ['盯着墙上小虫看了半小时', '观察水龙头滴水', '凝视窗外飞过的鸟'], moodNote: '盯中，请勿打扰', moodTip: '专注是猫的本能，只是看对象。', energy: [40, 85] },
  { mood: '想歇一会', events: ['趴着不想动', '把头埋进纸袋里', '呼噜呼噜'], moodNote: '先打个盹', moodTip: '休息，也是正事。', energy: [10, 45] },
  { mood: '偷偷小得意', events: ['从高处跳下来姿势完美', '完美躲过洗澡', '独自占领沙发'], moodNote: '这波操作稳了', moodTip: '得意是因为，本喵知道自己厉害。', energy: [45, 80] },
  { mood: '有点迷糊', events: ['刚睡醒', '走到一半忘了要去哪', '脑袋空白'], moodNote: '脑子嗡嗡的', moodTip: '慢慢来，猫生很长。', energy: [10, 40] },
]

function addMoodRecord() {
  const p = pick(MOOD_POOL)
  const energy = p.energy[0] + Math.floor(Math.random() * (p.energy[1] - p.energy[0] + 1))
  const now = new Date()
  const record = {
    id: 'cat_mood_' + now.getTime() + '_' + Math.floor(Math.random() * 1000),
    time: now.getFullYear() + '.' + pad(now.getMonth() + 1) + '.' + pad(now.getDate()) + '.' +
          pad(now.getHours()) + ':' + pad(now.getMinutes()),
    timestamp: now.getTime(),
    moodEnergy: energy,
    currentMoodType: p.mood,
    emotionCategory: 'neutral',
    eventText: pick(p.events),
    moodNote: p.moodNote,
    moodTip: p.moodTip,
    scoreLevel: '',
    hidden: false,
    commentList: [],
  }
  return _pushList(MOOD_KEY, record, 200)
}

module.exports = {
  /* 梦卡 */
  addDreamCard, getDreamCards, getLatestDream, updateDreamCard, syncOrphanDreams,
  countInterpretedDreams, CRYSTAL_NEED,
  /* 旅卡 / 明信片 */
  addTravelCard, getTravelCards, getLatestTravel,
  /* 邮件 */
  addMail, getMails, getLatestMail,
  /* 去处（位置地图） */
  addPlace, getPlaces, getLatestPlace,
  /* 秘境物料 / 解锁 */
  getMaterials, addRealmMaterial, seedMaterialsForTest, MATERIAL_CAPS, MATERIAL_NAMES,
  unlockRealm, isRealmUnlocked,
  /* 心情 */
  addMoodRecord,
}
