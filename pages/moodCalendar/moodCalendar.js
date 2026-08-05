// ============================================
//  moodCalendar - 心情日历页
//  当前阶段：纯静态 UI，暂不接入数据/交互
//  ============================================

Page({

  data: {
    // 顶部日期展示 & 日历标题（动态，由第一条记录决定）
    topDate: '',
    calendarMonthText: '',

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
    timeRange: 'day',         // day | week | month | year
    selectedDay: 1,            // 1-7
    trackDays: [1, 2, 3, 4, 5, 6, 7],
    chartYear: 2026,
    chartMonth: 7,
    yLabels: ['100', '80', '60', '40', '20', '0'],
    xLabels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
    // 水平虚线：对齐 Y 轴标签 80/60/40/20 (618÷5=123.6 rpx/格)
    dashLinesH: [124, 247, 371, 494],
    // 垂直虚线：对齐整点 4/8/12/16/20 时 (618÷6=103 rpx/格)
    dashLinesV: [103, 206, 309, 412, 515],
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
      calendarMonthText: y + '年 ' + m + '月'
    })

    // 调试期：为当前选中的日期自动注入模拟数据
    this._injectMockData()
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
      topDate: y + '年' + m + '月' + dd + '日'
    })
    this.drawScatterPlot()
  },

  /* ================================================================
     情绪轨迹图 - 时间范围切换
     ================================================================ */
  onTimeRangeTap(e) {
    const range = e.currentTarget.dataset.range
    this.setData({ timeRange: range })
    this.drawScatterPlot()
  },

  /* ================================================================
     情绪轨迹图 - 天数选择
     ================================================================ */
  onDaySelect(e) {
    const day = e.currentTarget.dataset.day
    var _a = this.data, y = _a.chartYear, m = _a.chartMonth
    var dd = day < 10 ? '0' + day : '' + day
    this.setData({
      selectedDay: day,
      topDate: y + '年' + m + '月' + dd + '日'
    })
    this.drawScatterPlot()
  },

  /* ================================================================
     情绪轨迹图 - 月份切换
     ================================================================ */
  onChartPrevMonth() {
    let { chartYear, chartMonth } = this.data
    if (chartMonth === 1) {
      chartMonth = 12
      chartYear -= 1
    } else {
      chartMonth -= 1
    }
    this.setData({
      chartYear, chartMonth,
      calendarMonthText: chartYear + '年 ' + chartMonth + '月'
    })
    this.drawScatterPlot()
  },

  onChartNextMonth() {
    let { chartYear, chartMonth } = this.data
    if (chartMonth === 12) {
      chartMonth = 1
      chartYear += 1
    } else {
      chartMonth += 1
    }
    this.setData({
      chartYear, chartMonth,
      calendarMonthText: chartYear + '年 ' + chartMonth + '月'
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

    // 调试期：当前日期无记录时自动注入模拟数据
    this._injectMockData()

    // 关闭可能存在的浮层
    if (this.data.showDotTooltip) {
      this.setData({ showDotTooltip: false })
    }

    var dots = this._getDayRecords()
    this.scatterDots = dots
    console.log('[drawScatterPlot] dots count:', dots.length)

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

        // 排序：小圆点后绘 (在上层)，方便触控优先命中
        var sorted = dots.slice().sort(function (a, b) {
          return b.energy - a.energy
        })

        // 存储排序后的绘制数据供触摸检测
        self._sortedDots = sorted
        console.log('[drawScatterPlot] 开始绘制', sorted.length, '个圆点')

        for (var i = 0; i < sorted.length; i++) {
          self._drawGlowDot(ctx, sorted[i], cw, ch)
        }
      })
  },

  /**
   * 绘制单个发光圆点
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} dot  {hour, energy, color}
   * @param {number} cw  画布逻辑宽度
   * @param {number} ch  画布逻辑高度
   */
  _drawGlowDot(ctx, dot, cw, ch) {
    var hour = dot.hour, energy = dot.energy, color = dot.color

    // ---- 坐标映射 ----
    var x = (hour / 24) * cw
    var y = (1 - energy / 100) * ch   // 0→底部, 100→顶部

    // ---- 半径：放大到 8-22px ----
    var minR = 8
    var maxR = 22
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
  }
})
