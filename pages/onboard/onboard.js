// pages/onboard/onboard.js

Page({

  data: {
    nickname: '',
    birthday: '',                // 出生日期
    today: '',                   // picker end 限制
    selectedAvatarPath: '',      // 已选头像本地临时路径
    avatarFileID: '',            // 头像云存储 fileID（安全审核通过后）
    checking: false              // 头像安全审核中
  },

  onLoad(options) {
    /* 扫码进入 → 强制展示欢迎页 */
    const fromScan = options.from === 'qrcode'

    /* 已有用户资料 且 非扫码 → 跳过登录页，直接进情绪岛 */
    if (!fromScan) {
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
    }

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
        that._checkAvatarSafety(path)
      },
      fail() {
        wx.showToast({ title: '选择失败，请重试', icon: 'none' })
      }
    })
  },

  /* ====== 头像内容安全审核 ====== */
  async _checkAvatarSafety(tempPath) {
    const that = this
    this.setData({ checking: true })
    wx.showLoading({ title: '审核中...', mask: true })

    try {
      // 1. 上传至云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: 'avatars/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.png',
        filePath: tempPath
      })
      const fileID = uploadRes.fileID

      // 2. 调用云函数进行图片安全检测
      const checkRes = await wx.cloud.callFunction({
        name: 'imgSecCheck',
        data: { fileID }
      })

      wx.hideLoading()

      if (checkRes.result && checkRes.result.code === 0) {
        // 审核通过
        that.setData({
          selectedAvatarPath: tempPath,
          avatarFileID: fileID,
          checking: false
        })
      } else {
        // 审核不通过 — 违规内容
        that.setData({ checking: false })
        wx.showToast({ title: '所发布内容含违规信息', icon: 'none', duration: 2000 })
        // 删除已上传的违规文件
        wx.cloud.deleteFile({ fileList: [fileID] }).catch(() => {})
      }
    } catch (err) {
      wx.hideLoading()
      that.setData({ checking: false })
      console.error('头像安全审核异常:', err)
      wx.showToast({ title: '检测失败，请重试', icon: 'none' })
    }
  },

  /* ====== 开启情绪旅程 ====== */
  onSubmit() {
    if (this.data.checking) {
      wx.showToast({ title: '头像审核中，请稍候', icon: 'none' })
      return
    }
    this._saveAndGo()
  },

  /* ====== 跳过，先体验 — 不强制填写资料 ====== */
  onSkip() {
    this._saveAndGo()
  },

  /* ====== 保存资料并跳转 ====== */
  _saveAndGo() {
    const name = this.data.nickname.trim() || 'Cyne'
    const avatarPath = this.data.selectedAvatarPath || ''
    const avatarFileID = this.data.avatarFileID || ''

    /* 持久化用户资料 */
    wx.setStorageSync('userProfile', {
      nickname: name,
      birthday: this.data.birthday,
      avatarPath: avatarPath,
      avatarFileID: avatarFileID
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
