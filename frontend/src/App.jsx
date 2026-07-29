import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { api, getCurrentUser, clearAuth, setAuth } from './api.js';
import WelcomeModal from './components/WelcomeModal.jsx';
import Login from './pages/Login.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import StudyPage from './pages/StudyPage.jsx';
import TestPage from './pages/TestPage.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';
import WordListManage from './pages/WordListManage.jsx';
import TaskManage from './pages/TaskManage.jsx';
import ProgressView from './pages/ProgressView.jsx';
import StudentWordLists from './pages/StudentWordLists.jsx';
import UserManage from './pages/UserManage.jsx';
import WrongBook from './pages/WrongBook.jsx';
import Favorites from './pages/Favorites.jsx';
import StatsPage from './pages/StatsPage.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import CommentsStudent from './pages/CommentsStudent.jsx';
import CommentsTeacher from './pages/CommentsTeacher.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import SentenceListManage from './pages/SentenceListManage.jsx';
import SentencePractice from './pages/SentencePractice.jsx';
import SelfTestPage from './pages/SelfTestPage.jsx';
import SelfTestSelect from './pages/SelfTestSelect.jsx';
import MinePage from './pages/MinePage.jsx';
import RankPreview from './pages/RankPreview.jsx';

function Navbar() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  if (!user) return null;

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  const links = user.role === 'teacher'
    ? [
        { to: '/teacher', label: '总览' },
        { to: '/teacher/word-lists', label: '词表管理' },
        { to: '/teacher/sentence-lists', label: '长难句' },
        { to: '/teacher/tasks', label: '任务管理' },
        { to: '/teacher/users', label: '账号管理' },
        { to: '/teacher/comments', label: '留言' },
      ]
    : [
        { to: '/student', label: '我的任务' },
        { to: '/student/word-lists', label: '学习' },
        { to: '/student/self-test-select', label: '自测' },
        { to: '/student/sentence-practice', label: '长难句' },
        { to: '/student/wrong-book', label: '错题本' },
        { to: '/student/favorites', label: '收藏' },
        { to: '/student/stats', label: '统计' },
        { to: '/student/leaderboard', label: '排行' },
        { to: '/student/comments', label: '留言' },
      ];

  return (
    <nav className="navbar">
      <div className="nav-left">
        <span className="logo">📖 研途单词</span>
      </div>
      <div className="nav-center">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={'nav-link' + (location.pathname === l.to ? ' active' : '')}
          >{l.label}</Link>
        ))}
      </div>
      <div className="nav-right">
        <button className="btn-link" onClick={() => navigate('/settings')} title="设置">⚙️</button>
        <span className="user-info">{user.role === 'teacher' ? '👨‍🏫' : '🎒'} {user.username}</span>
        <button className="btn-link" onClick={logout}>退出</button>
      </div>
    </nav>
  );
}

