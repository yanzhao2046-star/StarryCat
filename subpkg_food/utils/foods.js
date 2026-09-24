/* ============================================================
   utils/foods.js — 食品配方库（猫粮合成原料）
   12 种原料 = 3×4 宫格，分四类：

   ① 肉类（高营养）：鱼 / 肉 / 鸡腿
   ② 蔬菜（中营养）：南瓜 / 土豆 / 豌豆 / 胡萝卜 / 蘑菇
   ③ 水果（低营养）：猕猴桃 / 牛油果 / 马栗子
   ④ 维生素（每次固定 1 克，合成必备）

   规则：
   · 每点一次原料 → 库存减 1 克、碗中加 1 克（长按退回）
   · 每种原料有各自的「营养值/克」（value），碗中营养值 = Σ 克数 × value
   · 「生成猫粮」必须三类齐全 + 维生素至少 1 克
   · 原料库存每天重置（app.js getCatFoodState 里做日补给）
   ============================================================ */

/* 各原料营养值/克（互不相同，档位：肉类 > 蔬菜 > 水果，维生素为必备催化剂）
   ⚠ icon 必须写成完整字面量路径（依赖分析器只认字面量），且图片放在主包 assets/
     —— 分包页面可用主包资源，主包页面（catRoom 猫带回食材）也可用 ✓ */
const FOODS = [
  /* —— 肉类（高营养）—— */
  { id: 'fish',     name: '鱼',     gram: 92, value: 3.0, tier: 'meat',   icon: '/assets/CodeBuddyAssets/460_1279/12.png' },
  { id: 'meat',     name: '牛肉',   gram: 47, value: 2.6, tier: 'meat',   icon: '/assets/CodeBuddyAssets/460_1279/14.png' },
  { id: 'drumstick', name: '鸡腿',  gram: 56, value: 2.2, tier: 'meat',   icon: '/assets/CodeBuddyAssets/460_1279/5.png'  },

  /* —— 蔬菜（中营养）—— */
  { id: 'pumpkin',  name: '南瓜',   gram: 25, value: 1.8, tier: 'veg',    icon: '/assets/CodeBuddyAssets/460_1279/9.png'  },
  { id: 'potato',   name: '土豆',   gram: 80, value: 1.6, tier: 'veg',    icon: '/assets/CodeBuddyAssets/460_1279/3.png'  },
  { id: 'pea',      name: '豌豆',   gram: 27, value: 1.4, tier: 'veg',    icon: '/assets/CodeBuddyAssets/460_1279/6.png'  },
  { id: 'carrot',   name: '胡萝卜', gram: 23, value: 1.2, tier: 'veg',    icon: '/assets/CodeBuddyAssets/460_1279/8.png'  },
  { id: 'mushroom', name: '蘑菇',   gram: 36, value: 1.0, tier: 'veg',    icon: '/assets/CodeBuddyAssets/460_1279/2.png'  },

  /* —— 水果（低营养）—— */
  { id: 'kiwi',     name: '猕猴桃', gram: 15, value: 0.8, tier: 'fruit',  icon: '/assets/CodeBuddyAssets/460_1279/11.png' },
  { id: 'avocado',  name: '牛油果', gram: 55, value: 0.6, tier: 'fruit',  icon: '/assets/CodeBuddyAssets/460_1279/10.png' },
  { id: 'chestnut', name: '马栗子', gram: 11, value: 0.4, tier: 'fruit',  icon: '/assets/CodeBuddyAssets/460_1279/4.png'  },

  /* —— 维生素：每次必须 1 克 —— */
  { id: 'vitamin',  name: '维生素', gram: 12, value: 2.0, tier: 'vitamin', icon: '/assets/CodeBuddyAssets/460_1279/13.png' }
]

/* 分类中文名（用于校验提示与角标） */
const TIER_LABELS = {
  meat:   '肉类',
  veg:    '蔬菜',
  fruit:  '水果',
  vitamin: '维生素'
}

/* 维生素合成时至少需要 1 克 */
const VITAMIN_MIN_PER_FEED = 1

const FOODS_BY_ID = FOODS.reduce((m, f) => { m[f.id] = f; return m }, {})

/* 根据食物库生成一份全新库存（每日补给用） */
function defaultStock() {
  return FOODS.reduce((m, f) => { m[f.id] = f.gram; return m }, {})
}

/* 全 0 库存：厨房初始没有原料，全部等猫叼回（bringFood） */
function emptyStock() {
  return FOODS.reduce((m, f) => { m[f.id] = 0; return m }, {})
}

/* 碗中营养值 = Σ(克数 × 营养值/克)，保留 1 位小数 */
function calcNutrition(bowl) {
  if (!Array.isArray(bowl)) return 0
  const n = bowl.reduce((sum, b) => {
    const f = FOODS_BY_ID[b.foodId]
    return sum + (f ? (b.gram || 0) * f.value : 0)
  }, 0)
  return Math.round(n * 10) / 10
}

/* 碗中总克数 */
function calcBowlGram(bowl) {
  if (!Array.isArray(bowl)) return 0
  return bowl.reduce((sum, b) => sum + (b.gram || 0), 0)
}

/* 配方校验：碗中至少 3 种不同原料即可生成（不限分类），营养值按实际原料计
   返回 { ok, missing: [提示文本...] } */
function validateBowl(bowl) {
  const kinds = (bowl || []).filter(b => (b.gram || 0) > 0).length
  if (kinds < 3) {
    return { ok: false, missing: ['原料种类不足（至少 3 种，当前 ' + kinds + ' 种）'] }
  }
  return { ok: true, missing: [] }
}

module.exports = {
  FOODS,
  FOODS_BY_ID,
  TIER_LABELS,
  VITAMIN_MIN_PER_FEED,
  getFoodById(id) { return FOODS_BY_ID[id] || null },
  defaultStock,
  emptyStock,
  calcNutrition,
  calcBowlGram,
  validateBowl
}
