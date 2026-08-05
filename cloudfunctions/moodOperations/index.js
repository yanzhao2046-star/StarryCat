/* ============================================================
   moodOperations — 情绪记录云函数
   功能: 心情记录增删改查、成长数据同步
   CloudBase Env: bbubird-d4gczn6fs8d2e2ae3
   ============================================================ */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 心情记录集合名
const MOOD_COLLECTION = 'moodRecords'
// 成长数据集合名
const GROW_COLLECTION = 'growData'

exports.main = async (event, context) => {
  const { action } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    switch (action) {
      // ============ 心情记录 CRUD ============

      case 'addMood':
        return await addMood(event, openid)

      case 'getMoods':
        return await getMoods(event, openid)

      case 'getMoodDetail':
        return await getMoodDetail(event, openid)

      case 'deleteMood':
        return await deleteMood(event, openid)

      // ============ 成长数据 ============

      case 'getGrowData':
        return await getGrowData(openid)

      case 'syncGrowData':
        return await syncGrowData(event, openid)

      case 'updateGrowData':
        return await updateGrowData(event, openid)

      default:
        return { code: -1, msg: '未知操作: ' + action }
    }
  } catch (err) {
    console.error('[moodOperations] Error:', err)
    return { code: -1, msg: err.message }
  }
}

/* ============================================================
   心情记录操作
   ============================================================ */

// 新增心情记录
async function addMood(event, openid) {
  const {
    moodEnergy, currentMoodType, moodType, shareText,
    shareTip, eventText, recordTime, timestamp
  } = event.data

  const record = {
    _openid: openid,
    moodEnergy: moodEnergy || 50,
    currentMoodType: currentMoodType || '',
    moodType: moodType || '',
    shareText: shareText || '',
    shareTip: shareTip || '',
    eventText: eventText || '',
    recordTime: recordTime || '',
    timestamp: timestamp || Date.now(),
    createdAt: db.serverDate()
  }

  const res = await db.collection(MOOD_COLLECTION).add({ data: record })
  return { code: 0, msg: '记录成功', id: res._id }
}

// 获取心情记录列表（分页）
async function getMoods(event, openid) {
  const { skip = 0, limit = 20 } = event
  const res = await db.collection(MOOD_COLLECTION)
    .where({ _openid: openid })
    .orderBy('timestamp', 'desc')
    .skip(skip)
    .limit(Math.min(limit, 50))
    .get()
  return { code: 0, data: res.data }
}

// 获取单条心情详情
async function getMoodDetail(event, openid) {
  const { id } = event
  const res = await db.collection(MOOD_COLLECTION)
    .doc(id)
    .get()
  if (!res.data || res.data._openid !== openid) {
    return { code: -1, msg: '记录不存在或无权访问' }
  }
  return { code: 0, data: res.data }
}

// 删除心情记录
async function deleteMood(event, openid) {
  const { id } = event
  const record = await db.collection(MOOD_COLLECTION).doc(id).get()
  if (!record.data || record.data._openid !== openid) {
    return { code: -1, msg: '无权删除此记录' }
  }
  await db.collection(MOOD_COLLECTION).doc(id).remove()
  return { code: 0, msg: '删除成功' }
}

/* ============================================================
   成长数据操作
   ============================================================ */

// 获取成长数据
async function getGrowData(openid) {
  const res = await db.collection(GROW_COLLECTION)
    .where({ _openid: openid })
    .get()
  if (res.data.length === 0) {
    return {
      code: 0,
      data: { token: 0, wisdom: 0, understand: 0, level: 1, records: [] }
    }
  }
  return { code: 0, data: res.data[0] }
}

