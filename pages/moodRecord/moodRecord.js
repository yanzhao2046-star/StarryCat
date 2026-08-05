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
    shareFrom: '',

    /* ---- 视觉层 ---- */
    flameGlowFilter: '',   // 火焰发光 CSS filter
    barcodeText: ''        // 条码文字 ID
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

    /* ---- 计算火焰发光强度 ---- */
    this._computeFlameGlow()

    /* ---- 生成二维条码 ---- */
    this._generateBarcode()
  },

  /* ==============================================================
     计算火焰发光 CSS filter（根据 moodEnergy 动态调整）
     ============================================================== */
  _computeFlameGlow() {
    const energy = this.data.moodEnergy || 0
    const radius = 4 + energy * 0.24   // 4 ~ 28 rpx
    const opacity = 0.2 + energy * 0.005 // 0.2 ~ 0.7
    this.setData({
      flameGlowFilter: `drop-shadow(0 0 ${radius}rpx rgba(255, 140, 0, ${opacity}))`
    })
  },

  /* ==============================================================
     生成二维条码（页面展示 + 数据标识）
     ============================================================== */
  _generateBarcode() {
    const seed = (this.data.recordTime || '') + (this.data.nickname || '') + (this.data.moodEnergy || 0)
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i)
      hash |= 0
    }
    const rng = () => {
      hash = (hash * 9301 + 49297) % 233280
      return hash / 233280
    }

    // 生成条码文字 ID: MOOD-XXXX-XXXX
    const hexChars = []
    for (let i = 0; i < 8; i++) {
      hexChars.push(Math.floor(rng() * 16).toString(16).toUpperCase())
    }
    const barcodeText = 'MOOD-' + hexChars.slice(0, 4).join('') + '-' + hexChars.slice(4).join('')
    this.setData({ barcodeText })

    // 在 barcodeCanvas 上绘制条码图案（行内尺寸）
    wx.nextTick(() => {
      const query = wx.createSelectorQuery()
      query.select('#barcodeCanvas')
        .fields({ node: true, size: true })
        .exec(res => {
          if (!res || !res[0] || !res[0].node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const W = 140
          const H = 36
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = W * dpr
          canvas.height = H * dpr
          ctx.scale(dpr, dpr)

          // 透明底
          ctx.clearRect(0, 0, W, H)

          // 绘制白色条码竖线
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
          let x = 4
          while (x < W - 4) {
            const w = 1 + Math.floor(rng() * 3)
            if (rng() > 0.3) {
              ctx.fillRect(x, 5, w, H - 10)
            }
            x += w + 1 + Math.floor(rng() * 2)
          }
        })
    })
  },

  /* ==============================================================
     保存 — 相册授权 -> Canvas绘制 -> 保存到手机相册
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

      /* ② Canvas 渲染火苗卡片 -> 导出临时图片 */
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
     Canvas 绘制火苗卡片 -> 导出临时文件路径
     Figma 卡面基准: 304 x 432 px (50_6634)
     WXSS 换算: 1 Figma px = 2 rpx -> Canvas px = rpx / 2
     固定坐标系 304x432，DPR 缩放保证输出清晰度
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

            // canvas 物理像素 = 设计尺寸 x DPR，保证高清输出
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

            let avatarImg = null, catImg = null, fireImg = null
            try {
              [avatarImg, catImg, fireImg] = await Promise.all([
                loadImg(this.data.userAvatar || '/assets/moodRecord/5.png'),
                loadImg('/assets/moodRecord/6.png'),
                loadImg('/assets/moodRecord/fire.png')
              ])
            } catch (e) { /* 图片失败不阻塞，对应元素留空 */ }

            /* ---- 读取数据 ---- */
            const {
              nickname, moodEnergy, currentMoodType,
              shareText, shareTip, eventText, recordTime, barcodeText
            } = this.data

            // 统一文字基线为 top（y = 顶部坐标）
            ctx.textBaseline = 'top'

            // =============================================
            // ① 底层：深色卡牌背景 #302D54
            // =============================================
            ctx.fillStyle = '#302D54'
            ctx.fillRect(0, 0, CARD_W, CARD_H)

            // =============================================
            // ①b 头像行背景带 #260D34（星空之前）
            // =============================================
            ctx.fillStyle = '#260D34'
            ctx.fillRect(0, 0, CARD_W, 55)

            // =============================================
            // ② 中层：星空纹理（简化版径向渐变模拟）
            // =============================================
            const starColors = ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.12)', 'rgba(203,179,255,0.06)']
            for (let i = 0; i < 40; i++) {
              const sx = Math.random() * CARD_W
              const sy = Math.random() * CARD_H
              const sr = 0.5 + Math.random() * 1.5
              ctx.beginPath()
              ctx.arc(sx, sy, sr, 0, 2 * Math.PI)
              ctx.fillStyle = starColors[Math.floor(Math.random() * starColors.length)]
              ctx.fill()
            }

            // =============================================
            // ③ 上层：卡牌紫色外发光遮罩（径向渐变）
            // =============================================
            const glowGrad = ctx.createRadialGradient(CX, 80, 10, CX, 120, 200)
            glowGrad.addColorStop(0, 'rgba(124, 58, 237, 0.12)')
            glowGrad.addColorStop(1, 'transparent')
            ctx.fillStyle = glowGrad
            ctx.fillRect(0, 0, CARD_W, CARD_H)

            // =============================================
            // ④ 顶部：圆形头像 + 昵称 + 日期
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
            ctx.fillText(nickname + '火苗卡', 68, 20)

            ctx.globalAlpha = 0.6
            ctx.fillText(recordTime, 68, 36)
            ctx.globalAlpha = 1.0

            // =============================================
            // ⑤ 火焰图标 + 情绪核心区
            //    发光强度根据 moodEnergy 动态计算
            // =============================================
            const energy = moodEnergy || 0
            const glowR = 4 + energy * 0.24   // 4 ~ 28 px
            const glowA = 0.2 + energy * 0.005 // 0.2 ~ 0.7

            ctx.textAlign = 'center'

            // 绘制火焰图片（带发光 shadow）
            if (fireImg) {
              ctx.save()
              ctx.shadowColor = `rgba(255, 140, 0, ${glowA})`
              ctx.shadowBlur = glowR
              ctx.shadowOffsetX = 0
              ctx.shadowOffsetY = 0
              const fSize = 48
              ctx.drawImage(fireImg, CX - fSize / 2, 58, fSize, fSize)
              ctx.restore()
            }

            // 情绪热度
            ctx.font = '290 12px "Microsoft YaHei", sans-serif'
            ctx.fillStyle = '#ffffff'
            ctx.shadowBlur = 0
            ctx.fillText('情绪热度 ' + moodEnergy + '%', CX, 118)

            // 情绪类型
            ctx.font = '700 20px "Microsoft YaHei", sans-serif'
            ctx.fillText(currentMoodType || '超开心', CX, 142)

            // 情绪黑话
            if (shareText) {
              ctx.font = '290 12px "Microsoft YaHei", sans-serif'
              ctx.fillText(shareText, CX, 166)
            }

            // =============================================
            // ⑥ 语录
            // =============================================
            if (eventText) {
              ctx.font = '290 24px "Microsoft YaHei", sans-serif'
              this._wrapText(ctx, '"' + eventText + '"', CX, 200, 254, 30, 'center')
            }

            ctx.textAlign = 'left'

            // =============================================
            // ⑦ 星猫寄语卡片
            // =============================================
            const aX = PAD, aY = 250, aW = CARD_W - 2 * PAD, aH = 116

            ctx.save()
            this._roundRect(ctx, aX, aY, aW, aH, 24)
            ctx.clip()
            ctx.fillStyle = 'rgba(203, 179, 255, 0.33)'
            ctx.fillRect(aX, aY, aW, aH)
            ctx.restore()

            ctx.save()
            this._roundRect(ctx, aX, aY, aW, aH, 24)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()

            if (catImg) {
              ctx.drawImage(catImg, aX + 9, aY + 24, 58, 58)
            }

            if (shareTip) {
              ctx.fillStyle = '#ffffff'
              ctx.font = '400 16px "Microsoft YaHei", sans-serif'
              this._wrapText(ctx, shareTip, aX + 72, aY + 32, 190, 24)
            }

            // =============================================
            // ⑧ 二维条码（头像同行最右端，白色线条无底图）
            // =============================================
            const bW = 78
            const bH = 18
            const bX = CARD_W - PAD - bW - 4
            const bY = PAD + 2

            // 透明底（不绘制背景）

            // 白色条码竖线
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
            let seedHash = 0
            const bSeed = (recordTime || '') + (nickname || '') + (moodEnergy || 0)
            for (let i = 0; i < bSeed.length; i++) {
              seedHash = ((seedHash << 5) - seedHash) + bSeed.charCodeAt(i)
              seedHash |= 0
            }
            const bRng = () => {
              seedHash = (seedHash * 9301 + 49297) % 233280
              return seedHash / 233280
            }
            let bx = bX + 3
            while (bx < bX + bW - 3) {
              const bw = 1 + Math.floor(bRng() * 3)
              if (bRng() > 0.3) {
                ctx.fillRect(bx, bY + 3, bw, bH - 6)
              }
              bx += bw + 1 + Math.floor(bRng() * 2)
            }

            // 条码文字（条码下方）
            if (barcodeText) {
              ctx.font = '400 7px monospace'
              ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
              ctx.textAlign = 'right'
              ctx.fillText(barcodeText, CARD_W - PAD - 2, bY + bH + 7)
              ctx.textAlign = 'left'
            }

            // =============================================
            // ⑨ 导出临时图片
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

  /* ------ 辅助：Canvas 自动换行绘制文本（textBaseline='top'） ------ */
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
