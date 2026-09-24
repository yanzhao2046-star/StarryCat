Component({
  options: {
    multipleSlots: false
  },

  properties: {
    /** 当前选中 tab 的 key */
    current: {
      type: String,
      value: ''
    },
    /** 是否开启底部安全区适配 */
    safeBottom: {
      type: Boolean,
      value: true
    },
    /** 自定义 tab 列表
     *  [{ key, label, icon }]
     */
    tabs: {
      type: Array,
      value: [
        { key: 'room',  label: '房间', icon: '/assets/CodeBuddyAssets/600_141/1.svg' },
        { key: 'mood',  label: '心情', icon: '/assets/CodeBuddyAssets/583_94/3.svg' },
        { key: 'store', label: '仓库', icon: '/assets/CodeBuddyAssets/583_94/2.svg' },
        { key: 'kitchen', label: '厨房', icon: '/assets/CodeBuddyAssets/583_94/1.svg' },
        { key: 'realm', label: '秘境', icon: '/assets/CodeBuddyAssets/583_94/5.svg' }
      ]
    }
  },

  methods: {
    onTap(e) {
      const { key } = e.currentTarget.dataset
      if (!key || key === this.data.current) return
      this.triggerEvent('change', { key })
    }
  }
})