// 全量同步成长数据
async function syncGrowData(event, openid) {
  const { data: growData } = event
  const existing = await db.collection(GROW_COLLECTION)
    .where({ _openid: openid })
    .get()

  if (existing.data.length > 0) {
    await db.collection(GROW_COLLECTION)
      .doc(existing.data[0]._id)
      .update({ data: { ...growData, updatedAt: db.serverDate() } })
  } else {
    await db.collection(GROW_COLLECTION)
      .add({ data: { _openid: openid, ...growData, createdAt: db.serverDate() } })
  }
  return { code: 0, msg: '同步成功' }
}

// 增量更新成长数据（加分场景）
async function updateGrowData(event, openid) {
  const { type } = event
  const scoreMap = {
    mood_record:  { token: 2, wisdom: 3, understand: 4 },
    share_post:   { token: 3, wisdom: 2, understand: 2 },
    view_discover:{ token: 2, wisdom: 1, understand: 1 },
    view_calendar:{ token: 2, wisdom: 1, understand: 1 },
    comment:      { token: 2, wisdom: 2, understand: 1 },
    chat:         { token: 3, wisdom: 1, understand: 1 }
  }

  const score = scoreMap[type]
  if (!score) return { code: -1, msg: '未知行为类型: ' + type }

  // 防刷：检查当天是否已加分
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = 'growLimit_' + today.getTime()

  const res = await db.collection(GROW_COLLECTION)
    .where({ _openid: openid })
    .get()

  if (res.data.length === 0) {
    // 首次记录，直接创建
    const growData = {
      _openid: openid,
      token: score.token,
      wisdom: score.wisdom,
      understand: score.understand,
      level: 1,
      limits: { [todayKey]: { [type]: true } },
      records: [{
        time: formatTime(new Date()),
        timestamp: Date.now(),
        type,
        desc: getDesc(type),
        token: score.token,
        wisdom: score.wisdom,
        understand: score.understand
      }],
      createdAt: db.serverDate()
    }
    await db.collection(GROW_COLLECTION).add({ data: growData })
    return { code: 0, data: growData, msg: '成长数据已创建' }
  }

  // 已有记录，检查防刷
  const doc = res.data[0]
  const limits = doc.limits || {}
  if (limits[todayKey] && limits[todayKey][type]) {
    return { code: 1, msg: '今天已记录此行为', data: doc }
  }

  // 更新数据
  const newLimits = { ...doc.limits || {}, [todayKey]: { ...(limits[todayKey] || {}), [type]: true } }
  const newToken = (doc.token || 0) + score.token
  const newWisdom = (doc.wisdom || 0) + score.wisdom
  const newUnderstand = (doc.understand || 0) + score.understand
  const newLevel = Math.floor(Math.max(newToken, newWisdom, newUnderstand) / 100) + 1

  const newRecord = {
    time: formatTime(new Date()),
    timestamp: Date.now(),
    type,
    desc: getDesc(type),
    token: score.token,
    wisdom: score.wisdom,
    understand: score.understand
  }

  const records = doc.records || []
  records.unshift(newRecord)
  if (records.length > 50) records.length = 50

  await db.collection(GROW_COLLECTION).doc(doc._id).update({
    data: {
      token: newToken,
      wisdom: newWisdom,
      understand: newUnderstand,
      level: newLevel,
      limits: newLimits,
      records: records,
      updatedAt: db.serverDate()
    }
  })

  const updatedData = {
    token: newToken, wisdom: newWisdom, understand: newUnderstand,
    level: newLevel, limits: newLimits, records
  }

  return { code: 0, data: updatedData, msg: '成长数据已更新' }
}

/* ------ 内部工具函数 ------ */
function formatTime(date) {
  const pad = n => n < 10 ? '0' + n : n
  return date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' + pad(date.getMinutes())
}

function getDesc(type) {
  const descMap = {
    mood_record: '记录心情',
    share_post: '分享火苗卡',
    view_discover: '查看心情小发现',
    view_calendar: '查看情绪日历',
    comment: '发表评论/助力',
    chat: '和星猫聊心事'
  }
  return descMap[type] || type
}
