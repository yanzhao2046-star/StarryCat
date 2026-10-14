/* ============================================================
   utils/itemCatalog.js — 猫带回物品的素材目录

   由来：猫出门回家时会「带回物品」，物品对象写进 storage `catItems`，
        物品库（pages/catItem）同源读取。本文件是唯一一份硬编码目录。

   目录构成：
     · TOY_CATALOG     玩具 13 件，带稀有度 tier
     · NATURE_CATALOG  自然类 13 件（无稀有度标记，按常见处理）
     · CLOTHES_CATALOG 衣物 5 件（无稀有度标记，按常见处理）
     · LEGACY_ITEMS    老素材 7 件（401_620/1~7.svg，跨 toys / sports / clothes / nature）

   稀有度（tier）：按素材批次定义，数字越小越稀有、被带回的频率越低
     tier 1 = 极为稀有（4 件）
     tier 2 = 稀有    （6 件）
     tier 3 = 常见    （3 件）
   权重只影响「已经决定带回物品」之后抽哪一件，不影响带回事件本身的概率
   （那是 catBehavior 引擎结算的，见 utils/catBehavior.js）。

   ⚠ icon 必须写成完整字面量路径（依赖分析器只认字面量），否则不会被打进包
   ============================================================ */

/* 稀有度权重（可自由调）：tier1 极为稀有 / tier2 稀有 / tier3 常见 */
const TIER_WEIGHT = { 1: 1, 2: 4, 3: 12 }
/* 老素材（401_620 的 7 件 SVG，跨 nature / clothes / toys / sports）统一权重 */
const LEGACY_WEIGHT = 12
/* 自然类（13 件）：素材无稀有度标记，按「常见」处理，与老素材同权 */
const NATURE_WEIGHT = 12
/* 衣物（5 件）：素材无稀有度标记，按「常见」处理 */
const CLOTHES_WEIGHT = 12

/* ---------- 玩具目录（13 件）----------
   素材：F:\...\参考\猫\风格\确定风格\物品\玩具\t_*.png
   已按「裁到不透明边界 → 统一留白 → 200×200」打包到 assets/CodeBuddyAssets/items/toys/ */
const TOY_CATALOG = [
  /* —— tier 1：极为稀有 —— */
  { id: 'toy_ragdollEar',   title: '布偶耳朵',   tier: 1, icon: '/assets/CodeBuddyAssets/items/toys/toy_ragdollEar.png' },
  { id: 'toy_woodMarble',   title: '光滑木弹珠', tier: 1, icon: '/assets/CodeBuddyAssets/items/toys/toy_woodMarble.png' },
  { id: 'toy_yarnBall',     title: '褪色毛线球', tier: 1, icon: '/assets/CodeBuddyAssets/items/toys/toy_yarnBall.png' },
  { id: 'toy_acornSpinner', title: '橡果小陀螺', tier: 1, icon: '/assets/CodeBuddyAssets/items/toys/toy_acornSpinner.png' },

  /* —— tier 2：稀有 —— */
  { id: 'toy_reedWhistle',  title: '空心芦苇哨', tier: 2, icon: '/assets/CodeBuddyAssets/items/toys/toy_reedWhistle.png' },
  { id: 'toy_chessPiece',   title: '棋子',       tier: 2, icon: '/assets/CodeBuddyAssets/items/toys/toy_chessPiece.png' },
  { id: 'toy_beanbag',      title: '沙包',       tier: 2, icon: '/assets/CodeBuddyAssets/items/toys/toy_beanbag.png' },
  { id: 'toy_rustyHoop',    title: '生锈铁环',   tier: 2, icon: '/assets/CodeBuddyAssets/items/toys/toy_rustyHoop.png' },
  { id: 'toy_feather',      title: '羽毛',       tier: 2, icon: '/assets/CodeBuddyAssets/items/toys/toy_feather.png' },
  { id: 'toy_paperPlane',   title: '纸飞机',     tier: 2, icon: '/assets/CodeBuddyAssets/items/toys/toy_paperPlane.png' },

  /* —— tier 3：常见 —— */
  { id: 'toy_musicBox',     title: '八音盒',     tier: 3, icon: '/assets/CodeBuddyAssets/items/toys/toy_musicBox.png' },
  { id: 'toy_clothRabbit',  title: '布兔子',     tier: 3, icon: '/assets/CodeBuddyAssets/items/toys/toy_clothRabbit.png' },
  { id: 'toy_crystalBall',  title: '水晶球',     tier: 3, icon: '/assets/CodeBuddyAssets/items/toys/toy_crystalBall.png' },
]

/* ---------- 自然类目录（13 件）----------
   素材：F:\...\参考\猫\风格\确定风格\物品\自然类物件\n_*.png
   已按同一规则（裁边 → 统一留白 → 200×200）打包到 assets/CodeBuddyAssets/items/nature/
   无稀有度标记 → 统一按「常见」权重带回 */
