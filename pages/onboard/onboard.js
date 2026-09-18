// pages/onboard/onboard.js — 开屏页（Figma 503_1510）
// 无表单、无头像上传、无强制资料收集
// 唯一入口：点击「开门」图片进入主功能，无自动跳转

Page({

  data: {},

  onLoad() {},

  /* 点击开门图 → 已领养过直入猫房，未领养先进选猫 */
  goHome() {
    if (this._gone) return
    this._gone = true

    const chosen = wx.getStorageSync('selectedCat')
    const adopted = chosen && typeof chosen.index === 'number' && chosen.index >= 0
    const target = adopted ? '/pages/catRoom/catRoom' : '/pages/catAdopt/catAdopt'

    wx.redirectTo({
      url: target,
      fail() {
        wx.navigateTo({ url: target })
      }
    })
  },

  onShow() {},
  onHide() {},
  onUnload() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {
    return {
      title: '毛布力猫不理 — 记录情绪 了解内心',
      path: '/pages/onboard/onboard'
    }
  }
})
