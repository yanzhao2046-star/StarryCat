const app = getApp();

Page({
  data: {
    messages: [],
    inputText: '',
    scrollToView: '',
    isTyping: false,
    current: 'catCare',
    messageId: 0
  },

  onLoad() {
    this.initChat();
  },

  /* ========== 初始化对话 ========== */
  initChat() {
    const greeting = this.getGreeting();
    const msgs = [this.createMsg('ai', greeting, true)];
    this.setData({ messages: msgs }, () => this.scrollToBottom());
  },

  /* 根据时间生成问候语 */
  getGreeting() {
    const hour = new Date().getHours();
    const moodRecord = wx.getStorageSync('lastMood');

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
    lines.push('');
    if (moodRecord) {
      const moodNames = {
        happy: '超开心', proud: '偷偷小得意', energetic: '充满干劲',
        dazed: '有点迷糊', focused: '认真专注', sad: '有点沮丧',
        tired: '想歇一会', angry: '烦躁生气'
      };
      const moodName = moodNames[moodRecord.mood] || '什么';
      const dateStr = moodRecord.date || '上次';
      lines.push(dateStr + '你的心情是"' + moodName + '"，想和我聊聊吗？');
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
    this.setData({
      messages: [...this.data.messages, msg],
      messageId: newId
    });
  },

  /* ========== AI 回复逻辑 ========== */
  getAIReply(userText) {
    const lower = userText.trim().toLowerCase();

    // 心情相关
    if (/开心|快乐|高兴|棒|好|不错/.test(lower)) {
      const replies = [
        '喵～开心就好！你的快乐会传染给我哦，我的小鱼干都多了一块！🐟',
        '看到你开心我也好高兴！要不要去  情绪岛  记录一下这份美好？',
        '太棒了！把这份好心情存进  心情库，以后回头看一定很暖～'
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }

    if (/难过|伤心|哭|不好|糟糕|烦|累|emo/.test(lower)) {
      const replies = [
        '抱抱你～难过的时候，就让星星猫陪你一会儿吧。要不要吃颗糖？',
        '别担心，乌云总会散开的。来，深呼吸，跟我喵一声：喵～～',
        '记得点击  情绪岛  把坏情绪倒出来，星星猫帮你吃掉它！🌟'
      ];
      return replies[Math.floor(Math.random() * replies.length)];
    }

    if (/谢谢|感谢|爱你|喜欢你/.test(lower)) {
      return '喵喵～不客气！能被你需要是星星猫最幸福的事 💜';
    }

    if (/吃|饿|饭|食物/.test(lower)) {
      return '说到吃的……星星猫最爱的就是小鱼干！你吃饭了吗？要好好照顾自己哦 🍚';
    }

    if (/睡|困|晚安/.test(lower)) {
      return '困了就去休息吧，好好睡觉才能变成更好的自己～晚安喵 🌙';
    }

    if (/叫什么|名字|你是谁/.test(lower)) {
      return '我叫星星猫，是你专属的心情伙伴！来自  星星猫宇宙  🐱✨';
    }

    if (/天气|下雨|太阳/.test(lower)) {
      return '不管外面什么天气，你的心里都可以有阳光哦～星星猫相信你 ☀️';
    }

    // 默认回复
    const defaults = [
      '喵～～你说得对，从猫的视角来看，事情总是简单很多呢～',
      '我在听哦，继续说吧，星星猫是你最好的听众 🎧',
      '嗯嗯，我懂。要不要去  心情库  翻翻以前的记录？说不定有新发现',
      '星星猫觉得，能坦诚表达自己的你，真的很了不起！',
      '每个情绪都值得被看见。别急，慢慢来，我一直在 🐾'
    ];
    return defaults[Math.floor(Math.random() * defaults.length)];
  },

  /* ========== 发送消息 ========== */
  onSend() {
    const text = this.data.inputText.trim();
    if (!text || this.data.isTyping) return;

    // 追加用户消息
    const showTime = this.shouldShowTime();
    this.appendMsg('user', text, showTime);
    this.setData({ inputText: '' });
    this.scrollToBottom();

    // AI 回复
    const reply = this.getAIReply(text);
    this.simulateTyping(reply);
  },

  simulateTyping(reply) {
    this.setData({ isTyping: true });
    this.scrollToBottom();

    const delay = 800 + Math.random() * 1500;
    setTimeout(() => {
      this.setData({ isTyping: false });
      const showTime = this.shouldShowTime();
      this.appendMsg('ai', reply, showTime);
      this.scrollToBottom();
    }, delay);
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

  /* ========== 页面点击（收起键盘等） ========== */
  onPageTap() {
    // 预留扩展
  }
});
