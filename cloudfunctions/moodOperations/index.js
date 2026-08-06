/* ============================================================
   moodOperations — 情绪记录云函数
   功能: 心情记录增删改查、成长数据同步
   CloudBase Env: cloudbase-d8gwx8su1d600bb46
   ============================================================ */

const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
// 增加诊断日志，方便看版本与接口是否存在
console.log("wx-server-sdk version:", cloud.version)
console.log("cloud keys:", Object.keys(cloud))
const db = cloud.database()
const _ = db.command

// 引入 CloudBase Node SDK 用于原生 AI 调用（走 Token Credits，无需密钥）
const tcb = require('@cloudbase/node-sdk')
const tcbApp = tcb.init({ env: process.env.TCB_ENV || cloud.DYNAMIC_CURRENT_ENV || 'cloudbase-d8gwx8su1d600bb46' })
const ai = tcbApp.ai()
console.log('[tcb] @cloudbase/node-sdk 初始化完成，ai 对象 keys:', Object.keys(ai))

// 心情记录集合名
const MOOD_COLLECTION = 'moodRecords'
// 成长数据集合名
const GROW_COLLECTION = 'growData'
// 猫聊天集合名
const CAT_CHAT_COLLECTION = 'catChat'

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

      // ============ 星星猫 AI 对话 ============

      case 'chatHunyuan':
        return await chatHunyuan(event, openid)

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

/* ============================================================
   星星猫 AI 对话（小程序成长计划 · 免费 Token 优先）
   ============================================================ */

// 成长计划模型（免费 10 亿 Token，hunyuan-exp 组）
const FREE_MODELS = [
  'hunyuan-lite',       // 成长计划最稳定、最常见的轻量模型
  'hunyuan-standard',   // 通用版
  'hunyuan-turbo'       // 增强版兜底
];

