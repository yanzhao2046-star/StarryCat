// pages/onboard/onboard.js — 开屏页（Figma 1800_312）
// 无表单、无头像上传、无强制资料收集
// 唯一入口：点击猫直接进猫房（原长按 3 秒时间环玩法已移除）
// 选猫页（catAdopt）暂时隐藏：统一默认黑猫，直接进猫房

/* 默认黑猫（523_427/8.png），首次进入自动认养 */
const DEFAULT_CAT = {
  index: 4,
  src: '/assets/CodeBuddyAssets/523_427/8.png',
  name: 'Aion 星星猫',
  desc: '',
  isShoot: false,
  adoptedAt: 0,
}

Page({

  data: {},

  onLoad() {},

  /* ==========================================================
     点击猫 → 直接进猫房（未领养过则先自动认养默认黑猫）
     ========================================================== */
  onCatTap() {
    this.goHome()
  },

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
