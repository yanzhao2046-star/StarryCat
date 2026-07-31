// ============================================
//  moodCalendar - 心情日历页
//  当前阶段：纯静态 UI，暂不接入数据/交互
//  ============================================

Page({

  data: {
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
    ]
  },

  /* ====== 生命周期 ====== */
  onLoad() {
    // 二期：读取本地存储心情记录，计算真实统计数据
  },

  onShow() {
    // 查看日历加分
    const app = getApp()
    app.addGrowScore('view_calendar')
  },

  /* ====== 月份切换（预留） ====== */
  onPrevMonth() {
    // 二期：切换到上个月
  },

  onNextMonth() {
    // 二期：切换到下个月
  },

  /* ====== 日期点击（预留） ====== */
  onDayTap(e) {
    // 二期：取 e.currentTarget.dataset.day，打开当日详情
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
  }
})
