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
/* 旅卡插画不再单图占位：8 张图文成对池见下方 TRAVEL_CARDS */

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
/* ============================================================
   梦卡（dream 行为 · 夜间在家做梦产出）
   · 8 段老文案共用一张占位图（DREAM_PHOTO）
   · 4 张新成对卡（dr01-dr04，Figma 旅行卡文件 7:39-7:42）各有自己的插画
   · 抽卡去重（4 + 8 = 12 个槽位，见完一轮再洗牌）
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

/* 4 张新梦卡：Figma dr01-dr04，图文成对、文案原文落表（清掉 Figma 缩进） */
const DREAM_CARDS_PAIRED = [
  {
    no: 'No. dr01', file: 'cdr01.jpg',
    text: '我在屋顶做了一个梦：\n一只狗在漆黑的森林奔跑， 路很明亮，月亮很弯，树在风中摇摆。 月光铺成长长的绸带， 落进林间的缝隙。 它一直向前，没有终点， 森林安静，只有风声， 我悬在半空看着， 分不清是它在赶路，还是我跟着一起流浪。',
  },
  {
    no: 'No. dr02', file: 'cdr02.jpg',
    text: '我在树荫下，做了一个梦：\n一棵巨大的树撑开柔软的绿冠， 穿红裙的小人静静站在树下，仰起头。 她没有说话，只是望着层层叠叠的叶子。 风慢慢拂过树冠，落下细碎的光斑， 世界安静得只剩下树叶轻轻呼吸。',
  },
  {
    no: 'No. dr03', file: 'cdr03.jpg',
    text: '我沉沉睡去，走进了雨的梦境。 林间飘着细雨，绿得柔和。 撑橙伞的人与小狗，沿着小路缓步向前。 我悄悄跟在不远处的树影里，看着他们。 雨落在树叶上沙沙作响， 我就这样，陪着他们走了一段安静的雨中长路。',
  },
  {
    no: 'No. dr04', file: 'cdr04.jpg',
    text: '我打盹的时候做了个梦。 梦里我坐在椅子上，对着老式电视机。 屏幕泛着白光，空空的。 遥控器放在地上。 房间一片昏暗，我不明白电视为啥只有屏幕的光。 我坐着不动，一直看着它。',
  },
]
const DREAM_DIR = '/assets/CodeBuddyAssets/dreamCards/'
const DREAM_POOL_KEY = 'catDreamPoolUsed'

/* 抽卡：4 张成对 + 8 张共用图，12 个槽位见完一轮再洗牌 */
function drawDreamCard() {
  let used = _read(DREAM_POOL_KEY, [])
  if (!Array.isArray(used)) used = []
  const total = DREAM_CARDS_PAIRED.length + DREAM_TEXTS.length
  const available = []
  for (let i = 0; i < total; i++) if (used.indexOf(i) < 0) available.push(i)
  if (!available.length) { used = []; for (let i = 0; i < total; i++) available.push(i) }
  const idx = pick(available)
  used.push(idx)
  _write(DREAM_POOL_KEY, used)
  if (idx < DREAM_CARDS_PAIRED.length) {
    const tpl = DREAM_CARDS_PAIRED[idx]
    return { no: tpl.no, text: tpl.text, photo: DREAM_DIR + tpl.file }
  }
  return {
    no: 'No. ' + makeCardNo(),
    text: DREAM_TEXTS[idx - DREAM_CARDS_PAIRED.length],
    photo: DREAM_PHOTO,
  }
}