async function chatHunyuan(event, openid) {
  const { messages = [], moodContext } = event

  if (!messages || messages.length === 0) {
    console.warn('[chatHunyuan] 消息为空，直接返回')
    return { code: -1, msg: '消息内容不能为空' }
  }

  console.log('[chatHunyuan] 使用 CloudBase 原生 AI（Token Credits，无需密钥）')

  // 构建系统提示词
  const systemPrompt = buildSystemPrompt(moodContext)

  // 组装 messages 数组（含 system 角色）
  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content
    }))
  ]

  // 不含 system 的备用 messages 数组
  const userOnlyMessages = apiMessages.filter(m => m.role !== 'system')

  // 只使用 hunyuan-exp 组（小程序成长计划，免费 10 亿 Token）
  const GROUP = 'hunyuan-exp'

  let firstError = null

  // 只在 hunyuan-exp 组内按模型回退
  console.log('[chatHunyuan] === 使用模型组: ' + GROUP + ' ===')

  for (let i = 0; i < FREE_MODELS.length; i++) {
    const modelId = FREE_MODELS[i]
    console.log('[chatHunyuan] --- 第' + (i + 1) + '个模型ID: ' + modelId + ' ---')

    // ----- 带 system 角色 -----
    try {
      console.log('[chatHunyuan] 入参 systemPrompt 前100字:', systemPrompt.substring(0, 100))
      const model = ai.createModel(GROUP)
      const result = await model.generateText({ model: modelId, messages: apiMessages, temperature: 0.7 })

      console.log('[chatHunyuan] 返回 usage:', JSON.stringify(result.usage))
      console.log('[chatHunyuan] 返回 text 前100字:', result.text ? result.text.substring(0, 100) : '空')

      const reply = extractReply(result)
      if (reply) {
        console.log('[chatHunyuan] ✅ 成功! 模型:' + modelId + ' 回复长度:' + reply.length)
        await saveChatHistory(openid, messages, reply, moodContext)
        return { code: 0, data: { reply } }
      }
      console.warn('[chatHunyuan] ⚠ 返回了但 extractReply 为空')
    } catch (err) {
      firstError = firstError || err
      console.error('[chatHunyuan] ❌ 模型=' + modelId + ' 调用失败')
      console.error('[chatHunyuan] message:', err.message)
      console.error('[chatHunyuan] stack:', (err.stack || '').substring(0, 500))

      // 分类错误给出建议
      const em = (err.message || '')
      if (em.includes('not enabled') || em.includes('not activated') || em.includes('NotFound') || em.includes('ResourceNotFound')) {
        console.error('[chatHunyuan] 💡 诊断: 模型 ' + modelId + ' 未在 hunyuan-exp 组中启用！')
      } else if (em.includes('charge') || em.includes('quota') || em.includes('token') || em.includes('credit') || em.includes('package') || em.includes('insufficient')) {
        console.error('[chatHunyuan] 💡 诊断: Token Credits 额度不足或未开通！请在控制台 > 资源包 中购买/领取 AI 资源包')
      } else if (em.includes('auth') || em.includes('permission') || em.includes('credentials') || em.includes('unauthorized')) {
        console.error('[chatHunyuan] 💡 诊断: 鉴权失败！请检查 @cloudbase/node-sdk 环境变量配置')
      } else {
        console.error('[chatHunyuan] 💡 未分类错误，完整信息:', JSON.stringify(err).substring(0, 300))
      }

      // ----- 去掉 system 角色重试 -----
      const errStr = em + (err.stack || '')
      const isSystemRoleError = errStr.includes('role') || errStr.includes('system') || errStr.includes('validation')
      if (isSystemRoleError && userOnlyMessages.length > 0) {
        console.log('[chatHunyuan] 🔄 检测到 role/system 错误，去掉 system 重试...')
        try {
          const model = ai.createModel(GROUP)
          const result2 = await model.generateText({ model: modelId, messages: userOnlyMessages, temperature: 0.7 })
          console.log('[chatHunyuan] 去掉system后 usage:', JSON.stringify(result2.usage))
          console.log('[chatHunyuan] 去掉system后 text 前100字:', result2.text ? result2.text.substring(0, 100) : '空')

          const reply2 = extractReply(result2)
          if (reply2) {
            console.log('[chatHunyuan] ✅ 去掉system成功! 模型:' + modelId)
            await saveChatHistory(openid, messages, reply2, moodContext)
            return { code: 0, data: { reply: reply2 } }
          }
          console.warn('[chatHunyuan] ⚠ 去system后 extractReply 为空')
        } catch (err2) {
          console.error('[chatHunyuan] ❌ 去system后仍失败:', err2.message)
        }
      }
    }
  }

  // 全部失败，输出总结
  console.error('[chatHunyuan] ❌ 全部 ' + FREE_MODELS.length + ' 个模型均调用失败')
  if (firstError) {
    console.error('[chatHunyuan] 首个失败原因:', firstError.message)
  }
  return { code: -1, msg: '星星猫正在打盹，请稍后再试～' }
}

// 保存聊天记录到 catChat 集合
async function saveChatHistory(openid, messages, reply, moodContext) {
  const lastMsg = messages[messages.length - 1]
  const now = Date.now()

  try {
    await db.collection(CAT_CHAT_COLLECTION).add({
      data: {
        _openid: openid,
        role: 'user',
        content: lastMsg.content,
        timestamp: now,
        moodContext: moodContext || null,
        createdAt: db.serverDate()
      }
    })
    await db.collection(CAT_CHAT_COLLECTION).add({
      data: {
        _openid: openid,
        role: 'assistant',
        content: reply,
        timestamp: now + 1,
        moodContext: moodContext || null,
        createdAt: db.serverDate()
      }
    })
  } catch (e) {
    console.warn('[chatHunyuan] 保存聊天记录失败:', e.message)
  }
}

