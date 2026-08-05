// ============================================
//  moodCalendar - 心情日历页
//  当前阶段：纯静态 UI，暂不接入数据/交互
//  ============================================

Page({

  data: {
    // 顶部日期展示 & 日历标题（动态，由第一条记录决定）
    topDate: '',
    calendarMonthText: '',
    chartTitleText: '',          // 轨迹图标题，月/年模式自适应

    // 31 天假数据数组
    days: [
       1,  2,  3,  4,  5,  6,  7,
       8,  9, 10, 11, 12, 13, 14,
      15, 16, 17, 18, 19, 20, 21,
      22, 23, 24, 25, 26, 27, 28,
      29, 30, 31
    ],

    /* ---- 星猫心情小发现弹窗 ---- */
    showReport: false,          // 是否展示报告弹窗
    reportFeedback: '',         // '' | 'agree' | 'disagree'

    // 报告假数据（二期接入真实数据）
    reportHappy: 55,
    reportCalm: 30,
    reportAngry: 15,
    reportInsight: '你的情绪色彩非常丰富，最近7天你更多地保持开心和平和的状态。继续保持积极的情绪，相信每一天都会更好！',
    reportColors: [
      '#EDDEFF','#DEC7FA','#CCB2F5','#C7A6F2','#E0CCFF',
      '#D1B8F0','#BD94E8','#7C3AED','#A78BFA','#6D28D9'
    ],

    // ====== 情绪轨迹图数据 ======
    timeRange: 'month',       // month | year
    selectedDay: 1,
    chartYear: 2026,
    chartMonth: 8,
    yLabels: ['100', '80', '60', '40', '20', '0'],
    xLabels: ['1', '5', '10', '15', '20', '25', '30'],
    // 水平虚线：对齐 Y 轴标签 80/60/40/20 (618÷5=123.6 rpx/格)
    dashLinesH: [124, 247, 371, 494],
    // 垂直虚线 (618÷6=103 rpx/格)
    dashLinesV: [103, 206, 309, 412, 515],
    // 日期区间进度条 (天数→百分比映射: day→(day-1)/30*100%)
    progressStart: '04',
    progressEnd: '15',
    progressLeft: 10,         // day 04 → (4-1)/30*100 = 10%
    progressWidth: 36.67,    // day 04~15 → 11天 → 11/30*100 ≈ 36.67%
    pillStartLeft: 44,       // 10%*598rpx - 16(半胶囊宽) ≈ 44rpx
    pillEndLeft: 263,        // 46.67%*598rpx - 16 ≈ 263rpx
    pbStartDay: 4,           // 进度条区间起始日期 (数值)
    pbEndDay: 15,            // 进度条区间结束日期 (数值)
    moodLegend: [
      [
        { text: '平和放松', icon: '/assets/CodeBuddyAssets/1142_422/3.svg' },
        { text: '愉悦开心', icon: '/assets/CodeBuddyAssets/1142_422/4.svg' },
        { text: '活力充沛', icon: '/assets/CodeBuddyAssets/1142_422/5.svg' },
        { text: '专注沉浸', icon: '/assets/CodeBuddyAssets/1142_422/6.svg' }
      ],
      [
        { text: '疲惫倦怠', icon: '/assets/CodeBuddyAssets/1142_422/7.svg' },
        { text: '低落忧郁', icon: '/assets/CodeBuddyAssets/1142_422/8.svg' },
        { text: '犹豫不决', icon: '/assets/CodeBuddyAssets/1142_422/9.svg' },
        { text: '烦躁挫败', icon: '/assets/CodeBuddyAssets/1142_422/10.svg' }
      ],
      [
        { text: '接纳', icon: '/assets/CodeBuddyAssets/1142_422/11.svg' },
        { text: '观望', icon: '/assets/CodeBuddyAssets/1142_422/12.svg' },
        { text: '放空', icon: '/assets/CodeBuddyAssets/1142_422/13.svg' },
        { text: '无聊', icon: '/assets/CodeBuddyAssets/1142_422/14.svg' }
      ]
    ],

    // Canvas 散点图相关
    scatterDots: [],          // 当前渲染的散点数据
    showDotTooltip: false,    // 是否显示散点详情浮层
    tooltipX: 0,
    tooltipY: 0,
    tooltipRecord: null       // 当前选中的命中记录
  },

  /* ====== 生命周期 ====== */
  onLoad() {
    // 以用户最新一条心情记录的日期作为日历起始日；无记录则取今天
    var records = wx.getStorageSync('moodRecords') || []
    var y, m, day

    if (records.length > 0) {
      var latest = records[records.length - 1]
      var dateStr = ''
      if (latest.time && typeof latest.time === 'string') {
        dateStr = latest.time
      } else if (latest.timestamp) {
        var d = new Date(latest.timestamp)
        dateStr = d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate()
      }
      if (dateStr) {
        var parts = dateStr.split('.')
        y = parseInt(parts[0], 10)
        m = parseInt(parts[1], 10)
        day = parseInt(parts[2], 10)
      }
    }

    // 降级：取今天
    if (!y || !m || !day) {
      var today = new Date()
      y = today.getFullYear()
      m = today.getMonth() + 1
      day = today.getDate()
    }

    var dd = day < 10 ? '0' + day : '' + day
    this.setData({
      chartYear: y,
      chartMonth: m,
      selectedDay: day,
      topDate: y + '年' + m + '月' + dd + '日',
      calendarMonthText: y + '年 ' + m + '月',
      chartTitleText: y + '年 ' + m + '月'
    })

    // 调试期：为当前选中的日期自动注入模拟数据
    this._injectMockData()
  },

  /**
   * 月模式：注入跨天模拟记录 (2~30号每4天一条)，确保月视图有可散布的数据
   */
  _ensureMonthMockData() {
    var records = wx.getStorageSync('moodRecords') || []
    var y = this.data.chartYear
    var m = this.data.chartMonth
    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    var monthPrefix = y + '.' + pad(m) + '.'

    var hasMonthData = records.some(function (r) {
      return r.time && r.time.indexOf(monthPrefix) === 0
    })
    if (hasMonthData) return

    var addEmotionCat = {
      '平和放松': 'positive', '超开心': 'positive', '充满干劲': 'positive', '认真专注': 'positive',
      '想歇一会': 'negative', '有点沮丧': 'negative', '有点迷糊': 'negative', '烦躁生气': 'negative',
      '偷偷小得意': 'neutral', '感恩': 'neutral', '热爱劳动': 'neutral', '团队合作': 'neutral'
    }

    var dayMocks = [
      { day: 2,  mood: '平和放松',   energy: 42, hour: 10, min: 30, event: '安静的一天开始',   shareText: '今天稳稳的',      shareTip: '平静是最有力量的状态' },
      { day: 4,  mood: '热爱劳动',   energy: 72, hour: 14, min: 0,  event: '今天干了好多事',    shareText: '劳模附体！',      shareTip: '努力这件事，从来不会被辜负' },
      { day: 4,  mood: '偷偷小得意', energy: 55, hour: 17, min: 45, event: '顺利完成一件事',    shareText: '这波操作稳了！',     shareTip: '稳住，你能赢' },
      { day: 8,  mood: '专注沉浸',   energy: 65, hour: 15, min: 10, event: '认真完成工作',      shareText: '沉浸式专注',      shareTip: '专注本身就是奖励' },
      { day: 12, mood: '愉悦开心',   energy: 78, hour: 16, min: 20, event: '被温柔稳稳接住了',  shareText: '被世界温柔以待',  shareTip: '感恩不是示弱，是你看见了光' },
      { day: 16, mood: '平和放松',   energy: 38, hour: 18, min: 30, event: '舒适地看着夕阳',    shareText: '有点松弛感在的',  shareTip: '松弛不是懒，是你允许自己慢下来' },
      { day: 20, mood: '想歇一会',   energy: 48, hour: 13, min: 0,  event: '有点累了',          shareText: '歇一歇',          shareTip: '累了就停一停，不需要理由' },
      { day: 24, mood: '愉悦开心',   energy: 85, hour: 9,  min: 0,  event: '美好的一天开始了',  shareText: '今天元气满满！',   shareTip: '每一个早晨都是全新的开始' },
      { day: 28, mood: '平和放松',   energy: 44, hour: 20, min: 30, event: '安静地结束这一天',  shareText: '晚安世界',        shareTip: '今天已经足够好了' },
      { day: 30, mood: '感恩',       energy: 62, hour: 17, min: 0,  event: '回顾这个月',        shareText: '这个月不赖',      shareTip: '你比上个月又成长了一点点' }
    ]

    dayMocks.forEach(function (item, idx) {
      var timeStr = monthPrefix + pad(item.day) + '.' + pad(item.hour) + ':' + pad(item.min)
      var ts = new Date(y, m - 1, item.day, item.hour, item.min).getTime()
      var level = item.energy >= 60 ? 'high' : item.energy >= 30 ? 'medium' : 'low'

      records.push({
        id: 'mood_month_mock_' + idx,
        time: timeStr,
        timestamp: ts,
        moodEnergy: item.energy,
        currentMoodType: item.mood,
        emotionCategory: addEmotionCat[item.mood] || 'neutral',
        eventText: item.event,
        shareText: item.shareText,
        shareTip: item.shareTip,
        scoreLevel: level,
        hidden: false
      })
    })

    wx.setStorageSync('moodRecords', records)
    console.log('[_ensureMonthMockData] 已注入', dayMocks.length, '条跨天记录到', monthPrefix)
  },

  /**
   * 年模式：注入12个月跨月模拟记录，确保年视图有可散布的数据
   */
  _ensureYearMockData() {
    var records = wx.getStorageSync('moodRecords') || []
    var y = this.data.chartYear
    var pad = function (n) { return n < 10 ? '0' + n : '' + n }

    // 已有年 mock 数据则跳过
    var hasMock = records.some(function (r) { return r.id && r.id.indexOf('mood_year_mock_') === 0 })
    if (hasMock) return

    var addEmotionCat = {
      '平和放松': 'positive', '超开心': 'positive', '充满干劲': 'positive', '认真专注': 'positive',
      '想歇一会': 'negative', '有点沮丧': 'negative', '有点迷糊': 'negative', '烦躁生气': 'negative',
      '偷偷小得意': 'neutral', '感恩': 'neutral', '热爱劳动': 'neutral', '团队合作': 'neutral'
    }

    var monthMocks = [
      { m: 1,  mood: '平和放松',   energy: 42, event: '新年伊始',          shareText: '新的一年',      shareTip: '每一天都值得被记住' },
      { m: 2,  mood: '愉悦开心',   energy: 68, event: '春暖花开',          shareText: '温暖治愈',      shareTip: '你值得所有的美好' },
      { m: 3,  mood: '充满干劲',   energy: 75, event: '干劲满满的春天',    shareText: '活力来袭',      shareTip: '行动是治愈焦虑的良药' },
      { m: 4,  mood: '专注沉浸',   energy: 55, event: '静心工作的一个月',  shareText: '专注力MAX',     shareTip: '专注本身就是奖励' },
      { m: 5,  mood: '热爱劳动',   energy: 72, event: '充实忙碌的五月',    shareText: '劳模附体',      shareTip: '努力从来不会被辜负' },
      { m: 6,  mood: '偷偷小得意', energy: 60, event: '半年小结有收获',    shareText: '小得意一下',    shareTip: '你已经做得很好了' },
      { m: 7,  mood: '愉悦开心',   energy: 80, event: '盛夏好时光',        shareText: '夏天真美好',    shareTip: '快乐是可以传染的' },
      { m: 8,  mood: '想歇一会',   energy: 38, event: '酷暑有点累',        shareText: '休息一下',      shareTip: '累了就停一停' },
      { m: 9,  mood: '平和放松',   energy: 48, event: '金秋渐凉',          shareText: '秋高气爽',      shareTip: '松弛不是懒，是允许自己慢下来' },
      { m: 10, mood: '感恩',       energy: 55, event: '感恩收获的季节',    shareText: '心怀感恩',      shareTip: '感恩让你看见更多的光' },
      { m: 11, mood: '专注沉浸',   energy: 62, event: '年末冲刺',          shareText: '全力以赴',      shareTip: '坚持到最后就是胜利' },
      { m: 12, mood: '平和放松',   energy: 45, event: '年末回顾',          shareText: '这一年辛苦了',  shareTip: '你比一年前又成长了很多' }
    ]

    monthMocks.forEach(function (item, idx) {
      var timeStr = y + '.' + pad(item.m) + '.15.12:00'
      var ts = new Date(y, item.m - 1, 15, 12, 0).getTime()
      var level = item.energy >= 60 ? 'high' : item.energy >= 30 ? 'medium' : 'low'

      records.push({
        id: 'mood_year_mock_' + idx,
        time: timeStr,
        timestamp: ts,
        moodEnergy: item.energy,
        currentMoodType: item.mood,
        emotionCategory: addEmotionCat[item.mood] || 'neutral',
        eventText: item.event,
        shareText: item.shareText,
        shareTip: item.shareTip,
        scoreLevel: level,
        hidden: false
      })
    })

    wx.setStorageSync('moodRecords', records)
    console.log('[_ensureYearMockData] 已注入', monthMocks.length, '条跨月记录到', y)
  },

  /**
   * 为当前选中的日期注入6条模拟记录，结构和 moodAdd 完全一致
   */
  _injectMockData() {
    var records = wx.getStorageSync('moodRecords') || []
    var y = this.data.chartYear
    var m = this.data.chartMonth
    var d = this.data.selectedDay
    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    var datePrefix = y + '.' + pad(m) + '.' + pad(d)

    var hasData = records.some(function (r) {
      return r.time && r.time.indexOf(datePrefix + '.') === 0
    })
    if (hasData) return  // 该日期已有记录，跳过

    var addEmotionCat = {
      '平和放松': 'positive', '超开心': 'positive', '充满干劲': 'positive', '认真专注': 'positive',
      '想歇一会': 'negative', '有点沮丧': 'negative', '有点迷糊': 'negative', '烦躁生气': 'negative',
      '偷偷小得意': 'neutral', '感恩': 'neutral', '热爱劳动': 'neutral', '团队合作': 'neutral'
    }

    var mockList = [
      { mood: '热爱劳动', energy: 69, hour: 9,  min: 30, event: '沉浸忙碌，格外充实', shareText: '今天劳模附体！', shareTip: '努力这件事，从来不会被辜负。' },
      { mood: '热爱劳动', energy: 41, hour: 11, min: 0,  event: '流汗之后很踏实',   shareText: '干就完了！',     shareTip: '先开始，再完美。' },
      { mood: '平和放松', energy: 39, hour: 13, min: 20, event: '挺舒服的',         shareText: '有点松弛感在的',  shareTip: '松弛不是懒，是你允许自己慢下来。' },
      { mood: '感恩',     energy: 55, hour: 15, min: 45, event: '被温柔稳稳接住了', shareText: '被世界温柔以待',  shareTip: '感恩不是示弱，是你看见了光。' },
      { mood: '偷偷小得意', energy: 66, hour: 17, min: 10, event: '包的！太对了！', shareText: '这波操作稳了！',  shareTip: '稳住，你能赢。' },
      { mood: '偷偷小得意', energy: 67, hour: 19, min: 30, event: '包的！太对了！', shareText: '这波操作稳了！',  shareTip: '稳住，你能赢。' }
    ]

    var self = this
    mockList.forEach(function (item, idx) {
      var timeStr = datePrefix + '.' + pad(item.hour) + ':' + pad(item.min)
      var ts = new Date(y, m - 1, d, item.hour, item.min).getTime()
      var level = item.energy >= 60 ? 'high' : item.energy >= 30 ? 'medium' : 'low'

      records.push({
        id: 'mood_mock_' + datePrefix + '_' + idx,
        time: timeStr,
        timestamp: ts,
        moodEnergy: item.energy,
        currentMoodType: item.mood,
        emotionCategory: addEmotionCat[item.mood] || 'neutral',
        eventText: item.event,
        shareText: item.shareText,
        shareTip: item.shareTip,
        scoreLevel: level,
        hidden: false
      })
    })

    wx.setStorageSync('moodRecords', records)
    console.log('[_injectMockData] 已注入', mockList.length, '条记录到', datePrefix)
  },

  onReady() {
    // canvas 节点就绪后首次绘制散点图
    var self = this
    setTimeout(function () { self.drawScatterPlot() }, 100)
  },

  onShow() {
    // 查看日历加分
    const app = getApp()
    app.addGrowScore('view_calendar')
    // 刷新散点图（内部会自动注入当前日期模拟数据）
    this.drawScatterPlot()
  },

  /* ====== 月份切换 ====== */
  onPrevMonth() {
    var _d = this.data
    var y = _d.chartYear, m = _d.chartMonth
    if (m === 1) { m = 12; y -= 1 } else { m -= 1 }
    this.setData({
      chartYear: y, chartMonth: m,
      calendarMonthText: y + '年 ' + m + '月'
    })
    this.drawScatterPlot()
  },

  onNextMonth() {
    var _d = this.data
    var y = _d.chartYear, m = _d.chartMonth
    if (m === 12) { m = 1; y += 1 } else { m += 1 }
    this.setData({
      chartYear: y, chartMonth: m,
      calendarMonthText: y + '年 ' + m + '月'
    })
    this.drawScatterPlot()
  },

  /* ====== 日期点击 ====== */
  onDayTap(e) {
    var day = e.currentTarget.dataset.day
    var _a = this.data, y = _a.chartYear, m = _a.chartMonth
    var dd = day < 10 ? '0' + day : '' + day
    this.setData({
      selectedDay: day,
      timeRange: 'day',
      topDate: y + '年' + m + '月' + dd + '日',
      xLabels: ['0', '4', '8', '12', '16', '20', '24']
    })
    this.drawScatterPlot()
  },

  /* ================================================================
     情绪轨迹图 - 时间范围切换
     ================================================================ */
  onTimeRangeTap(e) {
    const range = e.currentTarget.dataset.range
    var _a = this.data, chartYear = _a.chartYear, chartMonth = _a.chartMonth
    if (range === 'month') {
      this.setData({
        timeRange: range,
        xLabels: ['1', '5', '10', '15', '20', '25', '30'],
        chartTitleText: chartYear + '年 ' + chartMonth + '月'
      })
      this._pbApplyRange(4, 15)
    } else if (range === 'year') {
      this.setData({
        timeRange: range,
        xLabels: ['1月', '3月', '5月', '7月', '9月', '11月', '12月'],
        chartTitleText: chartYear + '年'
      })
      this._pbApplyRange(3, 8)
    }
    this.drawScatterPlot()
  },

  /* ================================================================
     情绪轨迹图 - 月/年切换（根据 timeRange 自适应）
     ================================================================ */
  onChartPrevMonth() {
    let { chartYear, chartMonth, timeRange } = this.data
    var titleText
    if (timeRange === 'year') {
      chartYear -= 1
      titleText = chartYear + '年'
    } else {
      if (chartMonth === 1) { chartMonth = 12; chartYear -= 1 } else { chartMonth -= 1 }
      titleText = chartYear + '年 ' + chartMonth + '月'
    }
    this.setData({
      chartYear, chartMonth,
      chartTitleText: titleText
    })
    this.drawScatterPlot()
  },

  onChartNextMonth() {
    let { chartYear, chartMonth, timeRange } = this.data
    var titleText
    if (timeRange === 'year') {
      chartYear += 1
      titleText = chartYear + '年'
    } else {
      if (chartMonth === 12) { chartMonth = 1; chartYear += 1 } else { chartMonth += 1 }
      titleText = chartYear + '年 ' + chartMonth + '月'
    }
    this.setData({
      chartYear, chartMonth,
      chartTitleText: titleText
    })
    this.drawScatterPlot()
  },

  /* =================================================================
     [心情小发现] 按钮 → 打开星猫心情小发现弹窗
     ================================================================= */
  onReportTap() {
    this.setData({ showReport: true, reportFeedback: '' })
    getApp().addGrowScore('view_discover')
  },

  /* =================================================================
     关闭报告弹窗
     ================================================================= */
  onCloseReport() {
    this.setData({ showReport: false })
  },

  /* =================================================================
     用户反馈：同意
     ================================================================= */
  onReportAgree() {
    const current = this.data.reportFeedback
    this.setData({
      reportFeedback: current === 'agree' ? '' : 'agree'
    })
    // 二期：上报反馈数据到服务端
  },

  /* =================================================================
     用户反馈：不同意
     ================================================================= */
  onReportDisagree() {
    const current = this.data.reportFeedback
    this.setData({
      reportFeedback: current === 'disagree' ? '' : 'disagree'
    })
    // 二期：上报反馈数据到服务端
  },

  /* ====== Tab 切换 ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd'
        break
      case 'moodLib':
        url = '/pages/moodLib/moodLib'
        break
      case 'starTalk':
        url = '/pages/catCare/catCare'
        break
      case 'people':
        url = '/pages/youMeOther/youMeOther'
        break
    }
    if (url) {
      wx.redirectTo({ url })
    }
  },

  /* ================================================================
     Canvas 散点图 —— 核心渲染
     ================================================================ */

  // ---- 情绪色彩映射 (Figma 设计稿圆点色值) ----
  EMOTION_COLORS: {
    '平和放松': '#37C08C',
    '愉悦开心': '#FBA85F',
    '活力充沛': '#98CCFF',
    '专注沉浸': '#76BBF8',
    '疲惫倦怠': '#B38CE6',
    '低落忧郁': '#965ED7',
    '犹豫不决': '#918BDC',
    '烦躁挫败': '#FFCC00',
    '接纳': '#AC7F5E',
    '观望': '#DBD096',
    '放空': '#D2CAA5',
    '无聊': '#C89600'
  },

  // ---- moodAdd 情绪名 → 图表12情绪名 ----
  MOOD_TYPE_MAP: {
    '平和放松': '平和放松',
    '超开心': '愉悦开心',
    '充满干劲': '活力充沛',
    '认真专注': '专注沉浸',
    '想歇一会': '疲惫倦怠',
    '有点沮丧': '低落忧郁',
    '有点迷糊': '犹豫不决',
    '烦躁生气': '烦躁挫败',
    '偷偷小得意': '接纳',
    '感恩': '观望',
    '热爱劳动': '放空',
    '团队合作': '无聊'
  },

  // ---- 情绪分类 ----
  EMOTION_CATEGORY: {
    '平和放松': 'positive', '愉悦开心': 'positive', '活力充沛': 'positive', '专注沉浸': 'positive',
    '疲惫倦怠': 'negative', '低落忧郁': 'negative', '犹豫不决': 'negative', '烦躁挫败': 'negative',
    '接纳': 'neutral', '观望': 'neutral', '放空': 'neutral', '无聊': 'neutral'
  },

  /**
   * 月模式：按 chartYear + chartMonth 拉整月所有记录
   * 提取 day → xRatio = (day-1)/30，供 _drawGlowDot 映射 X 轴
   */
  _getMonthRecords() {
    var records = wx.getStorageSync('moodRecords') || []
    var _a = this.data, chartYear = _a.chartYear, chartMonth = _a.chartMonth

    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    var monthPrefix = chartYear + '.' + pad(chartMonth) + '.'

    var MOOD_TYPE_MAP = {
      '平和放松': '平和放松', '超开心': '愉悦开心', '充满干劲': '活力充沛', '认真专注': '专注沉浸',
      '想歇一会': '疲惫倦怠', '有点沮丧': '低落忧郁', '有点迷糊': '犹豫不决', '烦躁生气': '烦躁挫败',
      '偷偷小得意': '接纳', '感恩': '观望', '热爱劳动': '放空', '团队合作': '无聊'
    }
    var EMOTION_COLORS = {
      '平和放松': '#37C08C', '愉悦开心': '#FBA85F', '活力充沛': '#98CCFF', '专注沉浸': '#76BBF8',
      '疲惫倦怠': '#B38CE6', '低落忧郁': '#965ED7', '犹豫不决': '#918BDC', '烦躁挫败': '#FFCC00',
      '接纳': '#AC7F5E', '观望': '#DBD096', '放空': '#D2CAA5', '无聊': '#C89600'
    }

    var monthRecords = records.filter(function (r) {
      if (!r || r.hidden) return false
      if (r.time && typeof r.time === 'string') {
        return r.time.indexOf(monthPrefix) === 0
      }
      if (r.timestamp) {
        var d = new Date(r.timestamp)
        return d.getFullYear() === chartYear && (d.getMonth() + 1) === chartMonth
      }
      return false
    })

    var dots = monthRecords.map(function (r) {
      var day = 1
      var hour = 12
      if (r.time && typeof r.time === 'string') {
        var parts = r.time.split('.')
        if (parts.length >= 3) day = parseInt(parts[2], 10) || 1
        if (parts.length >= 4) hour = parseInt(parts[3], 10) || 12
      } else if (r.timestamp) {
        var d2 = new Date(r.timestamp)
        day = d2.getDate()
        hour = d2.getHours()
      }

      var rawMood = r.currentMoodType || r.moodTag || ''
      var emotion = MOOD_TYPE_MAP[rawMood] || '平和放松'
      var color = EMOTION_COLORS[emotion] || '#37C08C'

      return {
        day: day,
        hour: hour,
        energy: r.moodEnergy != null ? r.moodEnergy : 50,
        emotion: emotion,
        color: color,
        xRatio: (day - 1) / 30,
        record: r
      }
    })

    // 按进度条区间 [pbStartDay, pbEndDay] 过滤
    var startDay = this.data.pbStartDay
    var endDay = this.data.pbEndDay
    if (startDay != null && endDay != null) {
      dots = dots.filter(function (dot) {
        return dot.day >= startDay && dot.day <= endDay
      })
    }

    return dots
  },

  /**
   * 年模式：按 chartYear 拉整年所有记录
   * 提取 month → xRatio = (month-1)/11，供 _drawGlowDot 映射 X 轴
   */
  _getYearRecords() {
    var records = wx.getStorageSync('moodRecords') || []
    var chartYear = this.data.chartYear

    var MOOD_TYPE_MAP = {
      '平和放松': '平和放松', '超开心': '愉悦开心', '充满干劲': '活力充沛', '认真专注': '专注沉浸',
      '想歇一会': '疲惫倦怠', '有点沮丧': '低落忧郁', '有点迷糊': '犹豫不决', '烦躁生气': '烦躁挫败',
      '偷偷小得意': '接纳', '感恩': '观望', '热爱劳动': '放空', '团队合作': '无聊'
    }
    var EMOTION_COLORS = {
      '平和放松': '#37C08C', '愉悦开心': '#FBA85F', '活力充沛': '#98CCFF', '专注沉浸': '#76BBF8',
      '疲惫倦怠': '#B38CE6', '低落忧郁': '#965ED7', '犹豫不决': '#918BDC', '烦躁挫败': '#FFCC00',
      '接纳': '#AC7F5E', '观望': '#DBD096', '放空': '#D2CAA5', '无聊': '#C89600'
    }

    var yearRecords = records.filter(function (r) {
      if (!r || r.hidden) return false
      if (r.time && typeof r.time === 'string') {
        var parts = r.time.split('.')
        return parts.length >= 1 && parseInt(parts[0], 10) === chartYear
      }
      if (r.timestamp) {
        return new Date(r.timestamp).getFullYear() === chartYear
      }
      return false
    })

    var dots = yearRecords.map(function (r) {
      var month = 1
      var day = 1
      if (r.time && typeof r.time === 'string') {
        var parts = r.time.split('.')
        if (parts.length >= 2) month = parseInt(parts[1], 10) || 1
        if (parts.length >= 3) day = parseInt(parts[2], 10) || 1
      } else if (r.timestamp) {
        var d2 = new Date(r.timestamp)
        month = d2.getMonth() + 1
        day = d2.getDate()
      }

      var rawMood = r.currentMoodType || r.moodTag || ''
      var emotion = MOOD_TYPE_MAP[rawMood] || '平和放松'
      var color = EMOTION_COLORS[emotion] || '#37C08C'

      return {
        month: month,
        day: day,
        energy: r.moodEnergy != null ? r.moodEnergy : 50,
        emotion: emotion,
        color: color,
        xRatio: (month - 1) / 11,
        record: r
      }
    })

    // 按进度条区间 [pbStartDay, pbEndDay] 过滤（年模式下表示月份区间）
    var startMonth = this.data.pbStartDay
    var endMonth = this.data.pbEndDay
    if (startMonth != null && endMonth != null) {
      dots = dots.filter(function (dot) {
        return dot.month >= startMonth && dot.month <= endMonth
      })
    }

    return dots
  },

  /**
   * 从本地存储获取当前选中日期的火苗记录
   * @returns {Array<{hour:number, energy:number, emotion:string, color:string, record:object}>}
   */
  _getDayRecords() {
    var records = wx.getStorageSync('moodRecords') || []
    var _a = this.data, chartYear = _a.chartYear, chartMonth = _a.chartMonth, selectedDay = _a.selectedDay

    var pad = function (n) { return n < 10 ? '0' + n : '' + n }
    var datePrefix = chartYear + '.' + pad(chartMonth) + '.' + pad(selectedDay)

    // 内联常量，避免 this 上下文问题
    var MOOD_TYPE_MAP = {
      '平和放松': '平和放松',
      '超开心': '愉悦开心',
      '充满干劲': '活力充沛',
      '认真专注': '专注沉浸',
      '想歇一会': '疲惫倦怠',
      '有点沮丧': '低落忧郁',
      '有点迷糊': '犹豫不决',
      '烦躁生气': '烦躁挫败',
      '偷偷小得意': '接纳',
      '感恩': '观望',
      '热爱劳动': '放空',
      '团队合作': '无聊'
    }
    var EMOTION_COLORS = {
      '平和放松': '#37C08C',
      '愉悦开心': '#FBA85F',
      '活力充沛': '#98CCFF',
      '专注沉浸': '#76BBF8',
      '疲惫倦怠': '#B38CE6',
      '低落忧郁': '#965ED7',
      '犹豫不决': '#918BDC',
      '烦躁挫败': '#FFCC00',
      '接纳': '#AC7F5E',
      '观望': '#DBD096',
      '放空': '#D2CAA5',
      '无聊': '#C89600'
    }

    var dayRecords = records.filter(function (r) {
      if (!r || r.hidden) return false
      if (r.time && typeof r.time === 'string') {
        return r.time.indexOf(datePrefix + '.') === 0
      }
      if (r.timestamp) {
        var d = new Date(r.timestamp)
        return d.getFullYear() === chartYear &&
               (d.getMonth() + 1) === chartMonth &&
               d.getDate() === selectedDay
      }
      return false
    })

    return dayRecords.map(function (r) {
      var hour = 12
      if (r.time && typeof r.time === 'string') {
        var parts = r.time.split('.')
        if (parts.length >= 4) hour = parseInt(parts[3], 10) || 12
      } else if (r.timestamp) {
        hour = new Date(r.timestamp).getHours()
      }

      var rawMood = r.currentMoodType || r.moodTag || ''
      var emotion = MOOD_TYPE_MAP[rawMood] || '平和放松'
      var color = EMOTION_COLORS[emotion] || '#37C08C'

      return {
        hour: hour,
        energy: r.moodEnergy != null ? r.moodEnergy : 50,
        emotion: emotion,
        color: color,
        record: r
      }
    })
  },

  /**
   * 绘制散点图 (入口)
   */
  drawScatterPlot() {
    var self = this
    var timeRange = this.data.timeRange

    // 关闭可能存在的浮层
    if (this.data.showDotTooltip) {
      this.setData({ showDotTooltip: false })
    }

    // 数据获取：月/日/年三路分支
    var dots
    if (timeRange === 'month' || timeRange === 'year') {
      if (timeRange === 'month') {
        this._ensureMonthMockData()
        dots = this._getMonthRecords()
      } else {
        this._ensureYearMockData()
        dots = this._getYearRecords()
      }
      this._scatterMode = timeRange
    } else {
      // day 或其它 → 日视图 24h
      this._injectMockData()
      dots = this._getDayRecords()
      this._scatterMode = 'day'
    }
    this.scatterDots = dots
    console.log('[drawScatterPlot] timeRange:', timeRange, ' dots count:', dots.length)

    var retry = (self._canvasRetryCount || 0) + 1
    self._canvasRetryCount = retry

    var query = wx.createSelectorQuery().in(this)
    query.select('#scatterCanvas')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          if (retry <= 10) {
            console.log('[drawScatterPlot] canvas 节点未就绪，重试第', retry, '次...')
            setTimeout(function () { self._canvasRetryCount = 0; self.drawScatterPlot() }, 300)
          } else {
            console.error('[drawScatterPlot] canvas 重试已达上限(', retry, '次)，放弃绘制')
          }
          return
        }
        self._canvasRetryCount = 0

        var canvas = res[0].node
        var ctx = canvas.getContext('2d')
        var cw = res[0].width
        var ch = res[0].height
        var dpr = wx.getSystemInfoSync().pixelRatio

        console.log('[drawScatterPlot] canvas size:', cw, 'x', ch, 'dpr:', dpr)

        canvas.width = cw * dpr
        canvas.height = ch * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, cw, ch)

        // 存储逻辑画布尺寸，供触摸命中检测使用
        self._canvasW = cw
        self._canvasH = ch

        if (dots.length === 0) {
          console.log('[drawScatterPlot] 无数据，跳过绘制')
          return
        }

        // 排序：大圆点先绘，小圆点后绘 (在上层)，方便触控优先命中
        var sorted = dots.slice().sort(function (a, b) {
          return b.energy - a.energy
        })

        // 存储排序后的绘制数据供触摸检测
        self._sortedDots = sorted
        console.log('[drawScatterPlot] 开始绘制', sorted.length, '个圆点, mode:', self._scatterMode)

        for (var i = 0; i < sorted.length; i++) {
          self._drawGlowDot(ctx, sorted[i], cw, ch, self._scatterMode)
        }
      })
  },

  /**
   * 绘制单个发光圆点
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} dot  日: {hour, energy, color}  月/年: {xRatio, energy, color}
   * @param {number} cw   画布逻辑宽度
   * @param {number} ch   画布逻辑高度
   * @param {string} mode 'day' | 'month' | 'year'
   */
  _drawGlowDot(ctx, dot, cw, ch, mode) {
    var energy = dot.energy, color = dot.color

    // ---- 坐标映射：日→hour/24, 月→xRatio=(day-1)/30 ----
    var x
    if (dot.xRatio != null) {
      x = dot.xRatio * cw
    } else {
      x = (dot.hour / 24) * cw
    }
    var y = (1 - energy / 100) * ch   // 0→底部, 100→顶部

    // ---- 半径：日 8-22px, 月/年 4-12px ----
    var oversized = mode === 'month' || mode === 'year'
    var minR = oversized ? 4 : 8
    var maxR = oversized ? 12 : 22
    var r = minR + (energy / 100) * (maxR - minR)

    // ---- 边界保护 ----
    x = Math.max(r, Math.min(cw - r, x))
    y = Math.max(r, Math.min(ch - r, y))

    // 回写实际绘制坐标
    dot._x = x
    dot._y = y
    dot._r = r

    // 内联 hex → rgba 工具
    var hexToRgba = function (hex, alpha) {
      var rv = parseInt(hex.slice(1, 3), 16)
      var gv = parseInt(hex.slice(3, 5), 16)
      var bv = parseInt(hex.slice(5, 7), 16)
      return 'rgba(' + rv + ',' + gv + ',' + bv + ',' + alpha + ')'
    }

    ctx.save()

    // ---- 柔和外发光 ----
    ctx.shadowBlur = r * 1.5
    ctx.shadowColor = hexToRgba(color, 0.35)

    // ---- 径向渐变营造光球立体感 ----
    var grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r)
    grad.addColorStop(0, hexToRgba(color, 0.65))
    grad.addColorStop(0.45, hexToRgba(color, 0.45))
    grad.addColorStop(1, hexToRgba(color, 0.2))

    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = grad
    ctx.fill()

    // 补一层半透明纯色让圆点与发光协调
    ctx.shadowBlur = 0
    ctx.globalAlpha = 0.12
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()

    ctx.restore()
  },

  /* ================================================================
     Canvas 触摸命中判断
     ================================================================ */
  onCanvasTouch(e) {
    var self = this
    var touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!touch) return

    var touchX = touch.x
    var touchY = touch.y

    var dots = self._sortedDots || self.scatterDots || []
    if (dots.length === 0) return

    // 收集所有被命中的圆点 (包括重叠)
    var hits = []
    for (var i = 0; i < dots.length; i++) {
      var dot = dots[i]
      if (dot._x == null || dot._y == null || dot._r == null) continue
      var dx = touchX - dot._x
      var dy = touchY - dot._y
      var dist = Math.sqrt(dx * dx + dy * dy)
      // 热区：圆点半径 + 4px 容差
      if (dist <= dot._r + 4) {
        hits.push({ dot: dot, dist: dist })
      }
    }

    if (hits.length === 0) {
      // 点击空白区域 → 关闭浮层
      if (self.data.showDotTooltip) {
        self.setData({ showDotTooltip: false })
      }
      return
    }

    // 重叠场景：优先选距离最近 (视觉上最靠近手指的圆点)
    hits.sort(function (a, b) { return a.dist - b.dist })
    var hit = hits[0].dot

    var record = hit.record
    if (!record) return

    // 显示浮层提示
    self.setData({
      showDotTooltip: true,
      tooltipX: hit._x,
      tooltipY: hit._y - hit._r - 10,
      tooltipRecord: {
        moodType: record.currentMoodType || record.moodTag || '',
        energy: hit.energy,
        emotion: hit.emotion,
        color: hit.color,
        time: record.time || '',
        eventText: record.eventText || record.shareText || ''
      }
    })

    // 震动反馈
    wx.vibrateShort({ type: 'light' })
  },

  /**
   * 关闭散点浮层
   */
  onCloseDotTooltip() {
    this.setData({ showDotTooltip: false })
  },

  /* ================================================================
     进度条 - 双滑块区间选择
     ================================================================ */

  /**
   * 触摸开始：获取轨道像素尺寸，判断拖拽左/右手柄
   */
  onPbTouchStart(e) {
    const query = wx.createSelectorQuery()
    query.select('.ts-pb-track').boundingClientRect()
    query.exec((res) => {
      if (!res || !res[0]) return
      this._pbTrackRect = res[0] // { left, width, top, height }

      const touchX = e.touches[0].pageX
      const percent = this._pbPxToPercent(touchX)
      if (percent === null) return
      const touchDay = this._percentToDay(percent)

      const startDay = this._pbStartDay()
      const endDay   = this._pbEndDay()

      // 判断操作目标手柄 (阈值: 4天半径)
      const THR = 4
      const dS = Math.abs(touchDay - startDay)
      const dE = Math.abs(touchDay - endDay)

      if (touchDay <= startDay) {
        this._pbDragging = 'start'
      } else if (touchDay >= endDay) {
        this._pbDragging = 'end'
      } else if (dS <= THR && dS < dE) {
        this._pbDragging = 'start'
      } else if (dE <= THR && dE < dS) {
        this._pbDragging = 'end'
      } else {
        this._pbDragging = dS <= dE ? 'start' : 'end'
      }

      // 立即吸附到触摸点
      this._pbMoveToTouch(e)
    })
  },

  /**
   * 触摸移动：更新滑块位置
   */
  onPbTouchMove(e) {
    if (!this._pbDragging || !this._pbTrackRect) return
    this._pbMoveToTouch(e)
  },

  /**
   * 触摸结束：清除拖拽状态，触发情绪气泡重绘
   */
  onPbTouchEnd() {
    this._pbDragging = null
    this.drawScatterPlot()
  },

  /* ---- 内部辅助 ---- */

  /** 触摸 pageX → 轨道百分比 */
  _pbPxToPercent(pageX) {
    const r = this._pbTrackRect
    if (!r || r.width <= 0) return null
    const rel = pageX - r.left
    return Math.max(0, Math.min(100, rel / r.width * 100))
  },

  /** 轨道百分比 → 天数 */
  _percentToDay(pct) {
    return Math.round(pct / 100 * this._pbDivisor()) + 1
  },

  /** 天数 → 轨道百分比 */
  _dayToPercent(day) {
    return (day - 1) / this._pbDivisor() * 100
  },

  /** 当前区间最大值 (月=31, 年=12) */
  _pbMaxDay() {
    return this.data.timeRange === 'year' ? 12 : 31
  },

  /** 天数间隔除数 (月=30, 年=11) */
  _pbDivisor() {
    return this.data.timeRange === 'year' ? 11 : 30
  },

  /** 当前左侧手柄天数 */
  _pbStartDay() {
    return this._percentToDay(this.data.progressLeft)
  },

  /** 当前右侧手柄天数 */
  _pbEndDay() {
    return this._percentToDay(this.data.progressLeft + this.data.progressWidth)
  },

  /**
   * 格式化滑块标签 (月: "04" 年: "3月")
   */
  _formatPbLabel(day) {
    if (this.data.timeRange === 'year') return day + '月'
    return (day < 10 ? '0' : '') + day
  },

  /**
   * 根据触摸位置更新手柄
   */
  _pbMoveToTouch(e) {
    const touchX = e.touches[0].pageX
    const percent = this._pbPxToPercent(touchX)
    if (percent === null) return
    let day = this._percentToDay(percent)

    const startDay = this._pbStartDay()
    const endDay   = this._pbEndDay()
    const maxDay   = this._pbMaxDay()

    // 约束：左 ≤ endDay-1, 右 ≥ startDay+1, 范围 [1, maxDay]
    if (this._pbDragging === 'start') {
      day = Math.max(1, Math.min(endDay - 1, day))
      this._pbApplyRange(day, endDay)
    } else {
      day = Math.max(startDay + 1, Math.min(maxDay, day))
      this._pbApplyRange(startDay, day)
    }
  },

  /**
   * 应用区间，统一刷新进度条 UI
   */
  _pbApplyRange(startDay, endDay) {
    const TRACK_RPX = 598    // 轨道设计宽度 (rpx)
    const leftPct  = this._dayToPercent(startDay)
    const rightPct = this._dayToPercent(endDay)
    const widthPct = rightPct - leftPct

    // 胶囊居中于手柄位置 (32rpx 宽 / 2 = 16rpx)
    const pillStart = Math.round(leftPct * TRACK_RPX / 100 - 16)
    const pillEnd   = Math.round(rightPct * TRACK_RPX / 100 - 16)

    this.setData({
      progressStart: this._formatPbLabel(startDay),
      progressEnd:   this._formatPbLabel(endDay),
      progressLeft:  Math.round(leftPct * 100) / 100,
      progressWidth: Math.round(widthPct * 100) / 100,
      pillStartLeft: pillStart,
      pillEndLeft:   pillEnd,
      pbStartDay:    startDay,
      pbEndDay:      endDay
    })
  }
})
