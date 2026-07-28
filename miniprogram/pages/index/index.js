const app = getApp();

Page({
  data: {
    webUrl: '',
    loading: true
  },

  onLoad: function () {
    this.setData({
      webUrl: app.globalData.webUrl,
      loading: true
    });
  },

  onLoadFinish: function () {
    this.setData({ loading: false });
  },

  onShareAppMessage: function () {
    return {
      title: '研途单词 - 考研英语学习助手',
      path: '/pages/index/index'
    };
  }
});
