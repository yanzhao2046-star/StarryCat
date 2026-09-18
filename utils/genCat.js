// utils/genCat.js — 拍猫后端 AI 风格生成客户端封装
//
// 画风基准：assets/CodeBuddyAssets/413_675/1.png（星星猫宇宙 · 浅奶油绘本猫）
//   首次调用时把这张参考图上传到云存储 style/ 目录并缓存 cloudID，
//   随请求一起交给云函数作为 style reference（IP-Adapter / 风格迁移参考）。
//
// 流程：
//   1) ensureStyleRef()      — 上传/复用画风参考图 cloudID
//   2) wx.cloud.uploadFile   — 上传用户照片到 tmp/，拿到 cloudID
//   3) wx.cloud.callFunction — genCatStyle 生成画风版猫，回传新 cloudID
//   4) wx.cloud.getTempFileURL — cloudID → https 临时 URL 供 <image> 显示
//
// 调用前需保证：app.js 已 init cloud（wx.cloud.init）且云函数 genCatStyle 已部署。

const STYLE_REF_PATH = '/assets/CodeBuddyAssets/413_675/1.png'
const STYLE_REF_CACHE_KEY = 'styleRefCloudID'

/* 画风参考图只上传一次，之后走本地缓存 */
function ensureStyleRef() {
  return new Promise((resolve) => {
    try {
      const cached = wx.getStorageSync(STYLE_REF_CACHE_KEY)
      if (cached) {
        resolve(cached)
        return
      }
    } catch (e) { /* 读缓存失败则重新上传 */ }

    wx.cloud.uploadFile({
      cloudPath: 'style/star-cat-ref.png',
      filePath: STYLE_REF_PATH,
      success: (res) => {
        try {
          wx.setStorageSync(STYLE_REF_CACHE_KEY, res.fileID)
        } catch (e) { /* 缓存失败不影响本次调用 */ }
        resolve(res.fileID)
      },
      fail: (err) => {
        // 参考图上传失败不阻断主流程，云函数会退化为纯文字 prompt
        console.warn('[genCat] 画风参考图上传失败，改用纯 prompt:', err)
        resolve('')
      },
    })
  })
}

function genCatFromPhoto(localPath, opts) {
  opts = opts || {}
  const onProgress = opts.onProgress || function () {}

  return new Promise((resolve, reject) => {
    onProgress(6, '准备画风基准…')

    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)

    // ① 先保证画风参考图就位
    ensureStyleRef().then((styleRef) => {
      onProgress(14, '上传到云端…')

      // ② 上传用户照片到 tmp/
      wx.cloud.uploadFile({
        cloudPath: `tmp/userPhoto-${ts}-${rand}.jpg`,
        filePath: localPath,
        success: (upRes) => {
          const photoID = upRes.fileID
          onProgress(35, '画师正在创作…')

          // ③ 调云函数生成（带上画风参考）
          wx.cloud.callFunction({
            name: 'genCatStyle',
            data: {
              cloudID: photoID,
              styleRef,
              style: 'star-cat',
            },
            success: (callRes) => {
              const r = callRes.result || {}
              if (!r.ok || !r.fileID) {
                reject(new Error(r.err || 'AI 生成失败'))
                return
              }
              onProgress(82, '即将完成…')

              // ④ cloudID → 临时 https URL
              wx.cloud.getTempFileURL({
                fileList: [r.fileID],
                success: (urlRes) => {
                  onProgress(100, '完成')
                  const file = urlRes.fileList[0] || {}
                  resolve({
                    url: file.tempFileURL,
                    fileID: r.fileID,
                    mock: !!r.mock,
                  })
                },
                fail: (e) => reject(e),
              })
            },
            fail: (e) => reject(e),
          })
        },
        fail: (e) => reject(e),
      })
    })
  })
}

module.exports = { genCatFromPhoto, ensureStyleRef, STYLE_REF_PATH }