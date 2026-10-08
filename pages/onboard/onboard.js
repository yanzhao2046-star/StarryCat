// pages/onboard/onboard.js — 开屏页（Figma 503_1510）
// 无表单、无头像上传、无强制资料收集
// 唯一入口：点击「开门」图片进入主功能，无自动跳转
// 选猫页（catAdopt）暂时隐藏：统一默认黑猫，直接进猫房
//
// 猫形象：单张精灵（catGaze/up.png）动态旋转，WXS 视图层手指跟随（gaze.wxs）
// 素材/实现演进史在 git：8 向视线 320d92b..4e93a6d → 静态单张 → WXS 连续旋转

/* 默认黑猫（523_427/8.webp），首次进入自动认养 */
const DEFAULT_CAT = {
  index: 4,
  src: '/assets/CodeBuddyAssets/523_427/8.png',
  name: 'Aion 星星猫',
  desc: '',
  isShoot: false,
  adoptedAt: 0,
}

Page({

  data: {
    /* 手指跟随：猫精灵中心（client 坐标），onReady 量一次传给 WXS 用 */
    gazeCX: 0,
    gazeCY: 0,
  },

  onLoad() {},

  /* 一次性测量猫精灵中心 → dataset 给 WXS（之后 touchmove 全在视图层，零 setData） */
  onReady() {
    this.createSelectorQuery()
      .select('#catRot')
      .boundingClientRect((r) => {
        if (!r) return
        this.setData({ gazeCX: r.left + r.width / 2, gazeCY: r.top + r.height / 2 })
      })
      .exec()
  },

  /* 点击开门图 → 直入猫房；未领养过则先自动认养默认黑猫 */
  goHome() {
    if (this._gone) return
    this._gone = true

    let chosen = wx.getStorageSync('selectedCat')
    if (!(chosen && typeof chosen.index === 'number' && chosen.index >= 0)) {
      chosen = { ...DEFAULT_CAT, adoptedAt: Date.now() }
      wx.setStorageSync('selectedCat', chosen)
      /* 同步互动身份：猫名 + 猫作为头像（与 catAdopt 认养逻辑一致） */
      try {
        const profile = wx.getStorageSync('userProfile') || {}
        profile.catName = chosen.name
        profile.avatarPath = chosen.src
        if (!profile.nickname) profile.nickname = chosen.name
        wx.setStorageSync('userProfile', profile)
      } catch (err) {
        console.warn('[onboard] 保存互动身份失败:', err)
      }
    }

    wx.redirectTo({
      url: '/pages/catRoom/catRoom',
      fail() {
        wx.navigateTo({ url: '/pages/catRoom/catRoom' })
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
      title: 'Aion 星星猫 — 记录情绪 了解内心',
      path: '/pages/onboard/onboard'
    }
  }
})
