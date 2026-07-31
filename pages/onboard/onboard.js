// pages/onboard/onboard.js

/* =================================================================
   avatarList — 18 个 Figma 专属头像
   资源路径: /assets/CodeBuddyAssets/46_750/
   Figma 6×3 网格，从左到右、从上到下排列
   ================================================================= */
const AVATAR_LIST = [
  '/assets/CodeBuddyAssets/46_750/1.png',
  '/assets/CodeBuddyAssets/46_750/2.png',
  '/assets/CodeBuddyAssets/46_750/3.png',
  '/assets/CodeBuddyAssets/46_750/4.png',
  '/assets/CodeBuddyAssets/46_750/5.png',
  '/assets/CodeBuddyAssets/46_750/9.png',
  '/assets/CodeBuddyAssets/46_750/8.png',
  '/assets/CodeBuddyAssets/46_750/10.png',
  '/assets/CodeBuddyAssets/46_750/13.png',
  '/assets/CodeBuddyAssets/46_750/6.png',
  '/assets/CodeBuddyAssets/46_750/12.png',
  '/assets/CodeBuddyAssets/46_750/7.png',
  '/assets/CodeBuddyAssets/46_750/11.png',
  '/assets/CodeBuddyAssets/46_750/14.png',
  '/assets/CodeBuddyAssets/46_750/15.png',
  '/assets/CodeBuddyAssets/46_750/16.png',
  '/assets/CodeBuddyAssets/46_750/17.png',
  '/assets/CodeBuddyAssets/46_750/18.png'
]

Page({

  data: {
    nickname: '',
    birthday: '',                // 出生日期
    today: '',                   // picker end 限制
    avatarList: AVATAR_LIST,
    selectedAvatar: -1,          // 已确认的头像索引（-1 表示未选）
    selectedAvatarPath: '',      // 已确认的头像图片路径
    tempAvatar: -1,              // 弹窗中临时选中的索引
    showAvatarDialog: false
  },

  onLoad() {
    /* 已有用户资料 → 跳过登录页，直接进情绪岛 */
    const profile = wx.getStorageSync('userProfile')
    if (profile) {
      const nick = profile.nickname ? encodeURIComponent(profile.nickname) : ''
      wx.redirectTo({
        url: '/pages/moodAdd/moodAdd?nickname=' + nick
      })
      return
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

  /* ====== 打开头像弹窗 ====== */
  onAvatarTap() {
    this.setData({
      showAvatarDialog: true,
      tempAvatar: this.data.selectedAvatar
    })
  },

  /* ====== 关闭弹窗（放弃选择） ====== */
  onCloseDialog() {
    this.setData({ showAvatarDialog: false })
  },

  /* ====== 弹窗内临时选中 ====== */
  onTempSelect(e) {
    const idx = Number(e.currentTarget.dataset.index)
    this.setData({ tempAvatar: idx })
  },

  /* ====== 确认选择 ====== */
  onConfirmTap() {
    const idx = this.data.tempAvatar
    if (idx < 0) {
      wx.showToast({ title: '请先选择一个图像', icon: 'none' })
      return
    }
    const path = AVATAR_LIST[idx] || ''
    this.setData({
      selectedAvatar: idx,
      selectedAvatarPath: path,
      showAvatarDialog: false
    })
  },

  /* ====== 开启情绪旅程 ====== */
  onSubmit() {
    const name = this.data.nickname.trim() || 'Cyne'
    const avatarIndex = this.data.selectedAvatar
    const avatarPath = this.data.selectedAvatarPath || ''

    /* 持久化用户资料 */
    wx.setStorageSync('userProfile', {
      nickname: name,
      birthday: this.data.birthday,
      avatarIndex: avatarIndex,
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