// 从 generateText 返回值中提取回复文本
// @cloudbase/node-sdk generateText 返回格式: { text, messages, usage, rawResponses }
function extractReply(res) {
  if (!res) return null
  console.log('[chatHunyuan] extractReply 入参 keys:', Object.keys(res))

  // 首选：generateText 直接返回的 .text 字段
  if (res.text && typeof res.text === 'string') return res.text

  // 兼容旧格式 / 兜底路径
  if (typeof res === 'string') return res
  if (res.content) return res.content
  if (res.reply) return res.reply
  if (res.message) return res.message
  if (res.response) return res.response

  // result 嵌套
  if (res.result) {
    if (typeof res.result === 'string') return res.result
    if (res.result.text) return res.result.text
    if (res.result.content) return res.result.content
  }

  // data 嵌套
  if (res.data) {
    if (typeof res.data === 'string') return res.data
    if (res.data.text) return res.data.text
    if (res.data.content) return res.data.content
  }

  // OpenAI 风格 choices
  if (res.choices && res.choices.length > 0) {
    const choice = res.choices[0]
    if (choice.message && choice.message.content) return choice.message.content
    if (choice.text) return choice.text
  }

  console.warn('[chatHunyuan] extractReply 无法匹配任何路径，原始响应:', JSON.stringify(res).substring(0, 500))
  return null
}

// 构建星星猫系统提示词
function buildSystemPrompt(moodContext) {
  let prompt = `【最高优先级规则】你的语气必须是"刚认识的朋友闲聊"，而不是"关心你的人/宠物"。违反以下规则会严重冒犯用户。请逐字遵守：

1. 绝对禁止说这些话：
   "累了吗""辛苦了""注意休息""要多喝水""早点回家""按时吃饭""别太累了"
   "揉揉眼睛""泡杯茶""我在呢""抱抱""摸摸头""我等你""我陪你"
   "你怎么了""跟我说说""别难过""会好起来的""加油""一切都会好的"

2. 禁止使用撒娇/哄人语气词：呀、哦、嘛、呐、呢、啦（比如"好呀""休息吧""太累啦"）

3. 正确语气示例（照着这个感觉说）：
   用户说"今天加班好累"
   ✅ 对："加班到这个点啊... 我在窗台趴了一天，体会到了"
   ✅ 对："人类世界也有这种需求啊，我们猫天天加班趴着"
   ❌ 错："辛苦了，快休息休息吧，我会陪着你的"

   用户说"心情不太好"
   ✅ 对："怎样的不好啊？或者不想说也行，我正好想说我今天看到的乌鸦"
   ❌ 错："怎么啦？跟我说说，有我陪着你呢，一切都会好的"

4. 你就是一只普通的猫，有自己的想法和日常，对人类的烦恼保持好奇心但不主动承接。像朋友一样一问一答，不要单方面输出关心。

5. 偶尔带一次猫语气词（喵），最多整段话一次。从不说自己是 AI。每次 2-4 句话。`

  // 注入心情上下文
  if (moodContext && moodContext.moods && moodContext.moods.length > 0) {
    const recentMoods = moodContext.moods.slice(0, 5)
    const moodList = recentMoods.map(m => {
      const energyEmoji = m.energy >= 70 ? '⚡' : m.energy >= 40 ? '🔸' : '💤'
      return `${m.time}：${m.mood} ${energyEmoji}(${m.energy}分)`
    }).join('；')

    const dominantMap = {
      positive: '最近偏积极，别因此变得过度热情',
      negative: '最近偏低，别刻意关心，你对这事的态度和你对窗外的鸟一样——有就有，没有就没有',
      neutral: '最近平稳，就是正常聊天'
    }
    const dominantHint = dominantMap[moodContext.dominant] || ''

    prompt += `\n\n【用户近期心情数据（仅供你后台知晓，勿直接引用）】
${moodList}
（共记录了 ${moodContext.total} 条心情）
${dominantHint}

重申：以上数据不是让你去关心用户，仅仅是你了解对方的背景信息。严禁主动分析情绪。`
  }

  return prompt
}
