// ============================================
//  comment-panel 评论面板组件（支持楼中楼回复互动）
//  标准评论数据结构：
//  { _id, moodId, uid, nickname, avatar,
//    content, createTime, replyTo, replyToNick }
// ============================================

Component({

  /* ===========================
     对外属性
     =========================== */
  properties: {
    list: {
      type: Array,
      value: [],
      observer: '_onListChange'
    },
    targetMoodId: {
      type: String,
      value: ''
    },
    selfOpenId: {
      type: String,
      value: ''
    }
  },

  /* ===========================
     内部数据
     =========================== */
  data: {
    inputValue: '',
    inputFocus: false,
    comments: [],          // 分组后的评论树 [{...cmt, replies:[]}]
    loading: false,
    isEmpty: true,
    replyTarget: { _id: '', nickname: '' }   // 当前回复目标
  },

  /* ===========================
     生命周期
     =========================== */
  lifetimes: {
    attached() {
      this._groupComments(this.properties.list)
    }
  },

  /* ===========================
     方法
     =========================== */
  methods: {

    /* ---- 监听外部数据变更 ---- */
    _onListChange(newVal) {
      this._groupComments(newVal || [])
    },

    /* ---- 将平铺评论分组为父评论 + 子回复树 ---- */
    _groupComments(rawList) {
      const loading = !rawList
      const list = rawList || []

      if (!list.length) {
        this.setData({ comments: [], isEmpty: true, loading })
        return
      }

      // 先建昵称映射（replyTo → nickname）
      const nickMap = {}
      list.forEach(c => { nickMap[c._id] = c.nickname })

      // 分离顶层评论和回复
      const topComments = []
      const replyMap = {}

      list.forEach(c => {
        if (!c.replyTo) {
          const comment = { ...c, replies: [] }
          topComments.push(comment)
          replyMap[c._id] = comment.replies
        }
      })

      // 把回复挂到对应父评论下，并补全 replyToNick
      list.forEach(c => {
        if (c.replyTo && replyMap[c.replyTo]) {
          replyMap[c.replyTo].push({
            ...c,
            replyToNick: nickMap[c.replyTo] || ''
          })
        }
      })

      this.setData({
        comments: topComments,
        isEmpty: topComments.length === 0,
        loading
      })
    },

    /* ---- 输入框同步 ---- */
    onInput(e) {
      this.setData({ inputValue: e.detail.value })
    },

    /* ---- 点击回复按钮 → 设置回复目标 ---- */
    onReplyTap(e) {
      const { id, nick } = e.currentTarget.dataset
      this.setData({
        replyTarget: { _id: id, nickname: nick },
        inputFocus: true
      })
    },

    /* ---- 取消回复 ---- */
    onCancelReply() {
      this.setData({
        replyTarget: { _id: '', nickname: '' },
        inputFocus: false
      })
    },

    /* ---- 发送评论 / 回复 ---- */
    onSend() {
      const content = this.data.inputValue.trim()
      if (!content) return

      const { replyTarget } = this.data

      this.triggerEvent('sendComment', {
        content,
        replyTo: replyTarget._id || '',
        replyToNick: replyTarget.nickname || '',
        moodId: this.properties.targetMoodId
      })

      // 清空并重置
      this.setData({
        inputValue: '',
        replyTarget: { _id: '', nickname: '' },
        inputFocus: false
      })
    }
  }
})
