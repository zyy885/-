import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { speak, getEngines, getAccents, getVoices, getEngineVoices, TTS_ENGINES } from '../utils/speech.js';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [theme, setTheme] = useState('light');
  const [voice, setVoice] = useState('default');
  const [voices, setVoices] = useState([]);
  const [versionInfo, setVersionInfo] = useState(null);
  const [engine, setEngine] = useState('browser');
  const [accent, setAccent] = useState('en-US');
  const [rate, setRate] = useState(0.9);
  const [voiceId, setVoiceId] = useState('default');

  const engines = getEngines();
  const accentOptions = getAccents();
  const engineVoices = getEngineVoices(engine);

  useEffect(() => {
    const savedTheme = localStorage.getItem('vocab_theme') || 'light';
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    const savedEngine = localStorage.getItem('vocab_tts_engine') || 'browser';
    const savedAccent = localStorage.getItem('vocab_tts_accent') || 'en-US';
    const savedRate = parseFloat(localStorage.getItem('vocab_tts_rate')) || 0.9;
    const savedVoiceId = localStorage.getItem('vocab_tts_voice') || 'default';

    setTheme(savedTheme);
    setVoice(savedVoice);
    setEngine(savedEngine);
    setAccent(savedAccent);
    setRate(savedRate);
    setVoiceId(savedVoiceId);

    document.body.classList.remove('theme-light', 'theme-dark', 'theme-eye', 'dark-theme');
    if (savedTheme !== 'light') {
      document.body.classList.add('theme-' + savedTheme);
    }

    const loadVoices = () => {
      const v = getVoices().filter(v => v.lang.startsWith('en'));
      setVoices(v);
    };
    loadVoices();
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    api.getSettings().then(data => {
      if (data?.settings?.voice) {
        setVoice(data.settings.voice);
        localStorage.setItem('vocab_voice', data.settings.voice);
      }
    }).catch(() => {});
    api.getVersion().then(setVersionInfo).catch(() => {});
  }, []);

  const changeTheme = async (newTheme) => {
    try {
      await api.saveSettings({ theme: newTheme, voice });
      setTheme(newTheme);
      localStorage.setItem('vocab_theme', newTheme);
      document.body.classList.remove('theme-light', 'theme-dark', 'theme-eye', 'dark-theme');
      if (newTheme !== 'light') {
        document.body.classList.add('theme-' + newTheme);
      }
      window.dispatchEvent(new CustomEvent('theme-changed'));
    } catch (e) {
      alert(e.message);
    }
  };

  const changeVoice = async (newVoice) => {
    try {
      setVoice(newVoice);
      localStorage.setItem('vocab_voice', newVoice);
      await api.saveSettings({ theme, voice: newVoice });
    } catch (e) {
      alert(e.message);
    }
  };

  const changeEngine = (newEngine) => {
    setEngine(newEngine);
    localStorage.setItem('vocab_tts_engine', newEngine);
    setVoiceId('default');
    localStorage.setItem('vocab_tts_voice', 'default');
  };

  const changeAccent = (newAccent) => {
    setAccent(newAccent);
    localStorage.setItem('vocab_tts_accent', newAccent);
  };

  const changeRate = (newRate) => {
    setRate(newRate);
    localStorage.setItem('vocab_tts_rate', newRate);
  };

  const changeVoiceId = (newVoiceId) => {
    setVoiceId(newVoiceId);
    localStorage.setItem('vocab_tts_voice', newVoiceId);
  };

  const testVoice = () => {
    speak('Hello, this is a test of the word pronunciation voice.', accent);
  };

  const changePassword = async () => {
    if (!oldPw.trim() || !newPw.trim() || !confirmPw.trim()) {
      return alert('请填写所有密码字段');
    }
    if (newPw !== confirmPw) {
      return alert('两次输入的新密码不一致');
    }
    try {
      await api.changePassword(oldPw, newPw);
      alert('密码修改成功');
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (e) {
      alert(e.message);
    }
  };

  const getEngineDesc = () => {
    switch (engine) {
      case TTS_ENGINES.BROWSER: return '浏览器原生英语发音，无需联网，适合日常学习';
      case TTS_ENGINES.YOUDAO: return '有道词典发音，国内最流行的英语学习工具';
      case TTS_ENGINES.BAIDU_STANDARD: return '符合国家标准的英语发音，权威标准';
      case TTS_ENGINES.BING: return '微软必应神经发音，高品质自然流畅';
      case TTS_ENGINES.DICTIONARY: return 'DictionaryAPI 真人录音发音';
      case TTS_ENGINES.GOOGLE: return 'Google 神经发音，国际主流';
      default: return '';
    }
  };

  return (
    <div className="progress-view">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>设置</h2>
        <div />
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h3>修改密码</h3>
        <div className="form-group"><label>原密码</label>
          <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="请输入原密码" />
        </div>
        <div className="form-group"><label>新密码</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="请输入新密码" />
        </div>
        <div className="form-group"><label>确认新密码</label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="请再次输入新密码" />
        </div>
        <button className="btn btn-primary" onClick={changePassword}>修改密码</button>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h3>主题切换</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
          <button
            className={'btn ' + (theme === 'light' ? 'btn-primary' : 'btn-outline')}
            onClick={() => changeTheme('light')}
          >
            ☀️ 浅色
          </button>
          <button
            className={'btn ' + (theme === 'dark' ? 'btn-primary' : 'btn-outline')}
            onClick={() => changeTheme('dark')}
          >
            🌙 深色
          </button>
          <button
            className={'btn ' + (theme === 'eye' ? 'btn-primary' : 'btn-outline')}
            onClick={() => changeTheme('eye')}
          >
            👁️ 护眼
          </button>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h3>🔊 读单词语音</h3>

        <div className="form-group">
          <label>语音引擎</label>
          <select value={engine} onChange={e => changeEngine(e.target.value)}>
            {engines.map(e => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <div className="muted small" style={{ marginTop: 4 }}>
            {getEngineDesc()}
          </div>
        </div>

        <div className="form-group">
          <label>英语口音</label>
          <select value={accent} onChange={e => changeAccent(e.target.value)}>
            {accentOptions.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>语速: {rate.toFixed(1)}x</label>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.1"
            value={rate}
            onChange={e => changeRate(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <div className="muted small" style={{ marginTop: 4 }}>
            0.5x 慢速 ~ 1.0x 正常 ~ 1.5x 快速
          </div>
        </div>

        {(engine === TTS_ENGINES.YOUDAO || engine === TTS_ENGINES.BAIDU_STANDARD || engine === TTS_ENGINES.BING) && engineVoices.length > 0 && (
          <div className="form-group">
            <label>
              {engine === TTS_ENGINES.YOUDAO ? '有道词典音色' : engine === TTS_ENGINES.BAIDU_STANDARD ? '新国标语音音色' : '必应神经音色'}
            </label>
            <select value={voiceId} onChange={e => changeVoiceId(e.target.value)}>
              <option value="default">默认音色</option>
              {engineVoices.map(v => (
                <option key={v.id} value={String(v.id)}>{v.name} ({v.tag})</option>
              ))}
            </select>
          </div>
        )}

        {engine === TTS_ENGINES.BROWSER && (
          <div className="form-group">
            <label>浏览器音色</label>
            <select value={voice} onChange={e => changeVoice(e.target.value)}>
              <option value="default">系统默认</option>
              {voices.map((v, i) => (
                <option key={i} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={testVoice}>🔊 试听当前设置</button>
        </div>
        <div className="muted small" style={{ marginTop: 12 }}>
          提示：修改设置后即时保存。推荐使用「有道词典发音」或「新国标英语」获得标准英语发音。
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, margin: '24px auto' }}>
        <h3>ℹ️ 关于本系统</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px 16px', marginTop: 12 }}>
          <div className="muted">系统名称</div>
          <div>📖 研途单词 · 单词测试平台</div>
          <div className="muted">当前版本</div>
          <div><b>v{versionInfo?.version || '—'}</b></div>
          <div className="muted">构建时间</div>
          <div>{versionInfo?.buildTime || '—'}</div>
          <div className="muted">运行环境</div>
          <div>
            <span style={{
              display: 'inline-block',
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: 12,
              background: versionInfo?.environment === '生产环境' ? '#dcfce7' : '#fef3c7',
              color: versionInfo?.environment === '生产环境' ? '#166534' : '#92400e',
            }}>{versionInfo?.environment || '—'}</span>
          </div>
        </div>
        <div className="muted small" style={{ marginTop: 16, textAlign: 'center' }}>
          © {new Date().getFullYear()} 研途教育 · 保留所有权利
        </div>
      </div>
    </div>
  );
}
