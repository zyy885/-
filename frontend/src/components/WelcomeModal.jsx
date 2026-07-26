import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../api.js';

export default function WelcomeModal() {
  const [show, setShow] = useState(false);
  const user = getCurrentUser();

  useEffect(() => {
    const key = 'welcome_shown_' + new Date().toDateString();
    if (!sessionStorage.getItem(key)) {
      setTimeout(() => {
        setShow(true);
        sessionStorage.setItem(key, '1');
      }, 400);
    }
  }, []);

  if (!show || !user) return null;

  const hour = new Date().getHours();
  let greeting = '你好';
  let emoji = '👋';
  if (hour < 6) { greeting = '夜深了'; emoji = '🌙'; }
  else if (hour < 9) { greeting = '早上好'; emoji = '☀️'; }
  else if (hour < 12) { greeting = '上午好'; emoji = '🌤️'; }
  else if (hour < 14) { greeting = '中午好'; emoji = '🌞'; }
  else if (hour < 18) { greeting = '下午好'; emoji = '🌤️'; }
  else if (hour < 22) { greeting = '晚上好'; emoji = '🌆'; }
  else { greeting = '夜深了'; emoji = '🌙'; }

  const quote = [
    { text: '千里之行，始于足下', author: '老子' },
    { text: '不积跬步，无以至千里', author: '荀子' },
    { text: '业精于勤，荒于嬉', author: '韩愈' },
    { text: '书山有路勤为径，学海无涯苦作舟', author: '韩愈' },
    { text: '宝剑锋从磨砺出，梅花香自苦寒来', author: '古训' },
    { text: '学如逆水行舟，不进则退', author: '古训' },
  ];
  const dailyQuote = quote[Math.floor(Math.random() * quote.length)];

  const isTeacher = user.role === 'teacher';
  const userName = user.username;

  return (
    <div className="welcome-overlay" onClick={() => setShow(false)}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>
        <div className="welcome-bg">
          <div className="welcome-bg-circle c1" />
          <div className="welcome-bg-circle c2" />
          <div className="welcome-bg-circle c3" />
        </div>
        <div className="welcome-content">
          <div className="welcome-emoji">{emoji}</div>
          <div className="welcome-greeting">{greeting}</div>
          <div className="welcome-name">
            {isTeacher ? '👨‍🏫' : '🎒'} {userName}
          </div>
          <div className="welcome-role-tag">
            {isTeacher ? '教师账号' : '学生账号'}
          </div>
          <div className="welcome-divider" />
          <div className="welcome-quote">
            <span className="quote-mark">「</span>
            {dailyQuote.text}
            <span className="quote-mark">」</span>
          </div>
          <div className="welcome-quote-author">—— {dailyQuote.author}</div>
          <div className="welcome-tip">
            {isTeacher
              ? '💡 今天也要带领同学们一起进步哦！'
              : '💡 坚持每天背单词，积少成多！'}
          </div>
          <button className="welcome-btn" onClick={() => setShow(false)}>
            开始学习 →
          </button>
        </div>
      </div>
    </div>
  );
}
