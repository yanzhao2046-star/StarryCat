// pages/catAdopt/catAdopt.js — 选择你的猫（Figma 523_427）
// 路径：onboard → catAdopt →（取名）→ 认养 → catRoom
// 两条入口：拍摄（AI 生成新猫 / utils/genCat.js + 云函数 genCatStyle）
//           领养（6 选 1）
// 选中后不直接跳转，先弹「取名」弹层，填好昵称点「认养」才进入猫的房间

const { genCatFromPhoto } = require('../../utils/genCat.js')

const CATS = [
  { index: 0, src: '/assets/CodeBuddyAssets/523_427/4.png' },
  { index: 1, src: '/assets/CodeBuddyAssets/523_427/5.png' },
  { index: 2, src: '/assets/CodeBuddyAssets/523_427/6.png' },
  { index: 3, src: '/assets/CodeBuddyAssets/523_427/7.png' },
  { index: 4, src: '/assets/CodeBuddyAssets/523_427/8.png' },
  { index: 5, src: '/assets/CodeBuddyAssets/523_427/9.png' },
]

Page({

  data: {
    cats: CATS,
    selectedIndex: null,
    shootImage: '',
    catDesc: '',

    /* ---- 取名 · 认养弹层 ---- */
    showNamePanel: false,   // 弹层显隐
    pendingCat: {},         // 待认养的猫 { index, src, isShoot }
    catNick: '',            // 用户填写的姓名 / 猫昵称
    nameFocus: false,       // 输入框自动聚焦

    /* ---- AI 生成中状态 ---- */
    generating: false,      // 是否正在生成
    genStep: '准备中…',       // 当前步骤文案
    genPct: 0,              // 进度 0~100
  },

  onLoad() {
    /* 已领养过 → 回显选中 */
    const chosen = wx.getStorageSync('selectedCat')
    if (chosen && typeof chosen.index === 'number' && chosen.index >= 0) {
      this.setData({
        selectedIndex: chosen.index,
        catDesc: chosen.desc || '',
        catNick: chosen.name || '',
      })
    }
  },

  /* ================================================================
     拍摄：弹 action sheet 让用户选模式 → 触发相机/相册授权
     → 选好图 → 调用云函数 AI 风格生成（utils/genCat.js）
     → 拿到画风版猫图 → 打开取名弹层
     ================================================================ */
  onShoot() {
    wx.showActionSheet({
      itemList: ['拍一张', '从相册选'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.pickCatMedia(['camera'])
        } else if (res.tapIndex === 1) {
          this.pickCatMedia(['album'])
        }
      },
      fail: () => { /* 用户取消菜单 */ },
    })
  },

  /* 调起相机或相册选图（统一处理授权失败 + 调 AI） */
  pickCatMedia(sourceType) {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType,
      sizeType: ['original', 'compressed'],
      success(res) {
        const localPath = res.tempFiles[0].tempFilePath

        // 进入「AI 生成中」全屏遮罩
        that.setData({ generating: true, genPct: 0, genStep: '准备中…' })

        genCatFromPhoto(localPath, {
          onProgress: (pct, label) => {
            that.setData({ genPct: pct, genStep: label })
          },
        })
          .then(({ url, mock }) => {
            // 生成成功：用画风版图（mock 模式也是同图，闭环 OK）
            that.setData({
              shootImage: url,
              generating: false,
              genPct: 0,
            })
            wx.showToast({
              title: mock ? '已生成（开发模式）' : '已生成你的猫',
              icon: 'none',
              duration: 800,
            })
            that.openNamePanel({ index: -1, src: url, isShoot: true })
          })
          .catch((err) => {
            console.warn('[catAdopt] AI 生成失败，回退原图:', err)
            that.setData({
              shootImage: localPath,
              generating: false,
              genPct: 0,
            })
            wx.showToast({ title: '生成失败，使用原图', icon: 'none' })
            that.openNamePanel({ index: -1, src: localPath, isShoot: true })
          })
      },
      fail(err) {
        that.handleMediaFail(err)
      },
    })
  },

  /* 选图失败处理：区分"用户取消"与"权限被拒"，被拒时引导去设置 */
  handleMediaFail(err) {
    const msg = (err && err.errMsg) || ''
    if (/cancel/i.test(msg)) {
      wx.showToast({ title: '已取消', icon: 'none' })
      return
    }
    wx.getSetting({
      success(res) {
        const auth = res.authSetting || {}
        const denied = auth['scope.camera'] === false || auth['scope.album'] === false
        if (denied) {
          wx.showModal({
            title: '需要你的授权',
            content: '拍猫需要使用相机或相册权限，前往设置开启吗？',
            confirmText: '去设置',
            cancelText: '取消',
            success(m) {
              if (m.confirm) wx.openSetting()
            },
          })
        } else {
          wx.showToast({ title: '选图失败', icon: 'none' })
        }
      },
    })
  },

  /* ================================================================
     领养：选中一只 → 打开取名弹层（不再直接入主页）
     ================================================================ */
  onAdopt(e) {
    const idx = e.currentTarget.dataset.index
    const cat = CATS[idx]
    this.setData({ selectedIndex: idx })

    this.openNamePanel({ index: idx, src: cat.src, isShoot: false })
  },

  /* ================================================================
     取名弹层
     ================================================================ */
  openNamePanel(cat) {
    this.setData({
      showNamePanel: true,
      pendingCat: cat,
      catNick: '',
      nameFocus: false,
    })
    // 等弹层动画起来再聚焦，避免键盘把动画顶掉
    setTimeout(() => this.setData({ nameFocus: true }), 300)
  },

  onNameInput(e) {
    this.setData({ catNick: e.detail.value })
  },

  /* 认养：校验昵称 → 持久化猫信息 & 互动身份 → 入主页 */
  onConfirmAdopt() {
    const nick = (this.data.catNick || '').trim()
    if (!nick) {
      wx.showToast({ title: '给它起个名字吧', icon: 'none' })
      return
    }

    const cat = this.data.pendingCat || {}
    const name = nick.slice(0, 12)

    /* ① 记录领养的猫 */
    wx.setStorageSync('selectedCat', {
      index: cat.index,
      src: cat.src,
      name,
      desc: '',
      isShoot: !!cat.isShoot,
      adoptedAt: Date.now(),
    })

    /* ② 同步互动身份：猫名 + 猫作为头像 */
    try {
      const profile = wx.getStorageSync('userProfile') || {}
      profile.catName = name
      profile.avatarPath = cat.src
      if (!profile.nickname) profile.nickname = name
      wx.setStorageSync('userProfile', profile)
    } catch (err) {
      console.warn('[catAdopt] 保存互动身份失败:', err)
    }

    this.setData({ showNamePanel: false, nameFocus: false })
    wx.showToast({ title: '认养成功', icon: 'success', duration: 800 })

    setTimeout(() => {
      wx.redirectTo({ url: '/pages/catRoom/catRoom' })
    }, 700)
  },

  onCancelName() {
    this.setData({ showNamePanel: false, nameFocus: false })
  },

  /* 阻止点透到遮罩 */
  onSheetTap() {},

  onShareAppMessage() {
    return {
      title: '毛布力猫不理 — 选择你的猫',
      path: '/pages/catAdopt/catAdopt'
    }
  }
})
