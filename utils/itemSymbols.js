/* ============================================================
   utils/itemSymbols.js — 物品象征含义库
   来源：星猫拾遗岛_猫带回道具配置库.xlsx（用户提供）
   key = utils/itemCatalog.js 里的物品 id
   用途：仓库组合时，猫的回信把所选物品的"象征"组合解读成一段内心分析
   ⚠ 仅 catItem 密封时使用；不直接展示给用户（藏在猫的回信表述里）
   ============================================================ */

const ITEM_SYMBOLS = {
  /* ---------- 玩具（13）---------- */
  toy_yarnBall:     '碎片化的思绪、缠绕的心事，代表心里有很多没整理的小事',
  toy_acornSpinner: '摇摆不定、反复纠结的情绪，原地打转的内耗',
  toy_ragdollEar:   '遗失的温柔回忆，曾经被安抚的时刻',
  toy_reedWhistle:  '想说但没能说出口的话，压抑的表达欲',
  toy_woodMarble:   '滚动、飘忽的注意力，难以安定',
  toy_rustyHoop:    '未完成的约定、打不开的心结',
  toy_feather:      '短暂的快乐，转瞬即逝的轻松',
  toy_chessPiece:   '独处、关系里的孤单，找不到对等的回应',
  toy_beanbag:      '内心承载的压力，沉甸甸的情绪',
  toy_paperPlane:   '曾经的期待、落空的愿望',
  toy_musicBox:     '封存的旧情绪，藏在心底的回忆',
  toy_crystalBall:  '短暂的平静，偶然遇见的治愈瞬间',
  toy_clothRabbit:  '受过伤但仍在努力自愈的自己',

  /* ---------- 自然物件 + 小生物（13）---------- */
  nature_pinecone:    '积蓄、沉淀，正在慢慢积攒内心力量',
  nature_grayFeather: '轻盈的念头、短暂自由，渴望片刻松弛',
  nature_smoothStone: '被时间磨平的心绪，反复经历后慢慢平和的伤痛',
  nature_key:         '等待被打开的内心，藏着一段未被看见的心事',
  nature_glassShard:  '破碎之后仍然存在的微光，困境里的细碎美好',
  nature_driedBouquet:'留住的片刻美好，那些不想忘记的温暖瞬间',
  nature_shell:       '遥远的念想，关于远方和自由的小向往',
  nature_mushroom:    '微小的惊喜，角落里藏着的小幸运',
  nature_berries:     '涩中带甜的日常，辛苦里藏着的小甜头',
  nature_goldenLeaf:  '时节流转，悄然而逝的温柔时光',
  nature_grasshopper: '跳跃的活力，片刻轻盈的雀跃感',
  nature_snail:       '慢下来的节奏，不用赶时间的松弛',
  nature_ladybug:     '小小的好运气，悄悄到来的小确幸',

  /* ---------- 衣物（5）---------- */
  clothes_oldSock:      '缺失的陪伴，独留在外的一小份温柔',
  clothes_oldButton:    '散落的联结，本来配成一对的细碎缘分',
  clothes_laceTrim:     '藏起来的柔美，不好意思展示的小精致',
  clothes_fabricPatch:  '缝补的心意，为破损处添的那点温柔',
  clothes_yarnEnd:      '绕在一起的杂乱心绪，慢慢缠成软乎乎的思绪',

  /* ---------- 运动 + 文具（10；源目录「运动」，分类名「文具」）---------- */
  stationery_shuttlecock:    '飞扬的活力，没打完就停下的热闹',
  stationery_pingPong:       '弹来弹去的日常，来回反弹的情绪',
  stationery_tennisBall:     '弹跃的力量，运动里攒下的生命力',
  stationery_jumpRope:       '断了节奏的律动，没跳完的小计划',
  stationery_wristband:      '疲惫的支撑，给手腕托着的那点温柔',
  stationery_pencilStub:     '没写完的思绪，写到一半停下的话',
  stationery_eraser:         '想擦掉的记忆，反复涂改的情绪',
  stationery_bookmark:       '读到一半的故事，暂停下来的时光',
  stationery_pencilSharpener:'慢慢削出来的专注，安静流淌的时间',
  stationery_cork:           '封存的心事，没写完的旧信',
}

/* 按 id 取象征；缺道具时返回空串（不影响其他逻辑） */
function getItemSymbol(id) {
  if (!id) return ''
  return ITEM_SYMBOLS[id] || ''
}

module.exports = { ITEM_SYMBOLS, getItemSymbol }
