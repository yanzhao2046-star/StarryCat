// ============================================
//  youMeOther - 心情你我他
//  统一数据源 allFeeds，source 字段区分「我的/好友」
//  评论/点赞/助力是全局公共数据，双标签实时同步
// ============================================

Page({
  data: {
    filterTab: 'mine',            // 'mine' | 'friend'
    allFeeds: [],                 // 统一数据源 [{...feed, source:'mine'|'friend'}]
    displayList: [],              // 按 filterTab 筛选后的列表
    expandedId: null,
    selfOpenId: 'self_001'
  },

  onShow() {
    this._loadAllFeeds()
  },

  /* =================================================================
     加载全部动态：我的 + 好友 → 合并为 allFeeds → 初始显示
     ================================================================= */
  _loadAllFeeds() {
    const all = []

    // ---- 我的（来自心情库分享） ----
    const sharedFeeds = wx.getStorageSync('sharedFeeds') || []
    sharedFeeds.forEach(f => {
      all.push({
        ...f,
        source: 'mine',
        selfNote: f.selfNote ? '我：' + f.selfNote : '',
        starCatAdvice: f.starCatAdvice ? '星星猫："' + f.starCatAdvice + '"' : '',
        likeCount: f.likeCount || 0,
        boostCount: f.boostCount || 0,
        isLiked: f.isLiked || false,
        isBoosted: f.isBoosted || false,
        commentList: f.commentList || []
      })
    })

    // ---- 好友（mock + storage） ----
    let friendFeeds = wx.getStorageSync('friendFeeds') || []
    if (!friendFeeds.length) {
      friendFeeds = this._mockFriends()
      wx.setStorageSync('friendFeeds', friendFeeds)
    }
    friendFeeds.forEach(f => {
      // storage 里可能已经有运行时效据，用 source 标记区分
      if (!f.source) f.source = 'friend'
      all.push({ ...f })
    })

    this.setData({ allFeeds: all }, () => this._updateDisplay())
  },

  /* =================================================================
     生成好友 mock 数据（仅首次初始化）
     ================================================================= */
  _mockFriends() {
    return [
      {
        id: 'friend_001', source: 'friend',
        emotionName: '超开心', emotionSlang: '今天顺风局', emotionScore: 92,
        time: '2026.07.31.14:20',
        selfNote: 'Cyne：今天游戏连胜五把，太爽了！',
        starCatAdvice: '星星猫："快乐是会传染的，分享给朋友吧"',
        likeCount: 3, boostCount: 0, isLiked: false, isBoosted: false,
        commentList: [
          { _id:'c1', moodId:'friend_001', uid:'u2', nickname:'佳琪',  avatar:'/assets/CodeBuddyAssets/275_972/1.png', content:'你是作业很顺畅吗',   createTime:'2026.07.15 14:15', replyTo:'' },
          { _id:'c2', moodId:'friend_001', uid:'u1', nickname:'Cyne',  avatar:'/assets/CodeBuddyAssets/275_972/2.png', content:'哈哈哈必须的',       createTime:'2026.07.15 15:18', replyTo:'c1', replyToNick:'佳琪' },
          { _id:'c3', moodId:'friend_001', uid:'u2', nickname:'佳琪',  avatar:'/assets/CodeBuddyAssets/275_972/1.png', content:'看你得意的',         createTime:'2026.07.15 15:30', replyTo:'c1', replyToNick:'佳琪' }
        ]
      },
      {
        id: 'friend_002', source: 'friend',
        emotionName: '有点沮丧', emotionSlang: '想哭但哭不出来', emotionScore: 28,
        time: '2026.07.31.12:08',
        selfNote: '补补：今天上班被老板骂了…',
        starCatAdvice: '星星猫："抱抱你，一杯热奶茶或许能治愈今天"',
        likeCount: 1, boostCount: 2, isLiked: true, isBoosted: false,
        commentList: [
          { _id:'c4', moodId:'friend_002', uid:'u3', nickname:'又有',  avatar:'/assets/CodeBuddyAssets/275_972/2.png', content:'星星猫又能长大了',     createTime:'2026.07.16 14:15', replyTo:'' },
          { _id:'c5', moodId:'friend_002', uid:'u1', nickname:'Cyne',  avatar:'/assets/CodeBuddyAssets/275_972/3.png', content:'我要把它养的肥肥的',   createTime:'2026.07.16 14:30', replyTo:'c4', replyToNick:'又有' },
          { _id:'c6', moodId:'friend_002', uid:'u3', nickname:'又有',  avatar:'/assets/CodeBuddyAssets/275_972/2.png', content:'回头送你个减肥神器',   createTime:'2026.07.16 14:32', replyTo:'c4', replyToNick:'又有' }
        ]
      },
      {
        id: 'friend_003', source: 'friend',
        emotionName: '充满干劲', emotionSlang: '冲鸭！', emotionScore: 88,
        time: '2026.07.31.09:45',
        selfNote: '又有：新项目启动，全力以赴的第1天',
        starCatAdvice: '星星猫："保持这个势头，但要记得好好吃饭哦"',
        likeCount: 5, boostCount: 0, isLiked: false, isBoosted: false,
        commentList: []
      },
      {
        id: 'friend_004', source: 'friend',
        emotionName: '烦躁生气', emotionSlang: '今天不宜出门', emotionScore: 22,
        time: '2026.07.30.18:30',
        selfNote: '小鱼：地铁上被人踩了三脚，气死了',
        starCatAdvice: '星星猫："深呼吸，星猫帮你把坏情绪赶跑~"',
        likeCount: 2, boostCount: 4, isLiked: false, isBoosted: true,
        commentList: [
          { _id:'c7', moodId:'friend_004', uid:'u4', nickname:'补补',  avatar:'/assets/CodeBuddyAssets/275_972/3.png', content:'我还有超多作业，和我一起搞搞', createTime:'2026.07.17 14:15', replyTo:'' }
        ]
      },
      {
        id: 'friend_005', source: 'friend',
        emotionName: '感恩', emotionSlang: '遇见你真好', emotionScore: 95,
        time: '2026.07.30.11:15',
        selfNote: '星星：今天收到了好朋友们准备的惊喜生日派对',
        starCatAdvice: '星星猫："被爱包围的人，是最幸福的小火苗"',
        likeCount: 8, boostCount: 0, isLiked: true, isBoosted: false,
        commentList: []
      }
    ]
  },

  /* =================================================================
     按 source 筛选 → displayList
     ================================================================= */
  _updateDisplay() {
    const { filterTab, allFeeds } = this.data
    const list = allFeeds.filter(f => f.source === filterTab)
    this.setData({ displayList: list })
  },

  /* ---- 持久化：从 allFeeds 中按 source 回写 storage ---- */
  _persist(feed) {
    if (!feed) return
    if (feed.source === 'mine') {
      // 回写 sharedFeeds
      const sharedFeeds = wx.getStorageSync('sharedFeeds') || []
      const idx = sharedFeeds.findIndex(f => f.id === feed.id)
      if (idx > -1) {
        // 写入公共字段（评论/点赞/助力全量同步）
        Object.assign(sharedFeeds[idx], this._pickPublic(feed))
        wx.setStorageSync('sharedFeeds', sharedFeeds)
      }
    } else {
      // 回写 friendFeeds
      const friendFeeds = wx.getStorageSync('friendFeeds') || []
      const idx = friendFeeds.findIndex(f => f.id === feed.id)
      if (idx > -1) {
        Object.assign(friendFeeds[idx], this._pickPublic(feed))
        wx.setStorageSync('friendFeeds', friendFeeds)
      }
    }
  },

  /* ---- 提取需要持久化的公共字段 ---- */
  _pickPublic(feed) {
    return {
      likeCount: feed.likeCount,
      isLiked: feed.isLiked,
      boostCount: feed.boostCount,
      isBoosted: feed.isBoosted,
      emotionScore: feed.emotionScore,
      commentList: feed.commentList
    }
  },

  // =========================== 标签切换 ===========================
  onSwitchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.filterTab) return
    this.setData({ filterTab: tab, expandedId: null }, () => this._updateDisplay())
  },

  // =========================== 展开 / 收起 ===========================
  onToggleExpand(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ expandedId: this.data.expandedId === id ? null : id })
  },

  // =========================== 点赞（统一数据源操作） ===========================
  onLikeFeed(e) {
    const id = e.currentTarget.dataset.id
    const { allFeeds } = this.data
    const idx = allFeeds.findIndex(f => f.id === id)
    if (idx === -1) return

    const item = allFeeds[idx]
    item.isLiked = !item.isLiked
    item.likeCount = (item.likeCount || 0) + (item.isLiked ? 1 : -1)

    this.setData({ allFeeds }, () => this._updateDisplay())
    this._persist(item)
  },

  // =========================== 情绪助力 ===========================
  onBoostFeed(e) {
    const id = e.currentTarget.dataset.id
    const { allFeeds } = this.data
    const idx = allFeeds.findIndex(f => f.id === id)
    if (idx === -1) return

    const item = allFeeds[idx]
    if (item.isBoosted) {
      wx.showToast({ title: '已助力过该心情', icon: 'none' })
      return
    }
    item.isBoosted = true
    item.boostCount = (item.boostCount || 0) + 1
    item.emotionScore = Math.min(100, (item.emotionScore || 0) + 5)

    this.setData({ allFeeds }, () => this._updateDisplay())
    this._persist(item)
    wx.showToast({ title: '助力成功！情绪 +5', icon: 'success' })
    getApp().addGrowScore('comment')
  },

  // =========================== 发送评论（统一数据源操作） ===========================
  onSendComment(e) {
    const { content, replyTo, replyToNick, moodId } = e.detail
    if (!content || !moodId) return

    const { allFeeds } = this.data
    const idx = allFeeds.findIndex(f => f.id === moodId)
    if (idx === -1) return

    const newComment = {
      _id: 'c_' + Date.now(),
      moodId,
      uid: this.data.selfOpenId,
      nickname: '我',
      avatar: '/assets/CodeBuddyAssets/275_972/3.png',
      content,
      createTime: this._now(),
      replyTo: replyTo || '',
      replyToNick: replyToNick || ''
    }

    allFeeds[idx].commentList = allFeeds[idx].commentList || []
    allFeeds[idx].commentList.push(newComment)

    this.setData({ allFeeds }, () => this._updateDisplay())
    this._persist(allFeeds[idx])
    wx.showToast({ title: replyTo ? '回复成功' : '评论成功', icon: 'success', duration: 1000 })
    getApp().addGrowScore('comment')
  },

  // ---- 工具：当前时间格式化 ----
  _now() {
    const d = new Date()
    const pad = n => String(n).padStart(2, '0')
    return d.getFullYear() + '.' + pad(d.getMonth()+1) + '.' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  },

  // ---- 底部 tab 切换 ----
  onTabSwitch(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === 'people') return
    let url = ''
    switch (tab) {
      case 'moodIsland':
        url = '/pages/moodAdd/moodAdd'
        break
      case 'moodLib':
        url = '/pages/moodLib/moodLib'
        break
      case 'starTalk':
        url = '/pages/catCare/catCare'
        break
    }
    if (url) wx.redirectTo({ url })
  }
})
