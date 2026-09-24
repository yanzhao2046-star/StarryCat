/* =================================================================
   utils/mockGenerator.js — 模拟情绪数据生成器
   生成 2026/07/01 ~ 2026/08/05 的测试数据，替换旧记录
   ================================================================= */

var MOOD_FALLBACK = {
  '平和放松': { moodNote: '有点松弛感在的', moodTip: '松弛不是懒，是你允许自己慢下来。' },
  '超开心':   { moodNote: '今天超快乐！', moodTip: '快乐会传染，多分享一点。' },
  '充满干劲': { moodNote: '冲鸭冲鸭！', moodTip: '你认真起来的样子，真的很酷。' },
  '认真专注': { moodNote: '沉浸式工作/学习中', moodTip: '专注是最好的礼物，送给自己。' },
  '想歇一会': { moodNote: '只想葛优躺', moodTip: '休息不是放弃，是为了更好的出发。' },
  '有点沮丧': { moodNote: 'emo了', moodTip: '允许自己难过，也是一种勇敢。' },
  '有点迷糊': { moodNote: '脑袋嗡嗡的', moodTip: '深呼吸，慢慢来。' },
  '烦躁生气': { moodNote: '气炸了', moodTip: '情绪需要出口，找个方式释放它。' },
  '偷偷小得意': { moodNote: '这波操作稳了！', moodTip: '稳住，你能赢。' },
  '感恩':     { moodNote: '被世界温柔以待', moodTip: '感恩不是示弱，是你看见了光。' },
  '热爱劳动': { moodNote: '今天劳模附体！', moodTip: '努力这件事，从来不会被辜负。' },
  '团队合作': { moodNote: '和队友并肩作战', moodTip: '一个人走得快，一群人走得远。' }
}

var EMOTION_CATEGORY = {
  '平和放松': 'positive', '超开心': 'positive', '充满干劲': 'positive', '认真专注': 'positive',
  '想歇一会': 'negative', '有点沮丧': 'negative', '有点迷糊': 'negative', '烦躁生气': 'negative',
  '偷偷小得意': 'neutral', '感恩': 'neutral', '热爱劳动': 'neutral', '团队合作': 'neutral'
}

var EVENT_POOLS = {
  '平和放松': ['午后散步', '公园晒太阳', '泡了杯茶', '看了一部治愈电影', '听轻音乐', '冥想片刻'],
  '超开心':   ['收到惊喜礼物', '项目验收通过', '朋友突然来访', '抢到心仪门票', '中了个小红包'],
  '充满干劲': ['完成了周报', '早起运动打卡', '搞定疑难bug', '制定了新计划', '效率爆表的一天'],
  '认真专注': ['深度学习3小时', '啃完一本技术书', '沉浸式写代码', '整理了知识体系', '心流状态'],
  '想歇一会': ['加班到很晚', '开会开到头大', '通勤太累了', '今天不想动', '电量不足'],
  '有点沮丧': ['被领导批了', '和同事闹别扭', '计划被打乱', '错过重要截止日', '感觉没人理解'],
  '有点迷糊': ['周一综合症', '午睡起来懵了', '昨天没睡好', '咖啡还没起效', '脑子转不动'],
  '烦躁生气': ['遇到甩锅侠', '堵车迟到', '方案被无理否决', '东西丢了找不到', '被人插队'],
  '偷偷小得意': ['被夸了', '悄悄涨粉了', '发现省钱小技巧', '自己做了一顿好菜', '学会了新技能'],
  '感恩':     ['妈妈寄来家乡味', '同事帮忙带早餐', '收到暖心留言', '陌生人善意相助', '猫咪陪了一整天'],
  '热爱劳动': ['大扫除焕然一新', '整理了衣柜', '做了顿饭', '修剪了绿植', '洗了积攒的衣服'],
  '团队合作': ['和同事脑暴', '帮新人解决问题', '配合完成大项目', '团建活动', '分享工作经验']
}

/**
 * 能量值 → 档位
 */
function getScoreLevel(score) {
  if (score <= 20) return 's20'
  if (score <= 40) return 's40'
  if (score <= 60) return 's60'
  if (score <= 80) return 's80'
  return 's100'
}

/**
 * 情绪 → 合理能量范围
 */
