/* ============================================================
   imgSecCheck — 图片内容安全审核云函数
   用于头像等用户上传图片的违规内容检测
   ============================================================ */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { fileID } = event

  if (!fileID) {
    return { code: -1, msg: '缺少 fileID 参数' }
  }

  try {
    // 1. 从云存储下载图片文件
    const downloadRes = await cloud.downloadFile({ fileID })
    const buffer = downloadRes.fileContent

    // 2. 调用微信图片安全检测 API
    const checkRes = await cloud.openapi.security.imgSecCheck({
      media: {
        contentType: 'image/png',
        value: buffer
      }
    })

    return {
      code: 0,
      msg: '内容安全审核通过',
      traceId: checkRes.traceId || ''
    }
  } catch (err) {
    // errCode 87014 表示内容违规
    if (err.errCode === 87014) {
      return {
        code: 87014,
        msg: '所发布内容含违规信息'
      }
    }

    console.error('[imgSecCheck] 审核异常:', err)
    return {
      code: -1,
      msg: err.message || '内容安全审核服务异常'
    }
  }
}