const NATURE_CATALOG = [
  { id: 'nature_glassShard',   title: '彩色玻璃碎片', category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_glassShard.png' },
  { id: 'nature_driedBouquet', title: '干花束',       category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_driedBouquet.png' },
  { id: 'nature_smoothStone',  title: '光滑石头',     category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_smoothStone.png' },
  { id: 'nature_grayFeather',  title: '灰蓝羽毛',     category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_grayFeather.png' },
  { id: 'nature_goldenLeaf',   title: '金黄梧桐叶',   category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_goldenLeaf.png' },
  { id: 'nature_shell',        title: '小贝壳',       category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_shell.png' },
  { id: 'nature_mushroom',     title: '小蘑菇',       category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_mushroom.png' },
  { id: 'nature_pinecone',     title: '小松果',       category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_pinecone.png' },
  { id: 'nature_key',          title: '钥匙',         category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_key.png' },
  { id: 'nature_berries',      title: '野莓',         category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_berries.png' },

  /* —— 自然力的小动物 —— */
  { id: 'nature_snail',        title: '蜗牛',         category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_snail.png' },
  { id: 'nature_ladybug',      title: '瓢虫',         category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_ladybug.png' },
  { id: 'nature_grasshopper',  title: '蚱蜢',         category: 'nature', icon: '/assets/CodeBuddyAssets/items/nature/nature_grasshopper.png' },
]

/* ---------- 衣物目录（5 件）----------
   素材：F:\...\参考\猫\风格\确定风格\物品\衣物\c_*.png
   已按同一规则打包到 assets/CodeBuddyAssets/items/clothes/
   无稀有度标记 → 统一按「常见」权重带回 */
const CLOTHES_CATALOG = [
  { id: 'clothes_yarnEnd',     title: '毛线头',   category: 'clothes', icon: '/assets/CodeBuddyAssets/items/clothes/clothes_yarnEnd.png' },
  { id: 'clothes_fabricPatch', title: '花布贴',   category: 'clothes', icon: '/assets/CodeBuddyAssets/items/clothes/clothes_fabricPatch.png' },
  { id: 'clothes_laceTrim',    title: '蕾丝碎边', category: 'clothes', icon: '/assets/CodeBuddyAssets/items/clothes/clothes_laceTrim.png' },
  { id: 'clothes_oldButton',   title: '旧纽扣',   category: 'clothes', icon: '/assets/CodeBuddyAssets/items/clothes/clothes_oldButton.png' },
  { id: 'clothes_oldSock',     title: '旧棉袜',   category: 'clothes', icon: '/assets/CodeBuddyAssets/items/clothes/clothes_oldSock.png' },
]

/* ---------- 老素材池（401_620/1~7.svg 与名称/分类一一对应）
   8.svg 是 62×22 横条素材、9.svg 是空图，不作物品图标用 */
const LEGACY_ITEMS = [
  { icon: '/assets/CodeBuddyAssets/401_620/1.svg', title: '不怕人的小老鼠',       category: 'nature' },
  { icon: '/assets/CodeBuddyAssets/401_620/2.svg', title: '一根蓝色的羽毛',       category: 'nature' },
  { icon: '/assets/CodeBuddyAssets/401_620/3.svg', title: '一只干干净净的小袜子', category: 'clothes' },
  { icon: '/assets/CodeBuddyAssets/401_620/4.svg', title: '不知道谁家的拨浪鼓',   category: 'toys' },
  { icon: '/assets/CodeBuddyAssets/401_620/5.svg', title: '缺了个角的积木',       category: 'toys' },
  { icon: '/assets/CodeBuddyAssets/401_620/6.svg', title: '瘪了一点的网球',       category: 'sports' },
  { icon: '/assets/CodeBuddyAssets/401_620/7.svg', title: '坐得很端正的玩具熊',   category: 'toys' },
]

/* 加权随机：list 每项自带 weight，缺省按 1 计 */
function pickWeighted(list) {
  let total = 0
  for (let i = 0; i < list.length; i++) total += list[i].weight || 1
  let r = Math.random() * total
  for (let i = 0; i < list.length; i++) {
    r -= list[i].weight || 1
    if (r < 0) return list[i]
  }
  return list[list.length - 1]
}

/* 猫带回一件物品（老素材 + 玩具 + 自然类 + 衣物 合并加权抽），返回 { icon, title, category, tier } */
function pickBringItem() {
  const toys = TOY_CATALOG.map(t => ({
    icon: t.icon,
    title: t.title,
    category: 'toys',
    tier: t.tier,
    weight: TIER_WEIGHT[t.tier] || 1,
  }))
  const nature = NATURE_CATALOG.map(n => ({ ...n, weight: NATURE_WEIGHT }))
  const clothes = CLOTHES_CATALOG.map(c => ({ ...c, weight: CLOTHES_WEIGHT }))
  const legacy = LEGACY_ITEMS.map(it => ({ ...it, weight: LEGACY_WEIGHT }))
  const src = pickWeighted(legacy.concat(toys).concat(nature).concat(clothes))
  return { icon: src.icon, title: src.title, category: src.category, tier: src.tier }
}

module.exports = {
  TIER_WEIGHT,
  LEGACY_WEIGHT,
  NATURE_WEIGHT,
  CLOTHES_WEIGHT,
  TOY_CATALOG,
  NATURE_CATALOG,
  CLOTHES_CATALOG,
  LEGACY_ITEMS,
  pickWeighted,
  pickBringItem,
}