function addDreamCard(at) {
  const tpl = drawDreamCard()
  const card = {
    id: 'dream_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    no: tpl.no,
    photo: tpl.photo,
    text: tpl.text,
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
/* 旅卡素材池：8 张「插画 + 文案」成对（Figma 旅行卡 992-999 原样落表，
   编号与文案一字未改，图由 Figma 直出到 assets/CodeBuddyAssets/travelCards/）
   wide=true 仅 992：通栏横图 + 文案在下；其余为「左图右文」 */
const TRAVEL_CARDS = [
  {
    no: '992-BUG-STARE', file: 'c992.png', wide: true,   // 横图 + 透明底，保留 PNG
    quote: '翻过三道围墙，遇见一只很凶的鹅，绕路时发现了整条街最软的草。',
  },
  {
    no: '993-BUG-STARE', file: 'c993.jpg',
    quote: '末班车开过的时候，路牙震得我尾巴麻。我站在站牌边看它开远，想起你上次出门很久才回来，我当时趴在窗台上也是这么等的。',
  },
  {
    no: '994-BUG-STARE', file: 'c994.jpg',
    quote: '我没有找到什么特别的宝贝。只是一路走走停停，看见很多东西，第一反应都是：要是你也能看见就好了。',
  },
  {
    no: '995-BUG-STARE', file: 'c995.jpg',
    quote: '我路过一处旧围墙，闻到很久之前残留的情绪。说不清是难过还是疲惫，我停下来陪它待了一小会儿。',
  },
  {
    no: '996-BUG-STARE', file: 'c996.jpg',
    quote: '草甸上有绵羊在发呆，我也跟它们一起发了十分钟呆。风把蒲公英吹到我鼻子上，我打了个喷嚏，想起你上次笑我打喷嚏皱鼻子的样子。',
  },
  {
    no: '997-BUG-STARE', file: 'c997.jpg',
    quote: '今天在超市后门躲太阳，冷藏柜吹出来的风，和你上次开冰箱门凉到我鼻子那次一模一样。我蹲在那里等了三分钟，没人给我们递小鱼干。',
  },
  {
    no: '998-BUG-STARE', file: 'c998.jpg',
    quote: '刚才下了十分钟小雨，我躲在桥洞下面，听雨点打在河面上哒哒响。本来想跟你说今天雨的味道很好闻，但是回来的时候雨停了，我又忘了要说什么。',
  },
  {
    no: '999-BUG-STARE', file: 'c999.jpg',
    quote: '我偷偷跟着一只蚂蚱走了半条街道！它钻到草丛不见了，害我原地找了好久，差点忘记回家的时间。',
  },
]
const TRAVEL_DIR = '/assets/CodeBuddyAssets/travelCards/'
const TRAVEL_POOL_KEY = 'catTravelPoolUsed'   // 已抽过的卡号；见完一轮再洗牌

/* 抽卡：8 张抽过不重复，见完一轮重置（与位置卡同款去重） */
function drawTravelCard() {
  let used = _read(TRAVEL_POOL_KEY, [])
  if (!Array.isArray(used)) used = []
  let pool = TRAVEL_CARDS.filter(c => used.indexOf(c.no) < 0)
  if (!pool.length) { used = []; pool = TRAVEL_CARDS.slice() }
  const tpl = pick(pool)
  used.push(tpl.no)
  _write(TRAVEL_POOL_KEY, used)
  return tpl
}

function addTravelCard(at) {
  const tpl = drawTravelCard()
  const card = {
    id: 'travel_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    no: tpl.no,                 // 992-BUG-STARE（渲染时前面补 No.）
    photo: TRAVEL_DIR + tpl.file,
    wide: !!tpl.wide,           // 992 是横图，卡面布局走通栏
    quote: tpl.quote,
    mine: '',                   // 用户写给这张卡的回信
    catReply: '',               // 猫读完后回的信（AI 生成，永久留在卡上）
    replied: false,             // 猫是否已回信
    createdAt: at || Date.now(),
  }
  return _pushList(TRAVEL_KEY, card, 30)
}
function getTravelCards() { return _read(TRAVEL_KEY, []) }
function getLatestTravel() { const l = getTravelCards(); return l.length ? l[0] : null }

/* 旅卡局部更新：用户寄出回信 / 写入猫的回信 */
function updateTravelCard(id, patch) {
  const list = getTravelCards()
  const idx = list.findIndex(c => c && c.id === id)
  if (idx < 0) return null
  list[idx] = { ...list[idx], ...patch }
  _write(TRAVEL_KEY, list)
  return list[idx]
}
/* 旅卡被收入物品库后，从源列表移除（防止下次恢复时再次出现在 other · 明信片 tab） */
function removeTravelCard(id) {
  const list = _read(TRAVEL_KEY, [])
  if (!Array.isArray(list) || !list.length) return false
  const next = list.filter(c => c && c.id !== id)
  if (next.length === list.length) return false
  _write(TRAVEL_KEY, next)
  return true
}

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
/* 邮件被收入卡片后，从邮件列表里移出（防止下次恢复时又出现在 other · 邮件 tab） */
function removeMail(id) {
  const list = _read(MAIL_KEY, [])
  if (!Array.isArray(list) || !list.length) return false
  const next = list.filter(m => m && m.id !== id)
  if (next.length === list.length) return false
  _write(MAIL_KEY, next)
  return true
}

/* ============================================================
   外出去处（goOut · 位置 tab 的地图）
   位置卡片素材：F:\...\参考\猫\风格\确定风格\位置卡片\site_*.png
   已打包到 assets/CodeBuddyAssets/sites/（640px WebP）。
   name/note 与画面里烤进图的标签一致；site_01 为 site_02 的草稿未采用。
   ============================================================ */
const SITE_DIR = '/assets/CodeBuddyAssets/sites'
/* 猫刚溜出门（goOut）：位置不明，用「我在这儿」模糊梗图（site_01 扁平版，
   无具体景物更贴「不清楚」的梗；site_02 带地图景的版本保留在仓库备用） */
const SITE_HOME = { img: SITE_DIR + '/site_01.webp', name: '我在这儿', note: '具体在哪，我不清楚' }
/* 溜达到某处（catLocation）：随机抽一张去处卡 */
const SITE_CARDS = [
  { img: SITE_DIR + '/site_03.webp', name: '桥洞躲雨处',   note: '垂柳下的风' },
  { img: SITE_DIR + '/site_04.webp', name: '打盹的石阶',   note: '田埂尽头' },
  { img: SITE_DIR + '/site_05.webp', name: '蒲公英坡',     note: '风停下来的地方，晒过太阳的草甸' },
  { img: SITE_DIR + '/site_06.webp', name: '漏窗前的影子', note: '假山背后，荷花池边' },
  { img: SITE_DIR + '/site_07.webp', name: '半山亭子',     note: '溪流水声里，云飘过去的山口' },
  { img: SITE_DIR + '/site_09.webp', name: '卖花摊边掉落的花瓣', note: '天桥桥墩避风角' },
  { img: SITE_DIR + '/site_10.webp', name: '掉了半块面包的台阶', note: '超市后门的纸箱，冷藏柜出风口' },
  { img: SITE_DIR + '/site_11.webp', name: '晒过太阳的墙根', note: '爬墙虎藤下面，墙缝的小风' },
  { img: SITE_DIR + '/site_12.webp', name: '梧桐树荫下',   note: '冒热气的井盖，路牙石边的光斑' },
  { img: SITE_DIR + '/site_13.webp', name: '末班车开过的路牙', note: '公交站长椅下，站牌后面躲雨' },
]

/* 去重：本轮已抽过的去处名，全出完再重置（不重复直至全出完）。
   site_01（home 卡）不参与去重，goOut 专用；只对 10 张去处卡去重 */
const PLACE_SEEN_KEY = 'catPlaceSeen'
function _getPlaceSeen() {
  try { const v = wx.getStorageSync(PLACE_SEEN_KEY); return Array.isArray(v) ? v : [] } catch (e) { return [] }
}
function _setPlaceSeen(arr) {
  try { wx.setStorageSync(PLACE_SEEN_KEY, arr) } catch (e) {}
}
function _pickSiteNoRepeat() {
  const seen = _getPlaceSeen()
  const unseen = SITE_CARDS.filter(c => seen.indexOf(c.name) < 0)
  if (!unseen.length) {
    /* 10 张全出过 → 重新洗牌，从头开始 */
    const card = pick(SITE_CARDS)
    _setPlaceSeen([card.name])
    return card
  }
  const card = pick(unseen)
  _setPlaceSeen(seen.concat([card.name]))
  return card
}

function addPlace(opts) {
  const card = (opts && opts.home) ? SITE_HOME : _pickSiteNoRepeat()
  const place = {
    id: 'place_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    img: card.img,
    name: card.name,
    note: card.note,
    at: Date.now(),
  }
  return _pushList(PLACE_KEY, place, 50)   /* cap 20→50：兜底冗余，去重后基本不会触顶 */
}
function getPlaces() { return _read(PLACE_KEY, []) }
function getLatestPlace() { const l = getPlaces(); return l.length ? l[0] : null }
/* 去处被收入物品库后，从源列表移除（防止下次恢复时再次出现在 other · 位置 tab） */
function removePlace(id) {
  const list = _read(PLACE_KEY, [])
  if (!Array.isArray(list) || !list.length) return false
  const next = list.filter(p => p && p.id !== id)
  if (next.length === list.length) return false
  _write(PLACE_KEY, next)
  return true
}

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
  addTravelCard, getTravelCards, getLatestTravel, updateTravelCard, removeTravelCard,
  /* 邮件 */
  addMail, getMails, getLatestMail, removeMail,
  /* 去处（位置地图） */
  addPlace, getPlaces, getLatestPlace, removePlace,
  /* 秘境物料 / 解锁 */
  getMaterials, addRealmMaterial, seedMaterialsForTest, MATERIAL_CAPS, MATERIAL_NAMES,
  unlockRealm, isRealmUnlocked,
  /* 心情 */
  addMoodRecord,
}
