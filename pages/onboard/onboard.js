// pages/onboard/onboard.js

Page({

  data: {
    nickname: '',
    birthday: '',                // 出生日期
    today: '',                   // picker end 限制
    selectedAvatarPath: ''       // 已选头像本地临时路径
  },

  onLoad() {
    /* 已有用户资料 → 跳过登录页，直接进情绪岛 */
    try {
      const profile = wx.getStorageSync('userProfile')
      if (profile && profile.nickname) {
        wx.redirectTo({
          url: '/pages/moodAdd/moodAdd?nickname=' + encodeURIComponent(profile.nickname),
          fail() { /* redirect fail — stay on onboard */ }
        })
        return
      }
    } catch (e) { /* ignore */ }

    /* 今天的日期（picker end 限制） */
    const d = new Date()
    const Y = d.getFullYear()
    const M = String(d.getMonth() + 1).padStart(2, '0')
    const D = String(d.getDate()).padStart(2, '0')
    this.setData({ today: Y + '-' + M + '-' + D })
  },

  /* ====== 昵称输入 ====== */
  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  /* ====== 日期选择 ====== */
  onDateChange(e) {
    this.setData({ birthday: e.detail.value })
  },

  /* ====== 打开头像选择 — 微信原生拍照/相册 ====== */
  onAvatarTap() {
    const that = this
    wx.showActionSheet({
      itemList: ['拍照', '从手机相册选择'],
      success(res) {
        if (res.tapIndex === 0) {
          that._chooseMedia(['camera'])
        } else if (res.tapIndex === 1) {
          that._chooseMedia(['album'])
        }
      }
    })
  },

  _chooseMedia(sourceType) {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: sourceType,
      success(res) {
        const path = res.tempFiles[0].tempFilePath
        that.setData({ selectedAvatarPath: path })
      },
      fail() {
        wx.showToast({ title: '选择失败，请重试', icon: 'none' })
      }
    })
  },

  /* ====== 开启情绪旅程 ====== */
  onSubmit() {
    const name = this.data.nickname.trim() || 'Cyne'
    const avatarPath = this.data.selectedAvatarPath || ''

    /* 持久化用户资料 */
    wx.setStorageSync('userProfile', {
      nickname: name,
      birthday: this.data.birthday,
      avatarPath: avatarPath
    })

    wx.redirectTo({
      url: '/pages/moodAdd/moodAdd?nickname=' + encodeURIComponent(name)
    })
  },

  onReady() {},
  onShow() {},
  onHide() {},
  onUnload() {},
  onPullDownRefresh() {},
  onReachBottom() {},
  onShareAppMessage() {}
})
