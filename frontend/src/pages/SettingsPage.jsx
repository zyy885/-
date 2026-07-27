import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [theme, setTheme] = useState('light');
  const [voice, setVoice] = useState('default');
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('vocab_theme') || 'light';
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    setTheme(savedTheme);
    setVoice(savedVoice);
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-eye', 'dark-theme');
    if (savedTheme !== 'light') {
      document.body.classList.add('theme-' + savedTheme);
    }

    const loadVoices = () => {
      const v = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      setVoices(v);
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;

    api.getSettings().then(data => {
      if (data?.settings?.voice) {
        setVoice(data.settings.voice);
        localStorage.setItem('vocab_voice', data.settings.voice);
      }
    }).catch(() => {});
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

  const testVoice = () => {
    try {
      const u = new SpeechSynthesisUtterance('Hello! This is a test of the word pronunciation voice.');
      u.lang = 'en-US';
      if (voice !== 'default') {
        const v = voices.find(v => v.name === voice);
        if (v) u.voice = v;
      }
      speechSynthesis.speak(u);
    } catch (e) {}
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
          <label>选择发音音色</label>
          <select value={voice} onChange={e => changeVoice(e.target.value)}>
            <option value="default">系统默认</option>
            {voices.map((v, i) => (
              <option key={i} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={testVoice}>🔊 试听当前音色</button>
        </div>
        <div className="muted small" style={{ marginTop: 12 }}>
          提示：可用音色取决于您的浏览器和操作系统。英语学习建议选择 en-US 或 en-GB 音色。
        </div>
      </div>
    </div>
  );
}