function energyRange(moodType) {
  var ranges = {
    '平和放松': [30, 65], '超开心': [60, 98], '充满干劲': [55, 95], '认真专注': [40, 85],
    '想歇一会': [10, 45], '有点沮丧': [5, 35],  '有点迷糊': [10, 40], '烦躁生气': [15, 50],
    '偷偷小得意': [45, 80], '感恩': [35, 75], '热爱劳动': [40, 85], '团队合作': [40, 80]
  }
  return ranges[moodType] || [30, 70]
}

/**
 * 随机整数 [min, max]
 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 从数组随机取一个元素
 */
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 补齐两位
 */
function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

/**
 * 主入口：生成 2026/07/01 ~ 2026/08/05 的模拟情绪数据
 * @returns {Array} 情绪记录数组
 */
function generateMockRecords() {
  var records = []
  var idSeq = 0

  var startDate = new Date(2026, 6, 1)   // 7月1日
  var endDate = new Date(2026, 7, 5, 23, 59)  // 8月5日

  var cur = new Date(startDate)

  while (cur <= endDate) {
    // 每天 1~3 条记录
    var countPerDay = randInt(1, 3)

    for (var i = 0; i < countPerDay; i++) {
      var hour = randInt(7, 23)
      var minute = randInt(0, 59)
      var ts = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), hour, minute)

      // 加权随机情绪：正向 40% / 中性 30% / 负向 30%
      var roll = Math.random()
      var moodType
      if (roll < 0.4) {
        moodType = randPick(['平和放松', '超开心', '充满干劲', '认真专注'])
      } else if (roll < 0.7) {
        moodType = randPick(['偷偷小得意', '感恩', '热爱劳动', '团队合作'])
      } else {
        moodType = randPick(['想歇一会', '有点沮丧', '有点迷糊', '烦躁生气'])
      }

      var range = energyRange(moodType)
      var energy = randInt(range[0], range[1])
      var level = getScoreLevel(energy)
      var fallback = MOOD_FALLBACK[moodType]
      var eventText = randPick(EVENT_POOLS[moodType] || ['日常记录'])

      var timeStr = cur.getFullYear() + '.' +
        pad(cur.getMonth() + 1) + '.' + pad(cur.getDate()) + '.' +
        pad(hour) + ':' + pad(minute)

      records.push({
        id: 'mood_mock_' + (idSeq++),
        time: timeStr,
        timestamp: ts.getTime(),
        moodEnergy: energy,
        currentMoodType: moodType,
        emotionCategory: EMOTION_CATEGORY[moodType] || 'neutral',
        eventText: eventText,
        moodNote: fallback.moodNote,
        moodTip: fallback.moodTip,
        scoreLevel: level,
        hidden: false
      })
    }

    // 下一天
    cur.setDate(cur.getDate() + 1)
  }

  // 按时间倒序排列
  records.sort(function (a, b) { return b.timestamp - a.timestamp })

  return records
}

/**
 * 注入模拟数据到本地存储（替换旧数据，清理日历旧 mock 残留）
 */
function injectMockData() {
  var oldRecords = wx.getStorageSync('moodRecords') || []

  // 检测是否有旧日历 mock 残留 (mood_month_mock_ / mood_year_mock_)
  var hasStaleMock = oldRecords.some(function (r) {
    return r.id && (r.id.indexOf('mood_month_mock_') === 0 || r.id.indexOf('mood_year_mock_') === 0)
  })

  if (hasStaleMock) {
    // 清理旧日历注入数据，重新生成
    var newRecords = generateMockRecords()
    wx.setStorageSync('moodRecords', newRecords)
    console.log('[mockGenerator] 检测到旧日历mock残留，已清理并重新注入', newRecords.length, '条')
    return
  }

  var hasMock = oldRecords.some(function (r) {
    return r.id && r.id.indexOf('mood_mock_') === 0
  })

  // 已有 mock 数据则跳过，避免每次启动重复生成
  if (hasMock) {
    console.log('[mockGenerator] 模拟数据已存在，跳过注入，共', oldRecords.length, '条')
    return
  }

  var newRecords = generateMockRecords()
  wx.setStorageSync('moodRecords', newRecords)

  console.log('[mockGenerator] 已注入 ' + newRecords.length + ' 条模拟情绪记录 (2026/07/01~08/05)')
  console.log('[mockGenerator] 旧数据已清除')
}

module.exports = {
  generateMockRecords: generateMockRecords,
  injectMockData: injectMockData
}