function BottomTabBar() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSheet, setActiveSheet] = useState(null);

  if (!user) return null;

  const logout = () => {
    clearAuth();
    navigate('/login');
  };

  const go = (to) => {
    setActiveSheet(null);
    navigate(to);
  };

  const toggleSheet = (key) => {
    setActiveSheet(activeSheet === key ? null : key);
  };

  const studentTabs = [
    {
      key: 'home',
      label: '首页',
      icon: '🏠',
      single: { to: '/student', label: '首页' },
      match: ['/student'],
    },
    {
      key: 'study',
      label: '学习',
      icon: '📚',
      single: { to: '/student/word-lists', label: '词表总览' },
      match: ['/student/word-lists'],
    },
    {
      key: 'practice',
      label: '练习',
      icon: '✏️',
      items: [
        { to: '/student/self-test-select', label: '单词自测', icon: '📝' },
        { to: '/student/sentence-practice', label: '长难句', icon: '📄' },
        { to: '/student/wrong-book', label: '错题本', icon: '❌' },
      ],
      match: ['/student/self-test', '/student/self-test-select', '/student/sentence-practice', '/student/wrong-book'],
    },
    {
      key: 'discover',
      label: '发现',
      icon: '✨',
      items: [
        { to: '/student/favorites', label: '收藏', icon: '⭐' },
        { to: '/student/stats', label: '统计', icon: '📊' },
        { to: '/student/leaderboard', label: '排行', icon: '🏆' },
        { to: '/student/comments', label: '留言', icon: '💬' },
      ],
      match: ['/student/favorites', '/student/stats', '/student/leaderboard', '/student/comments'],
    },
    {
      key: 'mine',
      label: '我的',
      icon: '👤',
      single: { to: '/student/mine', label: '我的' },
      match: ['/student/mine', '/settings'],
    },
  ];

  const teacherTabs = [
    {
      key: 'home',
      label: '首页',
      icon: '🏠',
      single: { to: '/teacher', label: '首页' },
      match: ['/teacher'],
    },
    {
      key: 'manage',
      label: '管理',
      icon: '📋',
      items: [
        { to: '/teacher/word-lists', label: '词表管理', icon: '📖' },
        { to: '/teacher/sentence-lists', label: '长难句', icon: '📝' },
        { to: '/teacher/tasks', label: '任务管理', icon: '📋' },
      ],
      match: ['/teacher/word-lists', '/teacher/sentence-lists', '/teacher/tasks'],
    },
    {
      key: 'users',
      label: '用户',
      icon: '👥',
      items: [
        { to: '/teacher/users', label: '账号管理', icon: '👤' },
        { to: '/teacher/comments', label: '留言', icon: '💬' },
      ],
      match: ['/teacher/users', '/teacher/comments'],
    },
    {
      key: 'mine',
      label: '我的',
      icon: '👤',
      single: { to: '/teacher/mine', label: '我的' },
      match: ['/teacher/mine', '/settings'],
    },
  ];

  const tabs = user.role === 'teacher' ? teacherTabs : studentTabs;

  const isActive = (tab) => {
    return tab.match.some(p => location.pathname.startsWith(p));
  };

  return (
    <>
      {activeSheet && (
        <div className="tab-overlay" onClick={() => setActiveSheet(null)} />
      )}
      <div className="bottom-tab-bar">
        {tabs.map(tab => {
          const active = isActive(tab);
          const isOpen = activeSheet === tab.key;
          return (
            <div key={tab.key} className="tab-item-wrapper">
              {isOpen && tab.items && (
                <div className="tab-sheet">
                  {tab.items.map((item, idx) => (
                    <button
                      key={idx}
                      className="tab-sheet-item"
                      onClick={() => {
                        if (item.action) { item.action(); }
                        else if (item.to) { go(item.to); }
                      }}
                    >
                      <span className="tab-sheet-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <button
                className={'tab-item' + (active ? ' active' : '') + (isOpen ? ' open' : '')}
                onClick={() => {
                  if (tab.single) {
                    go(tab.single.to);
                  } else {
                    toggleSheet(tab.key);
                  }
                }}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ProtectedRoute({ children, role }) {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={'/' + user.role} replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(getCurrentUser());

  useEffect(() => {
    const handler = () => setUser(getCurrentUser());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  useEffect(() => {
    const applyTheme = () => {
      const theme = localStorage.getItem('vocab_theme') || 'light';
      document.body.classList.remove('theme-light', 'theme-dark', 'theme-eye', 'dark-theme');
      if (theme !== 'light') {
        document.body.classList.add('theme-' + theme);
      }
    };
    applyTheme();
    window.addEventListener('theme-changed', applyTheme);
    return () => window.removeEventListener('theme-changed', applyTheme);
  }, []);

  return (
    <div className="app">
      <WelcomeModal />
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login onLogin={(t, u) => { setAuth(t, u); setUser(u); }} />} />
          <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/task/:id/study" element={<ProtectedRoute role="student"><StudyPage /></ProtectedRoute>} />
          <Route path="/student/task/:id/test" element={<ProtectedRoute role="student"><TestPage /></ProtectedRoute>} />
          <Route path="/student/word-lists" element={<ProtectedRoute role="student"><StudentWordLists /></ProtectedRoute>} />
          <Route path="/student/self-test" element={<ProtectedRoute role="student"><SelfTestPage /></ProtectedRoute>} />
          <Route path="/student/self-test-select" element={<ProtectedRoute role="student"><SelfTestSelect /></ProtectedRoute>} />
          <Route path="/student/mine" element={<ProtectedRoute role="student"><MinePage /></ProtectedRoute>} />
          <Route path="/teacher/mine" element={<ProtectedRoute role="teacher"><MinePage /></ProtectedRoute>} />
          <Route path="/student/sentence-practice" element={<ProtectedRoute role="student"><SentencePractice /></ProtectedRoute>} />
          <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/word-lists" element={<ProtectedRoute role="teacher"><WordListManage /></ProtectedRoute>} />
          <Route path="/teacher/sentence-lists" element={<ProtectedRoute role="teacher"><SentenceListManage /></ProtectedRoute>} />
          <Route path="/teacher/tasks" element={<ProtectedRoute role="teacher"><TaskManage /></ProtectedRoute>} />
          <Route path="/teacher/tasks/:id/progress" element={<ProtectedRoute role="teacher"><ProgressView /></ProtectedRoute>} />
          <Route path="/teacher/users" element={<ProtectedRoute role="teacher"><UserManage /></ProtectedRoute>} />
          <Route path="/teacher/comments" element={<ProtectedRoute role="teacher"><CommentsTeacher /></ProtectedRoute>} />
          <Route path="/student/wrong-book" element={<ProtectedRoute role="student"><WrongBook /></ProtectedRoute>} />
          <Route path="/student/favorites" element={<ProtectedRoute role="student"><Favorites /></ProtectedRoute>} />
          <Route path="/student/stats" element={<ProtectedRoute role="student"><StatsPage /></ProtectedRoute>} />
          <Route path="/student/leaderboard" element={<ProtectedRoute role="student"><Leaderboard /></ProtectedRoute>} />
          <Route path="/student/comments" element={<ProtectedRoute role="student"><CommentsStudent /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/rank-preview" element={<ProtectedRoute><RankPreview /></ProtectedRoute>} />
        </Routes>
      </main>
      <BottomTabBar />
    </div>
  );
}

function HomeRedirect() {
  const user = getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={'/' + user.role} replace />;
}
