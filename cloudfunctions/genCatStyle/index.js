// cloudfunctions/genCatStyle/index.js
// 云函数：把用户拍的照片转成「星星猫宇宙」画风的猫
//
// 画风基准（Figma 413_675 / assets/CodeBuddyAssets/413_675/1.png）：
//   · 浅奶油白毛 + 米杏色柔和暗部
//   · 干净纯白底、无场景、无投影（或极浅椭圆影）
//   · 扁平绘本插画，柔边细描边，圆润造型，正面 3/4 坐姿
//   · 小粉鼻、粉内耳、深色豆豆眼，情绪温和治愈
//
// 输入：{ cloudID: 用户照片 cloudID, styleRef?: 画风参考图 cloudID, style?: 'star-cat' }
// 输出：{ ok, fileID: 生成图 cloudID, style, mock }
//
// 流程：取图 buffer → 调 AI 风格迁移 → 上传 generated/ → 返回 cloudID
// 上线时只需替换 callAI() 内部实现（已留 TODO 接入位）。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/* ============================================================
   画风定义（唯一事实来源，前端/云函数共用语义）
   ============================================================ */
const STYLE = {
  key: 'star-cat',
  name: '星星猫宇宙',

  // 参考图（assets/CodeBuddyAssets/413_675/1.png）
  // 真实接入时作为 IP-Adapter / style reference 传入，而非仅靠文字描述
  refHint: 'pale-cream sitting cat, white background, soft storybook illustration',

  prompt: [
    'a single cute cat, in the "star-cat universe" brand illustration style,',
    'pale cream and ivory fur, soft sandy-beige shading on the underside,',
    'pink nose, small rosy inner ears, gentle dark button eyes,',
    'sitting upright, front-facing three-quarter view, calm friendly expression,',
    'clean pure white background, no scene, no props,',
    'flat storybook illustration, soft edges, thin delicate outline,',
    'rounded chubby silhouette, soft warm ambient light, healing cozy mood',
  ].join(' '),

  negativePrompt: [
    'photorealistic, photography, human, person, text, watermark, logo,',
    'busy background, dark background, scenery, furniture,',
    'extra limbs, extra ears, deformed anatomy, blurry, low quality',
  ].join(' '),

  palette: ['#FFFFFF', '#F6EEDF', '#EFDFC6', '#E8C9A8', '#F3B3B6', '#3A3532'],
}

exports.main = async (event /*, context*/) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'anon'
  const { cloudID, styleRef, style = STYLE.key } = event || {}

  if (!cloudID) {
    return { ok: false, err: 'missing cloudID' }
  }

  try {
    /* 1) 取用户照片 buffer */
    const dl = await cloud.downloadFile({ fileID: cloudID })
    const userBuffer = dl.fileContent

    /* 2) 取画风参考图 buffer（可选，作为 style reference） */
    let refBuffer = null
    if (styleRef) {
      try {
        const refDl = await cloud.downloadFile({ fileID: styleRef })
        refBuffer = refDl.fileContent
      } catch (e) {
        console.warn('[genCatStyle] styleRef 拉取失败，仅用文字 prompt:', e)
      }
    }

    /* 3) 调 AI 风格迁移 */
    const { buffer: aiBuffer, mock } = await callAI({
      userBuffer,
      refBuffer,
      prompt: STYLE.prompt,
      negativePrompt: STYLE.negativePrompt,
      style,
    })

    /* 4) 上传生成图到云存储 generated/ */
    const ts = Date.now()
    const upRes = await cloud.uploadFile({
      cloudPath: `generated/${openid}-${ts}.png`,
      fileContent: aiBuffer,
    })

    return {
      ok: true,
      fileID: upRes.fileID,
      style,
      mock: !!mock,
      ts,
    }
  } catch (err) {
    console.error('[genCatStyle] failed:', err)
    return { ok: false, err: (err && err.message) || 'unknown' }
  }
}

/* ============================================================
   AI 调用：默认 MOCK（取决于环境变量），保证 dev 闭环
   约定返回：{ buffer: Buffer, mock: boolean }

   ！上线前需在 云开发控制台 > AI 资源包 配置：
     · 资源包开通「混元图生图」
     · 环境变量 AI_API_KEY  = 密钥（占位，资源包可用时可不填）
     · 环境变量 AI_MOCK     = 'false'   （默认即可，'true' / '1' 才走 mock）

   ⚠️ MOCK 触发条件（任一满足即返回原图当生成图）：
     · 没配 AI_API_KEY
     · AI_MOCK === 'true'
     · AI_MOCK === '1'

   ⚠️ 如果不配 AI_API_KEY 又想走真 AI，需要把 !process.env.AI_API_KEY 这一行
   拿掉；当前的默认值是 false，实际触发 MOCK 是「没有 key 或 mock=1」
   ============================================================ */
async function callAI({ userBuffer /*, refBuffer, prompt, negativePrompt, style */ }) {
  const useMock =
    !process.env.AI_API_KEY ||
    process.env.AI_MOCK === 'true' ||
    process.env.AI_MOCK === '1'

  if (useMock) {
    // mock：原图回灌，前端体感完整（loading → 出图）
    console.warn('[genCatStyle] 当前走 MOCK：未配密钥 或 AI_MOCK=' + process.env.AI_MOCK + '；不会真调 AI')
    return { buffer: userBuffer, mock: true }
  }

  // TODO: 替换为真实 img2img（以 STYLE 为画风基准），例如：
  //
  // ① 腾讯混元生图（图生图）
  //    const r = await fetch('https://hunyuan.tencentcloudapi.com/', {
  //      method: 'POST',
  //      headers: {
  //        'Content-Type': 'application/json',
  //        'Authorization': `Bearer ${process.env.AI_API_KEY}`,
  //      },
  //      body: JSON.stringify({
  //        model: 'hunyuan-image',
  //        image: userBuffer.toString('base64'),        // 用户照片
  //        style_image: refBuffer && refBuffer.toString('base64'), // 画风参考图 ★
  //        prompt: STYLE.prompt,
  //        negative_prompt: STYLE.negativePrompt,
  //        style_strength: 0.75,                        // 保留主体、替换画风
  //        size: '1024x1024',
  //      }),
  //    })
  //    const json = await r.json()
  //    return { buffer: Buffer.from(json.data.image_base64, 'base64'), mock: false }
  //
  // ② Stability AI img2img + image_strength=0.65
  // ③ Replicate: sd-xl + star-cat LoRA（用 reference 图训练的小 LoRA 效果最稳）
  //
  // 关键：refBuffer 必须作为 style reference 传入（IP-Adapter / style transfer），
  //      只靠 prompt 很难稳定复刻 413_675 那种柔白奶油绘本质感。
  //
  // 没接通前，兜底走 mock，不让体验断掉：
  return { buffer: userBuffer, mock: true }
}