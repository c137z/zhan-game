// ============================================================
//  斩 — audio.js
//  BGM + 音效系统
//  依赖 data.js（先加载）
//  兼容 file://（HTMLAudioElement）和 http://
// ============================================================

if (!window.Zhan) window.Zhan = {};
Zhan.Audio = {
  _elements: {},       // name → Audio element
  _loading: {},        // name → true 正在加载
  _pendingPlay: null,  // 还没加载完就请求播放的 BGM name
  _currentName: null,
  _bgmVolume: 0.5,
  _sfxVolume: 0.5,
  _muted: false,

  // 初始化（file:// 不需要 AudioContext）
  init: function() {},

  // 预加载 BGM（用原生 Audio 元素，兼容 file:///http:///data: URI）
  loadBGM: function(name, url) {
    if (this._loading[name] || this._elements[name]) return;
    var self = this;
    this._loading[name] = true;

    var audio = new Audio();
    audio.preload = 'auto';
    audio.loop = true;
    audio.volume = this._muted ? 0 : this._bgmVolume;

    var done = false;
    var onReady = function() {
      if (done) return;
      done = true;
      self._elements[name] = audio;
      self._loading[name] = false;
      console.log('BGM 已加载: ' + name);
      if (self._pendingPlay === name) {
        self._pendingPlay = null;
        self.playBGM(name);
      }
    };

    // 多个事件兜底：canplaythrough / loadeddata / error
    audio.addEventListener('canplaythrough', onReady);
    audio.addEventListener('loadeddata', function() { if (!done) onReady(); });
    audio.addEventListener('error', function() {
      if (done) return;
      done = true;
      self._loading[name] = false;
      console.error('BGM 加载失败: ' + name);
    });

    audio.src = url;

    // data: URI 可能同步解码完成，事件已经错过，直接检查 readyState
    if (audio.readyState >= 3) {
      onReady();
    }
  },

  // 播放 BGM（自动停止当前 BGM，循环）
  playBGM: function(name) {
    var audio = this._elements[name];
    if (!audio) {
      if (this._loading[name]) { this._pendingPlay = name; }
      return;
    }

    this.stopBGM();

    audio.currentTime = 0;
    audio.play().catch(function(e) { console.log('BGM play 失败:', e); });
    this._currentName = name;
  },

  stopBGM: function() {
    if (this._currentName && this._elements[this._currentName]) {
      var audio = this._elements[this._currentName];
      audio.pause();
      audio.currentTime = 0;
    }
    this._currentName = null;
  },

  setBGMVolume: function(v) {
    this._bgmVolume = v;
    if (this._currentName && this._elements[this._currentName]) {
      this._elements[this._currentName].volume = this._muted ? 0 : v;
    }
  },

  setSFXVolume: function(v) { this._sfxVolume = v; },

  toggleMute: function() {
    this._muted = !this._muted;
    if (this._currentName && this._elements[this._currentName]) {
      this._elements[this._currentName].volume = this._muted ? 0 : this._bgmVolume;
    }
    return this._muted;
  },

  // 播放音效（一次性短音 —— 走 Audio 构造，兼容 file://）
  playSFX: function(name) {
    if (this._muted || !this._elements['sfx_' + name]) return;
    var clone = new Audio();
    clone.src = this._elements['sfx_' + name].src;
    clone.volume = this._sfxVolume;
    clone.play().catch(function(e) {});
  },

  loadSFX: function(name, url) {
    var audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    this._elements['sfx_' + name] = audio;
  }
};
