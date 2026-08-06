const app = getApp();
const STORAGE_KEY = 'catCareMessages';

// 录音管理器
const recorder = wx.getRecorderManager();
let recordTimer = null;

Page({
  data: {
    messages: [],
    inputText: '',
    scrollToView: '',
    isTyping: false,
    current: 'catCare',
    messageId: 0,
    userAvatar: '/assets/moodAdd/5.png',   // 用户头像（优先 onboard 头像）
    moodContext: null,                      // 心情上下文（供 AI 参考）

    // 输入栏
    voiceMode: false,                       // 语音 / 文字模式
    showEmojiPanel: false,                  // 表情面板
    showMorePanel: false,                    // 更多功能面板
    isRecording: false,                     // 是否正在录音
    inputFocus: false,                      // 输入框焦点

    // 表情数据（微信聊天常用）
    emojiList: [
      '😀','😃','😄','😁','😅','😂','🤣','😊','😇','🙂','😉','😌',
      '😍','🥰','😘','😋','😜','😝','😎','🤓','🧐','😏','😒','😔',
      '😟','😕','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡',
      '💀','☠️','😻','💋','❤️','💔','💯','✨','🔥','🌈','🎉','👍',
      '👎','🙏','💪','🌸','🌺','🍀','⭐','🌙','☀️','☁️','💧','🎵'
    ]
  },

  async onLoad() {
    this.loadUserAvatar();
    await this.loadMoodContext();
    this.initRecorder();

    // 优先恢复本地聊天记录，无历史才生成问候语
    const saved = this.restoreMessages();
    if (saved) {
      console.log('[catCare] 已恢复 ' + saved.length + ' 条聊天记录');
    } else {
      this.initChat();
    }
  },

  onShow() {
    // 如果 messages 为空（页面被 recreate），尝试恢复
    if (!this.data.messages || this.data.messages.length === 0) {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (saved && saved.messages && saved.messages.length > 0) {
        console.log('[catCare] onShow 检测到空 messages，从 Storage 恢复');
        this.setData({
          messages: saved.messages,
          messageId: saved.messageId || saved.messages.length
        }, () => this.scrollToBottom());
      }
    }
  },

  onHide() {
    console.log('[catCare] onHide 触发，保存聊天记录');
    this.closeAllPanels();
    this.stopRecord();
    this.saveMessages();
  },

  onUnload() {
    console.log('[catCare] onUnload 触发，保存聊天记录');
    this.saveMessages();
  },

  /* ========== 加载用户头像 ========== */
  loadUserAvatar() {
    try {
      const profile = wx.getStorageSync('userProfile');
      if (profile && profile.avatarPath) {
        this.setData({ userAvatar: profile.avatarPath });
      }
    } catch (e) {
      // 保持默认头像
    }
  },

  /* ========== 初始化录音管理器 ========== */
  initRecorder() {
    recorder.onStart(() => {
      console.log('[catCare] 录音开始');
      recordTimer = setTimeout(() => {
        wx.showToast({ title: '录音最长 60 秒', icon: 'none' });
        this.stopRecord();
      }, 59000);
    });

    recorder.onStop((res) => {
      console.log('[catCare] 录音结束', res);
      this.setData({ isRecording: false });
      if (recordTimer) { clearTimeout(recordTimer); recordTimer = null; }
      // 后续可接入语音识别 API
      wx.showToast({ title: '语音已记录（' + Math.round(res.duration / 1000) + 's）', icon: 'none' });
    });

    recorder.onError((err) => {
      console.error('[catCare] 录音错误:', err);
      this.setData({ isRecording: false });
      wx.showToast({ title: '录音失败，请重试', icon: 'none' });
    });
  },

  stopRecord() {
    try { recorder.stop(); } catch (e) { /* ignore */ }
  },

  /* ========== 加载心情上下文（从云函数拉取最近心情） ========== */
  async loadMoodContext() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: { action: 'getMoods', skip: 0, limit: 7 }
      });

      if (res.result && res.result.code === 0 && res.result.data && res.result.data.length > 0) {
        const moodContext = this.buildMoodContext(res.result.data);
        this.setData({ moodContext });
        console.log('[catCare] moodContext 已加载:', JSON.stringify(moodContext).substring(0, 200));
      } else {
        this.setData({ moodContext: null });
      }
    } catch (e) {
      console.error('[catCare] 加载心情上下文失败:', e);
      this.setData({ moodContext: null });
    }
  },

  /* 从云函数返回的心情记录构建 AI 上下文 */
  buildMoodContext(records) {
    const negativeMoods = ['有点沮丧', '烦躁生气', '想歇一会', '有点迷糊'];
    const positiveMoods = ['超开心', '偷偷小得意', '充满干劲', '认真专注', '感恩', '热心劳动', '团队合作', '平和放松'];

    let posCount = 0;
    let negCount = 0;

    const moods = records.map(r => {
      if (negativeMoods.includes(r.currentMoodType)) negCount++;
      if (positiveMoods.includes(r.currentMoodType)) posCount++;
      return {
        mood: r.currentMoodType,
        energy: r.moodEnergy,
        time: r.recordTime || r.time || ''
      };
    });

    let dominant = 'neutral';
    if (negCount > posCount) dominant = 'negative';
    if (posCount > negCount) dominant = 'positive';

    return { moods, dominant, total: records.length };
  },

  /* ========== 初始化对话 ========== */
  initChat() {
    const greeting = this.getGreeting();
    const msgs = [this.createMsg('ai', greeting, true)];
    const newId = 1;
    this.setData({ messages: msgs, messageId: newId }, () => {
      this.scrollToBottom();
      this.saveMessages(msgs, newId);
    });
  },

  /* 根据时间生成问候语 */
  getGreeting() {
    const hour = new Date().getHours();
    const moodContext = this.data.moodContext;

    let timeGreeting;
    if (hour < 6) timeGreeting = '夜深了，还没休息呀～';
    else if (hour < 9) timeGreeting = '早上好呀，新的一天开始了！';
    else if (hour < 12) timeGreeting = '上午好，今天心情怎么样？';
    else if (hour < 14) timeGreeting = '中午好，记得按时吃饭哦～';
    else if (hour < 18) timeGreeting = '下午好，喝杯茶歇一歇吧～';
    else if (hour < 22) timeGreeting = '晚上好，忙了一天累不累？';
    else timeGreeting = '这么晚还不睡，星星猫陪着你～';

    const lines = [];
    lines.push('喵～ ' + timeGreeting);

    // 结合心情上下文生成问候
    if (moodContext && moodContext.moods && moodContext.moods.length > 0) {
      const latest = moodContext.moods[0];
      const dominant = moodContext.dominant;
      if (dominant === 'negative') {
        lines.push('看到你最近心情有些低落呢…别担心，星星猫会一直在这里陪你～');
        lines.push('想不想和我聊聊，把心里的不开心都倒出来？');
      } else if (dominant === 'positive') {
        lines.push('你最近心情很不错呢！' + latest.mood + '的时候整个人都在发光喵～');
        lines.push('今天有什么开心的事想和我分享吗？');
      } else {
        lines.push('我是你的星星猫伙伴，无论开心还是难过，我都在这儿陪着你～');
        lines.push('来跟我说说今天发生了什么事吧！');
      }
    } else {
      lines.push('我是你的星星猫伙伴，无论开心还是难过，我都在这儿陪着你～');
      lines.push('来记录一下今天的心情吧！点击  情绪岛  就能找到心情标签哦');
    }
    return lines.join('\n');
  },

  /* ========== 消息工具 ========== */
  createMsg(role, content, showTime) {
    const now = new Date();
    const pad = n => n < 10 ? '0' + n : n;
    const timeText = pad(now.getHours()) + ':' + pad(now.getMinutes());

    return {
      id: 'msg-' + (this.data.messageId + 1),
      role,
      content,
      timeText,
      showTime: !!showTime,
      timestamp: now.getTime()
    };
  },

  appendMsg(role, content, showTime) {
    const msg = this.createMsg(role, content, showTime);
    const newId = this.data.messageId + 1;
    const newMessages = [...this.data.messages, msg];
    this.setData({
      messages: newMessages,
      messageId: newId
    });
    // 直接传入新数组，不依赖 this.data 的同步时机
    this.saveMessages(newMessages, newId);
  },

  /* ========== 聊天记录持久化 ========== */

  saveMessages(msgs, msgId) {
    msgs = msgs || this.data.messages;
    msgId = (msgId !== undefined) ? msgId : this.data.messageId;
    if (!msgs || msgs.length === 0) {
      console.log('[catCare] saveMessages 跳过 — messages 为空');
      return;
    }
    try {
      wx.setStorageSync(STORAGE_KEY, {
        messages: msgs,
        messageId: msgId,
        savedAt: Date.now()
      });
      console.log('[catCare] 已保存 ' + msgs.length + ' 条聊天记录到本地');
    } catch (e) {
      console.warn('[catCare] 保存聊天记录失败:', e);
    }
  },

  restoreMessages() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY);
      if (!saved || !saved.messages || saved.messages.length === 0) {
        console.log('[catCare] 本地无聊天记录，将生成问候语');
        return null;
      }

      // 超过 24 小时的记录视为过期
      if (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) {
        console.log('[catCare] 聊天记录已过期，清除');
        wx.removeStorageSync(STORAGE_KEY);
        return null;
      }

      this.setData({
        messages: saved.messages,
        messageId: saved.messageId || saved.messages.length
      });
      console.log('[catCare] 恢复成功 — 共 ' + saved.messages.length + ' 条');
      this.scrollToBottom();
      return saved.messages;
    } catch (e) {
      console.warn('[catCare] 恢复聊天记录失败:', e);
      return null;
    }
  },

  /* ========== 发送消息 ========== */
  onSend() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isTyping) return;

    this.closeAllPanels();

    // 追加用户消息
    const showTime = this.shouldShowTime();
    this.appendMsg('user', text, showTime);
    this.setData({ inputText: '' });
    this.scrollToBottom();

    // 调用云端混元 AI
    this.callHunyuan(text);
  },

  /* ========== 调用混元 AI（云函数） ========== */
  async callHunyuan(userText) {
    this.setData({ isTyping: true });
    this.scrollToBottom();

    // 构建传给 AI 的消息列表（系统提示词在云函数中注入）
    const recentMessages = this.data.messages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }));

    try {
      const res = await wx.cloud.callFunction({
        name: 'moodOperations',
        data: {
          action: 'chatHunyuan',
          messages: recentMessages,
          moodContext: this.data.moodContext
        }
      });

      this.setData({ isTyping: false });

      if (res.result && res.result.code === 0) {
        const reply = res.result.data.reply;
        const showTime = this.shouldShowTime();
        this.appendMsg('ai', reply, showTime);

        // 云端成长加分（云函数自动防刷去重）
        wx.cloud.callFunction({
          name: 'moodOperations',
          data: { action: 'updateGrowData', type: 'chat' }
        }).then(growRes => {
          if (growRes.result && growRes.result.code === 0) {
            wx.showToast({ title: '🔥 +3 Token  💎 +1 智慧  💜 +1 懂你', icon: 'none', duration: 1500 });
          }
        }).catch(() => {});
      } else {
        const errMsg = (res.result && res.result.msg) || '星星猫暂时不在服务区，请稍后再试～';
        this.appendMsg('ai', '😿 ' + errMsg, false);
      }
    } catch (err) {
      console.error('[catCare] 云函数调用失败:', err);
      this.setData({ isTyping: false });
      this.appendMsg('ai', '😿 网络好像不太稳定，星星猫正在努力连接中…请稍后再试～', false);
    }

    this.scrollToBottom();
  },

  shouldShowTime() {
    const msgs = this.data.messages;
    if (msgs.length === 0) return true;
    const last = msgs[msgs.length - 1];
    const now = Date.now();
    return (now - last.timestamp) > 3 * 60 * 1000;
  },

  /* ========== 输入框 ========== */
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  /* ========== 语音模式 ========== */

  onVoiceToggle() {
    this.closeAllPanels();
    this.setData({ voiceMode: !this.data.voiceMode });
  },

  onVoiceStart() {
    if (this.data.isRecording) return;
    this.setData({ isRecording: true });
    recorder.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    });
  },

  onVoiceEnd() {
    if (!this.data.isRecording) return;
    this.stopRecord();
  },

  onVoiceCancel() {
    if (!this.data.isRecording) return;
    this.stopRecord();
    wx.showToast({ title: '已取消', icon: 'none' });
  },

  /* ========== 表情面板 ========== */

  onEmojiTap() {
    this.setData({
      showEmojiPanel: !this.data.showEmojiPanel,
      showMorePanel: false
    });
  },

  onEmojiPick(e) {
    const emoji = e.currentTarget.dataset.emoji;
    const newText = this.data.inputText + emoji;
    this.setData({ inputText: newText, inputFocus: true });
  },

  /* ========== + 更多面板 ========== */

  onMoreTap() {
    this.setData({
      showMorePanel: !this.data.showMorePanel,
      showEmojiPanel: false
    });
  },

  onChooseImage() {
    this.closeAllPanels();
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        console.log('[catCare] 选择了图片:', res.tempFilePaths);
        // 暂不支持图片聊天，提示用户
        wx.showToast({ title: '图片功能开发中', icon: 'none' });
      }
    });
  },

  onTakePhoto() {
    this.closeAllPanels();
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        console.log('[catCare] 拍摄了照片:', res.tempFilePaths);
        wx.showToast({ title: '拍照功能开发中', icon: 'none' });
      }
    });
  },

  /* ========== 关闭所有面板 ========== */
  closeAllPanels() {
    if (this.data.showEmojiPanel || this.data.showMorePanel) {
      this.setData({ showEmojiPanel: false, showMorePanel: false });
    }
  },

  /* ========== 滚动到底部 ========== */
  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToView: 'scroll-bottom' });
    }, 100);
  },

  /* ========== 我的猫 ========== */
  onMyCatter() {
    wx.navigateTo({ url: '/pages/growUp/growUp' });
  },

  /* ========== 底部导航（对齐 youMeOther — data-tab 值） ========== */
  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'starTalk') return;
    const routes = {
      moodIsland: '/pages/moodAdd/moodAdd',
      moodLib: '/pages/moodLib/moodLib',
      people: '/pages/youMeOther/youMeOther'
    };
    wx.redirectTo({ url: routes[tab] });
  },

  /* ========== 页面点击（收起面板） ========== */
  onPageTap() {
    this.closeAllPanels();
  }
});
