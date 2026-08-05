// pages/moodRecord/moodRecord.js
const app = getApp()

Page({

  data: {
    nickname: 'Cyne',
    userAvatar: '',        // 用户专属头像（来自 onboard）

    /* ---- 火苗记录数据（来自 moodAdd globalData） ---- */
    moodEnergy: 0,
    currentMoodType: '',
    eventText: '',
    shareText: '',
    shareTip: '',
    recordTime: '',

    /* ---- 统计汇总 ---- */
    recordCount: '8',
    avgHeat: '61',

    /* ---- 分享溯源标识 ---- */
    shareFrom: ''
  },

  onLoad(options) {
    if (options.nickname) {
      this.setData({ nickname: decodeURIComponent(options.nickname) })
    }

    /* ---- 读取用户专属头像（onboard 保存） ---- */
    try {
      const profile = wx.getStorageSync('userProfile')
      if (profile && profile.avatarPath) {
        this.setData({ userAvatar: profile.avatarPath })
      }
    } catch (e) { /* ignore */ }

    /* ---- 分享溯源：记录推荐人 ---- */
    if (options.from) {
      this.setData({ shareFrom: decodeURIComponent(options.from) })
    }

    /* ---- 读取 moodAdd 保存的火苗记录 ---- */
    const record = app.globalData.currentMoodRecord
    if (record) {
      this.setData({
        moodEnergy: record.moodEnergy,
        currentMoodType: record.currentMoodType,
        eventText: record.eventText,
        shareText: record.shareText,
        shareTip: record.shareTip,
        recordTime: record.recordTime || ''
      })
    }

    /* ---- 分享场景：从URL参数重构卡片 ---- */
    if (!record && options.data) {
      try {
        const parsed = JSON.parse(decodeURIComponent(options.data))
        this.setData({
          moodEnergy: parsed.e || 0,
          currentMoodType: parsed.m || '',
          eventText: parsed.q || '',
          shareText: parsed.s || '',
          shareTip: parsed.t || '',
          recordTime: parsed.d || ''
        })
      } catch (e) { /* ignore corrupt params */ }
    }

    /* ---- 兜底：没有记录时间则用当前系统时间 ---- */
    if (!this.data.recordTime) {
      const n = new Date()
      const pad = v => v < 10 ? '0' + v : v
      this.setData({
        recordTime: n.getFullYear() + '.' + pad(n.getMonth() + 1) + '.' + pad(n.getDate()) + '.' + pad(n.getHours()) + ':' + pad(n.getMinutes())
      })
    }
  },

  /* ==============================================================
     保存 — 相册授权 → Canvas绘制 → 保存到手机相册
     ============================================================== */
  async onSave() {
    wx.showLoading({ title: '生成中...', mask: true })

    try {
      /* ① 检查 / 申请相册写入权限 */
      const authResult = await this._requestAlbumAuth()
      if (!authResult) {
        wx.hideLoading()
        return
      }

      /* ② Canvas 渲染火苗卡片 → 导出临时图片 */
      const tempPath = await this._renderCardToImage()

      /* ③ 保存到系统相册 */
      await new Promise((resolve, reject) => {
        wx.saveImageToPhotosAlbum({
          filePath: tempPath,
          success: resolve,
          fail: reject
        })
      })

      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success', duration: 2000 })

      /* ④ 触发分享成长积分（保存也计入分享行为） */
      app.addGrowScore('share_post')

    } catch (err) {
      wx.hideLoading()
      console.error('[moodRecord] 保存失败:', err)
      if (err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
        this._showAuthGuide()
      } else {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    }
  },

  /* ------ 申请相册写入授权 ------ */
  _requestAlbumAuth() {
    return new Promise(resolve => {
      wx.getSetting({
        success: res => {
          if (res.authSetting['scope.writePhotosAlbum'] === true) {
            resolve(true)
          } else if (res.authSetting['scope.writePhotosAlbum'] === false) {
            // 曾拒绝 — 引导打开设置
            this._showAuthGuide()
            resolve(false)
          } else {
            // 未询问过 — 主动申请
            wx.authorize({
              scope: 'scope.writePhotosAlbum',
              success: () => resolve(true),
              fail: () => {
                this._showAuthGuide()
                resolve(false)
              }
            })
          }
        },
        fail: () => resolve(false)
      })
    })
  },

  /* ------ 引导用户手动打开相册权限 ------ */
  _showAuthGuide() {
    wx.showModal({
      title: '需要相册权限',
      content: '保存火苗卡片需要访问您的相册，请前往设置开启权限',
      confirmText: '去设置',
      success: res => {
        if (res.confirm) {
          wx.openSetting()
        }
      }
    })
  },

  /* ==============================================================
     Canvas 绘制火苗卡片 → 导出临时文件路径
     Figma 卡面基准: 304 × 432 px (50_6634)
     WXSS 换算: 1 Figma px = 2 rpx → Canvas px = rpx / 2
     固定坐标系 304×432，DPR 缩放保证输出清晰度

     【改动标注】完全重写坐标体系，严格对齐 Figma 50_6634 设计稿：
       - (A) 卡片背景改为直角矩形（外层无圆角）
       - (B) 火焰 y: 85→69  |  语录 y: 151→205（居中）
       - (C) 按钮宽: 70→85，坐标重算
       - (D) 日期使用完整 recordTime 对齐页面
       - (E) _wrapText 新增 align 参数
       - (F) 图片加载完成后再绘制
     ============================================================== */
  _renderCardToImage() {
    const CARD_W = 304  // Figma px
    const CARD_H = 432
    const PAD = 15      // card-inner padding (30rpx/2)
    const CX = CARD_W / 2  // 152, 水平居中基准

    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#shareCanvas')
        .fields({ node: true, size: true })
        .exec(async res => {
          try {
            if (!res || !res[0] || !res[0].node) {
              reject(new Error('Canvas node not found'))
              return
            }

            const canvas = res[0].node
            const ctx = canvas.getContext('2d')
            const dpr = wx.getSystemInfoSync().pixelRatio

            // canvas 物理像素 = 设计尺寸 × DPR，保证高清输出
            canvas.width = CARD_W * dpr
            canvas.height = CARD_H * dpr
            ctx.scale(dpr, dpr)

            /* ---- 加载图片（等待全部就绪再绘制） ---- */
            const loadImg = src => new Promise((rs, rj) => {
              const img = canvas.createImage()
              img.onload = () => rs(img)
              img.onerror = rj
              img.src = src
            })

            // (F) 图片加载与数据读取提前完成，确保后续绘制时所有资源就绪
            let avatarImg = null, catImg = null
            try {
              [avatarImg, catImg] = await Promise.all([
                loadImg(this.data.userAvatar || '/assets/moodRecord/5.png'),
                loadImg('/assets/moodRecord/6.png')
              ])
            } catch (e) { /* 图片失败不阻塞，对应元素留空 */ }

            /* ---- 读取数据 ---- */
            const {
              nickname, moodEnergy, currentMoodType,
              shareText, shareTip, eventText, recordTime
            } = this.data

            // (D) 日期使用完整 recordTime，与页面 WXSM {{recordTime}} 对齐
            //     格式: YYYY.MM.DD.HH:MM（如 "2026.08.04.14:30"）

            // 统一文字基线为 top（y = 顶部坐标）
            ctx.textBaseline = 'top'

            // =============================================
            // ① 卡片背景 — FIGMA: 304×432, #302D54
            // (A) 导出图片不需要圆角，整体为直角矩形
            // =============================================
            ctx.fillStyle = '#302D54'
            ctx.fillRect(0, 0, CARD_W, CARD_H)

            // =============================================
            // ② 顶部：圆形头像 + 昵称 + 日期
            // FIGMA: 头像 40×40 @ (15,15), 文字 left=68, top=20/36
            // =============================================
            if (avatarImg) {
              ctx.save()
              ctx.beginPath()
              ctx.arc(PAD + 20, PAD + 20, 20, 0, 2 * Math.PI)
              ctx.clip()
              ctx.drawImage(avatarImg, PAD, PAD, 40, 40)
              ctx.restore()
            }

            ctx.fillStyle = '#ffffff'
            ctx.font = '290 12px "Microsoft YaHei", sans-serif'
            ctx.textAlign = 'left'
            // 昵称行 — FIGMA: left=68, top=20
            ctx.fillText(nickname + '火苗卡', 68, 20)

            // 日期行 — FIGMA: left=68, top=36, opacity 0.6
            ctx.globalAlpha = 0.6
            ctx.fillText(recordTime, 68, 36)
            ctx.globalAlpha = 1.0

            // =============================================
            // ③ Emoji 情绪核心区
            // FIGMA: 235×151 容器 @ left=35, top=69
            //   内部: 140×120 火焰+文字框 @ left=47.5 (居中), top=0
            //   🔥 火焰: 43px center, top=0  → 绝对 y=69
            //   热度文字: 12px, top=57       → 绝对 y=126
            //   情绪类型: 20px bold, top=81  → 绝对 y=150 (top=57+24)
            //   情绪黑话: 12px, top=105     → 绝对 y=174 (top=57+48)
            // =============================================

            // (B) 🔥 火焰 — FIGMA: y=15(内边距)+54(区块top)+0=69, center=152
            ctx.textAlign = 'center'
            ctx.font = '400 43px "Microsoft YaHei", sans-serif'
            ctx.fillText('🔥', CX, 69)

            // 情绪热度 — FIGMA: y=15+54+57=126
            ctx.font = '290 12px "Microsoft YaHei", sans-serif'
            ctx.fillText('情绪热度 ' + moodEnergy + '%', CX, 126)

            // 情绪类型 — FIGMA: y=15+54+57+24=150
            ctx.font = '700 20px "Microsoft YaHei", sans-serif'
            ctx.fillText(currentMoodType || '超开心', CX, 150)

            // 情绪黑话 — FIGMA: y=15+54+57+48=174
            if (shareText) {
              ctx.font = '290 12px "Microsoft YaHei", sans-serif'
              ctx.fillText(shareText, CX, 174)
            }

            // =============================================
            // ④ 语录 — FIGMA: y=15+54+136=205
            //   24px, weight 290, 居中对齐（匹配 WXSS .card-quote）
            // =============================================
            // (B) 原坐标 y=151 与情绪文字重叠 → 修正为 y=205
            // (E) 传入 align='center' 匹配 WXSS text-align:center
            if (eventText) {
              ctx.font = '290 24px "Microsoft YaHei", sans-serif'
              this._wrapText(ctx, '"' + eventText + '"', CX, 205, 254, 30, 'center')
            }

            ctx.textAlign = 'left'

            // =============================================
            // ⑤ 星猫寄语卡片 274×121
            // FIGMA: left=15, top=254, r=24
            //   bg rgba(203,179,255,0.33), border 1px rgba(255,255,255,0.38)
            //   星猫 61×61 @ left=24, top=281  (相对卡片: left=9, top=27)
            //   文字 16px @ left=87, top=289   (相对卡片: left=72, top=35, maxW=190)
            // =============================================
            const aX = PAD, aY = 254, aW = CARD_W - 2 * PAD, aH = 121

            // 紫色背景 + 裁切圆角
            ctx.save()
            this._roundRect(ctx, aX, aY, aW, aH, 24)
            ctx.clip()
            ctx.fillStyle = 'rgba(203, 179, 255, 0.33)'
            ctx.fillRect(aX, aY, aW, aH)
            ctx.restore()

            // 白色半透明描边
            ctx.save()
            this._roundRect(ctx, aX, aY, aW, aH, 24)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()

            // 星猫插画 — FIGMA: (24, 281), 61×61
            if (catImg) {
              ctx.drawImage(catImg, aX + 9, aY + 27, 61, 61)
            }

            // 星猫建议文字 — FIGMA: (87, 289), 16px, maxWidth=190
            if (shareTip) {
              ctx.fillStyle = '#ffffff'
              ctx.font = '400 16px "Microsoft YaHei", sans-serif'
              this._wrapText(ctx, shareTip, aX + 72, aY + 35, 190, 24)
            }

            // =============================================
            // ⑥ 导出临时图片
            //    注: 导出相册图片不含"保存/分享"按钮，页面 WXSS 弹窗按钮不受影响
            // =============================================
            wx.canvasToTempFilePath({
              canvas: canvas,
              x: 0, y: 0,
              width: CARD_W, height: CARD_H,
              destWidth: CARD_W * dpr,
              destHeight: CARD_H * dpr,
              success: r => resolve(r.tempFilePath),
              fail: reject
            })

          } catch (err) {
            reject(err)
          }
        })
    })
  },

  /* ------ 辅助：绘制圆角矩形路径 ------ */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  },

  /* ------ 辅助：Canvas 自动换行绘制文本（textBaseline='top'）
     (E) 新增 align 参数，支持 'left' | 'center' | 'right'
          语录区域传入 'center' 以匹配 WXSS .card-quote { text-align: center; }
     ------ */
  _wrapText(ctx, text, x, y, maxWidth, lineHeight, align = 'left') {
    const lines = []
    let current = ''
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      const testLine = current + ch
      if (ctx.measureText(testLine).width > maxWidth && current.length > 0) {
        lines.push(current)
        current = ch
      } else {
        current = testLine
      }
    }
    if (current) lines.push(current)

    const savedAlign = ctx.textAlign
    // (E) 按传入参数设置对齐方式
    ctx.textAlign = align

    lines.forEach((line, idx) => {
      const sy = y + idx * lineHeight
      if (sy < 432) ctx.fillText(line, x, sy)
    })

    ctx.textAlign = savedAlign
  },

  /* ====== 分享 ====== */
  onShare() {
    // 此函数不再需要逻辑；由 button open-type="share" 接管
    // 保留为占位，防止模板报错
  },

  /* ====== 底部 tab 切换 ====== */
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    const name = this.data.nickname
    const nickname = encodeURIComponent(name)
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd?nickname=' + nickname
        break
      case 'moodLib':
        url = '/pages/moodLib/moodLib?nickname=' + nickname
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

  /* ==============================================================
     分享给好友 — 好友打开可预览火苗卡片
     参数精简编码，通过 path 携带完整卡片数据
     ============================================================== */
  onShareAppMessage() {
    const {
      nickname, moodEnergy, currentMoodType,
      eventText, shareText, shareTip, recordTime
    } = this.data

    // 精简 JSON 编码（短键名减少 URL 长度）
    const cardData = JSON.stringify({
      e: moodEnergy,
      m: currentMoodType,
      q: eventText,
      s: shareText,
      t: shareTip,
      d: recordTime
    })

    // 触发成长积分
    app.addGrowScore('share_post')

    return {
      title: nickname + ' 的火苗卡片 · ' + (currentMoodType || '记录心情'),
      path: '/pages/moodRecord/moodRecord?nickname=' +
        encodeURIComponent(nickname) +
        '&data=' + encodeURIComponent(cardData) +
        '&from=' + encodeURIComponent(nickname),
      imageUrl: '' // 使用默认截图
    }
  }

})
