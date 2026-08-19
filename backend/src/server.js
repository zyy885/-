const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { isPG } = require('./db');
const { signToken, authMiddleware, requireRole } = require('./auth');
const { normalizeForCompare } = require('./utils/chinese');

const IS_PUBLIC = isPG ? 'wb.is_public = TRUE' : 'CAST(wb.is_public AS INTEGER) = 1';
const IS_PUBLIC_ALT = isPG ? 'wb2.is_public = TRUE' : 'CAST(wb2.is_public AS INTEGER) = 1';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : null;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的跨域请求'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

async function runMigrations() {
  if (isPG) {
    try {
      await db.raw.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_bonus_days INTEGER DEFAULT 0`);
      await db.raw.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_bonus_words INTEGER DEFAULT 0`);
      await db.raw.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS voice TEXT DEFAULT 'default'`);
      console.log('迁移执行完成');
    } catch (e) {
      console.error('迁移执行出错（可能已存在）:', e.message);
    }
  }
}
runMigrations();

async function runSeedData() {
  const BOOK_NAME = '「研师」解词';
  try {
    const existing = await db.prepare(
      'SELECT id FROM word_books WHERE name = ? LIMIT 1'
    ).get(BOOK_NAME);
    if (existing) {
      console.log(`种子数据: 单词书「${BOOK_NAME}」已存在，跳过导入`);
      return;
    }

    const teacher = await db.prepare(
      "SELECT id FROM users WHERE role = 'teacher' LIMIT 1"
    ).get();
    if (!teacher) {
      console.log('种子数据: 未找到教师用户，跳过');
      return;
    }

    const bookInfo = await db.prepare(
      'INSERT INTO word_books (name, description, cover_color, is_public, teacher_id) VALUES (?, ?, ?, ?, ?)'
    ).run(BOOK_NAME, '考研英语词汇学习', '#8B5CF6', isPG ? true : 1, teacher.id);
    const bookId = bookInfo.lastInsertRowid;
    console.log(`种子数据: 创建单词书「${BOOK_NAME}」(ID: ${bookId})`);

    const parts = [
      {
        name: 'PART 01 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'matter', meaning: 'n. 物质；问题\nv. 要紧', example: 'a matter of...\nIt doesn\'t matter to me.' },
          { word: 'pride', meaning: 'v. 为 … 而骄傲\nn. 骄傲；自尊', example: 'pride oneself on\nYou must put aside your...' },
          { word: 'award', meaning: 'n. 奖品\nv. 授予，奖励给', example: 'annual award\nan award for...\naward sb sth = award st...' },
          { word: 'send', meaning: 'v. 邮寄，发送', example: 'She sent the letter by...' },
          { word: 'prove', meaning: 'v. 证明，证实', example: 'It could prove to be...\nthe future.' },
          { word: 'act', meaning: 'n. 行动；表演\nv. 行动；表演', example: 'act as...' },
          { word: 'law', meaning: 'n. 法律；法规', example: '' },
          { word: 'normal', meaning: 'adj. 正常的；一般的', example: '' },
          { word: 'environment', meaning: 'n. 环境', example: '' },
          { word: 'cure', meaning: 'v. 治愈，治疗\nn. 药物', example: '' }
        ]
      },
      {
        name: 'PART 02 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'safe', meaning: 'adj. 安全的；无危险的', example: 'safe and sound\nIt is dangerous...' },
          { word: 'cause', meaning: 'n. 原因\nv. 导致，引起', example: 'cause sth\ncause sb to do...' },
          { word: 'appear', meaning: 'v. 出现；显现，好像', example: 'It appears that...\nappear to be...' },
          { word: 'amazing', meaning: 'adj. 惊人的；了不起的', example: 'amazing...' },
          { word: 'force', meaning: 'n. 力；力量\nv. 强迫', example: 'force sb to do sth\nby force' },
          { word: 'control', meaning: 'v./n. 控制；管理', example: '' },
          { word: 'alike', meaning: 'adj./adv. 相似的；同样的', example: 'look alike\nalike in...' },
          { word: 'island', meaning: 'n. 岛，岛屿', example: '' },
          { word: 'enjoy', meaning: 'v. 享受；喜爱，欣赏', example: 'enjoy doing sth\nenjoy oneself' },
          { word: 'loyal', meaning: 'adj. 忠诚的；忠实的', example: 'be loyal to\na loyal friend' }
        ]
      },
      {
        name: 'PART 03 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'hunger', meaning: 'n. 饥饿；v. 渴望', example: 'hunger marketing\ndie of hunger\nhunger for sth/sb\nStudents in remote areas hunger for knowledge.' },
          { word: 'explain', meaning: 'v. 说明，解释', example: 'It was difficult to explain the problem to her.' },
          { word: 'rich', meaning: 'adj. 富有的，富裕的', example: 'a rich man\nrich culture\nbe rich in...' },
          { word: 'nature', meaning: 'n. 自然，天性', example: 'human nature\nin nature\nby nature' },
          { word: 'climate', meaning: 'n. 气候，风气', example: 'global climate\nsocial climate\nclimate change' },
          { word: 'tiny', meaning: 'adj. 极小的', example: 'a tiny baby' },
          { word: 'excite', meaning: 'v. 使…激动', example: 'The news excites me.' },
          { word: 'ease', meaning: 'v. 减轻，缓和\nn. 安逸；容易', example: 'We eased our relationship\na life of ease' },
          { word: 'desire', meaning: 'v. 渴望\nn. 欲望', example: 'the desired effect\na strong desire for power' },
          { word: 'birth', meaning: 'n. 诞生，出生，起源', example: 'She gave birth to a baby.' }
        ]
      },
      {
        name: 'PART 04 · 基础唤醒词汇',
        description: '基础唤醒词汇 6 词',
        words: [
          { word: 'tour', meaning: 'n. 旅游', example: 'a tour and travel\na tour of the city' },
          { word: 'cash', meaning: 'n. 现金', example: 'cash in hand\nI\'m short of cash right now.' },
          { word: 'wide', meaning: 'adj. 宽的；广泛的\nadv. 广阔地；充分地', example: 'a wide mouth\nThe door was wide open.' },
          { word: 'sad', meaning: 'adj. 悲哀的，难过的', example: 'She looked sad and tired.' },
          { word: 'spirit', meaning: 'n. 精神，情绪', example: 'in high/low spirits\nThe news lifted our spirits.' },
          { word: 'speed', meaning: 'n. 速度\nv. 加速', example: 'speed limit\nHe drives at high speed.' }
        ]
      }
    ];

    const insertWordStmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
    );

    for (const part of parts) {
      const listInfo = await db.prepare(
        'INSERT INTO word_lists (name, description, word_book_id, teacher_id, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(part.name, part.description, bookId, teacher.id, 0);
      const listId = listInfo.lastInsertRowid;
      console.log(`种子数据: 创建词表 "${part.name}"`);

      for (let i = 0; i < part.words.length; i++) {
        const w = part.words[i];
        await insertWordStmt.run(listId, w.word, w.meaning, w.example || '', i + 1);
      }
      console.log(`  插入 ${part.words.length} 个单词`);
    }
    console.log(`种子数据: 「${BOOK_NAME}」导入完成`);
  } catch (e) {
    console.error('种子数据导入出错:', e.message);
  }
}
runSeedData();

const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_LOGIN_ATTEMPTS = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  let record = loginAttempts.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    record = { windowStart: now, count: 0 };
    loginAttempts.set(ip, record);
  }
  record.count++;
  if (record.count > MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  return true;
}

const RANK_LEVELS = [
  { name: '传奇', icon: '🌟', color: '#dc2626', level: 9, minDays: 366, minWords: 20000 },
  { name: '宗师', icon: '👑', color: '#7c3aed', level: 8, minDays: 201, minWords: 12000 },
  { name: '大师', icon: '🏆', color: '#ea580c', level: 7, minDays: 101, minWords: 7000 },
  { name: '钻石', icon: '💠', color: '#2563eb', level: 6, minDays: 61, minWords: 4000 },
  { name: '铂金', icon: '💎', color: '#0891b2', level: 5, minDays: 31, minWords: 2000 },
  { name: '黄金', icon: '🥇', color: '#d97706', level: 4, minDays: 15, minWords: 1000 },
  { name: '白银', icon: '🥈', color: '#6b7280', level: 3, minDays: 8, minWords: 500 },
  { name: '青铜', icon: '🥉', color: '#92400e', level: 2, minDays: 4, minWords: 200 },
  { name: '初学者', icon: '🌱', color: '#65a30d', level: 1, minDays: 0, minWords: 0 },
];

function getRank(days, words) {
  for (const r of RANK_LEVELS) {
    if (days >= r.minDays || words >= r.minWords) return r;
  }
  return RANK_LEVELS[RANK_LEVELS.length - 1];
}

function getNextRank(days, words) {
  for (let i = RANK_LEVELS.length - 2; i >= 0; i--) {
    const r = RANK_LEVELS[i];
    if (days < r.minDays && words < r.minWords) return r;
  }
  return null;
}

function calcStreak(dates) {
  if (!dates || dates.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const dateSet = new Set(dates.map(d => typeof d === 'string' ? d : d.checkin_date));
  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) return 0;
  let streak = 0;
  let cursor = new Date(today);
  if (!dateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const cursorStr = cursor.toISOString().split('T')[0];
    if (dateSet.has(cursorStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function cleanMeaning(s) {
  s = s.trim().toLowerCase();
  s = s.replace(/\(.*?\)/g, '').trim();
  s = s.replace(/^[a-z]+\.\s*/, '').trim();
  s = s.replace(/^[（(][^）)]*[）)]\s*/, '').trim();
  return s;
}

const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
const fs = require('fs');

function getTaskWordListIds(task) {
  if (task.word_list_ids) {
    try {
      const ids = JSON.parse(task.word_list_ids);
      if (Array.isArray(ids) && ids.length > 0) return ids.map(Number);
    } catch (e) {}
  }
  if (task.word_list_id) return [Number(task.word_list_id)];
  return [];
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }
  if (typeof username !== 'string' || username.length > 50 || username.length < 2) {
    return res.status(400).json({ error: '用户名格式不正确' });
  }
  if (typeof password !== 'string' || password.length > 100) {
    return res.status(400).json({ error: '密码格式不正确' });
  }
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '登录尝试过于频繁，请1分钟后再试' });
  }
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  loginAttempts.delete(ip);
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar }
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }
  if (typeof username !== 'string' || username.length > 50 || username.length < 2) {
    return res.status(400).json({ error: '用户名长度需在2-50之间' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: '密码长度需在6-100之间' });
  }
  const userRole = 'student';
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, userRole);
  const user = { id: info.lastInsertRowid, username, role: userRole };
  res.json({ token: signToken(user), user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const students = await db.prepare(
    "SELECT id, username, created_at FROM users WHERE role = 'student' ORDER BY id"
  ).all();
  res.json({ students });
});

app.get('/api/users', authMiddleware, requireRole('teacher'), async (req, res) => {
  let users;
  try {
    users = await db.prepare(
      'SELECT id, username, role, created_at, rank_bonus_days, rank_bonus_words FROM users ORDER BY role, username'
    ).all();
  } catch (e) {
    console.warn('获取用户列表（含奖励字段）失败，退化为基础查询:', e.message);
    users = await db.prepare(
      'SELECT id, username, role, created_at FROM users ORDER BY role, username'
    ).all();
  }
  const checkinRows = await db.prepare(
    'SELECT student_id, COUNT(*) as cnt FROM checkins GROUP BY student_id'
  ).all();
  const wordsRows = await db.prepare(
    'SELECT student_id, COALESCE(SUM(words_studied), 0) as w FROM study_sessions GROUP BY student_id'
  ).all();
  const checkinMap = {}, wordsMap = {};
  for (const r of checkinRows) checkinMap[r.student_id] = Number(r.cnt) || 0;
  for (const r of wordsRows) wordsMap[r.student_id] = Number(r.w) || 0;
  const enriched = users.map(u => {
    if (u.role !== 'student') return u;
    return {
      ...u,
      total_checkins: checkinMap[u.id] || 0,
      total_words: wordsMap[u.id] || 0,
    };
  });
  res.json({ users: enriched });
});

app.post('/api/users', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: '参数错误' });
  }
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, role);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/users/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: '不能删除当前登录账号' });
  }
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.role === 'teacher') {
    const hasLists = await db.prepare('SELECT 1 FROM word_lists WHERE teacher_id = ? LIMIT 1').get(targetId);
    const hasTasks = await db.prepare('SELECT 1 FROM tasks WHERE teacher_id = ? LIMIT 1').get(targetId);
    if (hasLists || hasTasks) {
      return res.status(400).json({ error: '该教师有关联的词表或任务，请先处理' });
    }
  }
  const tsIds = await db.prepare('SELECT id FROM task_students WHERE student_id = ?').all(targetId);
  for (const ts of tsIds) {
    await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
    await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  }
  await db.prepare('DELETE FROM task_students WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM favorites WHERE user_id = ?').run(targetId);
  await db.prepare('DELETE FROM comments WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM checkins WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM translation_records WHERE student_id = ?').run(targetId);
  const selfTestIds = await db.prepare('SELECT id FROM self_tests WHERE student_id = ?').all(targetId);
  for (const st of selfTestIds) {
    await db.prepare('DELETE FROM self_test_records WHERE self_test_id = ?').run(st.id);
  }
  await db.prepare('DELETE FROM self_tests WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM student_tags WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true });
});

app.put('/api/users/:id/password', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: '密码长度需在6-100之间' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '请通过设置页面修改自己的密码' });
  }
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

app.get('/api/users/:id/rank-info', authMiddleware, requireRole('teacher'), async (req, res) => {
  const userId = Number(req.params.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role !== 'student') return res.status(400).json({ error: '仅学生有等级信息' });

  const bonusDays = Number(user.rank_bonus_days) || 0;
  const bonusWords = Number(user.rank_bonus_words) || 0;

  const totalCheckinsRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM checkins WHERE student_id = ?'
  ).get(userId);
  const totalCheckins = Number(totalCheckinsRow.cnt) || 0;

  const totalWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(userId);
  const totalWords = Number(totalWordsRow.w) || 0;

  const checkinRows = await db.prepare(
    'SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC'
  ).all(userId);

  const streak = calcStreak(checkinRows);
  const effectiveDays = streak + bonusDays;
  const effectiveWords = totalWords + bonusWords;
  const rank = getRank(effectiveDays, effectiveWords);
  const nextRank = getNextRank(effectiveDays, effectiveWords);

  res.json({
    user: { id: user.id, username: user.username },
    streak_days: streak,
    total_checkins: totalCheckins,
    total_words: totalWords,
    rank_bonus_days: bonusDays,
    rank_bonus_words: bonusWords,
    effective_days: effectiveDays,
    effective_words: effectiveWords,
    rank,
    next_rank: nextRank,
  });
});

app.put('/api/users/:id/rank-bonus', authMiddleware, requireRole('teacher'), async (req, res) => {
  const userId = Number(req.params.id);
  const { rank_bonus_days, rank_bonus_words } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role !== 'student') return res.status(400).json({ error: '仅学生可设置等级奖励' });
  const days = Math.max(0, Math.min(9999, Number(rank_bonus_days) || 0));
  const words = Math.max(0, Math.min(999999, Number(rank_bonus_words) || 0));
  await db.prepare(
    'UPDATE users SET rank_bonus_days = ?, rank_bonus_words = ? WHERE id = ?'
  ).run(days, words, userId);
  res.json({ ok: true, rank_bonus_days: days, rank_bonus_words: words });
});

app.get('/api/users/:id/study-detail', authMiddleware, requireRole('teacher'), async (req, res) => {
  const userId = Number(req.params.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role !== 'student') return res.status(400).json({ error: '仅学生有学习详情' });

  const bonusDays = Number(user.rank_bonus_days) || 0;
  const bonusWords = Number(user.rank_bonus_words) || 0;

  const totalTasksRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ?'
  ).get(userId);
  const testedTasksRow = await db.prepare(
    "SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ? AND status = 'tested'"
  ).get(userId);
  const avgScoreRow = await db.prepare(
    'SELECT AVG(test_score) as avg FROM task_students WHERE student_id = ? AND test_score IS NOT NULL'
  ).get(userId);
  const studyDaysRow = await db.prepare(
    "SELECT COUNT(DISTINCT DATE(last_studied_at)) as cnt FROM task_students WHERE student_id = ? AND last_studied_at IS NOT NULL"
  ).get(userId);
  const totalWordsRow = await db.prepare(
    `SELECT COUNT(DISTINCT sr.word_id) as cnt FROM study_records sr
     INNER JOIN task_students ts ON ts.id = sr.task_student_id
     WHERE ts.student_id = ?`
  ).get(userId);
  const wrongCountRow = await db.prepare(
    `SELECT COUNT(DISTINCT tr.word_id) as cnt FROM test_records tr
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     WHERE ts.student_id = ? AND tr.is_correct = 0`
  ).get(userId);

  const totalSessionWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(userId);
  const totalDurationRow = await db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as s FROM study_sessions WHERE student_id = ?'
  ).get(userId);

  const checkinRows = await db.prepare(
    'SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC'
  ).all(userId);

  const streak = calcStreak(checkinRows);
  const totalSessionWords = Number(totalSessionWordsRow.w) || 0;
  const effectiveDays = streak + bonusDays;
  const effectiveWords = totalSessionWords + bonusWords;
  const rank = getRank(effectiveDays, effectiveWords);

  const recentTasks = await db.prepare(
    `SELECT ts.*, t.name as task_name
     FROM task_students ts
     INNER JOIN tasks t ON t.id = ts.task_id
     WHERE ts.student_id = ?
     ORDER BY COALESCE(ts.last_studied_at, ts.created_at) DESC
     LIMIT 10`
  ).all(userId);

  const recentCheckins = await db.prepare(
    'SELECT * FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC LIMIT 14'
  ).all(userId);

  const recentSelfTests = await db.prepare(
    `SELECT st.*, COUNT(str.id) as total,
      SUM(CASE WHEN str.is_correct = 1 THEN 1 ELSE 0 END) as correct
     FROM self_tests st
     LEFT JOIN self_test_records str ON str.self_test_id = st.id
     WHERE st.student_id = ?
     GROUP BY st.id
     ORDER BY st.created_at DESC
     LIMIT 10`
  ).all(userId);

  res.json({
    user: { id: user.id, username: user.username, created_at: user.created_at },
    stats: {
      totalTasks: Number(totalTasksRow.cnt) || 0,
      testedTasks: Number(testedTasksRow.cnt) || 0,
      avgScore: Math.round(Number(avgScoreRow.avg) || 0),
      studyDays: Number(studyDaysRow.cnt) || 0,
      totalWords: Number(totalWordsRow.cnt) || 0,
      wrongCount: Number(wrongCountRow.cnt) || 0,
      totalSessionWords,
      totalDuration: Number(totalDurationRow.s) || 0,
      checkinDays: checkinRows.length,
      streakDays: streak,
      rank_bonus_days: bonusDays,
      rank_bonus_words: bonusWords,
    },
    rank,
    recentTasks: recentTasks.map(t => ({
      ...t,
      study_progress: Number(t.study_progress) || 0,
      test_score: t.test_score != null ? Number(t.test_score) : null,
    })),
    recentCheckins,
    recentSelfTests: recentSelfTests.map(t => ({
      ...t,
      total: Number(t.total) || 0,
      correct: Number(t.correct) || 0,
      accuracy: t.total > 0 ? Math.round(Number(t.correct) / Number(t.total) * 100) : 0,
    })),
  });
});

app.get('/api/word-books', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT wb.*, 
        (SELECT COUNT(*) FROM word_lists wl WHERE wl.word_book_id = wb.id) as list_count,
        (SELECT COUNT(*) FROM words w 
         INNER JOIN word_lists wl ON wl.id = w.word_list_id 
         WHERE wl.word_book_id = wb.id) as word_count
       FROM word_books wb 
       WHERE wb.teacher_id = ? 
       ORDER BY wb.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT DISTINCT wb.*, 
        (SELECT COUNT(*) FROM word_lists wl WHERE wl.word_book_id = wb.id) as list_count,
        (SELECT COUNT(*) FROM words w 
         INNER JOIN word_lists wl ON wl.id = w.word_list_id 
         WHERE wl.word_book_id = wb.id) as word_count
       FROM word_books wb
       WHERE (
         ${IS_PUBLIC}
         OR wb.id IN (
           SELECT DISTINCT wl2.word_book_id FROM word_lists wl2
           INNER JOIN tasks t ON t.word_list_id = wl2.id
           INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
         )
         OR wb.teacher_id = ?
       )
       ORDER BY wb.created_at DESC`
    ).all(req.user.id, req.user.id);
  }
  res.json({ wordBooks: rows });
});

app.post('/api/word-books', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, cover_color, cover_image, is_public } = req.body;
  if (!name) return res.status(400).json({ error: '请输入单词书名称' });
  const publicFlag = is_public === undefined ? (isPG ? true : 1) : (is_public ? (isPG ? true : 1) : (isPG ? false : 0));
  const info = await db.prepare(
    'INSERT INTO word_books (name, description, cover_color, cover_image, is_public, teacher_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, description || '', cover_color || '#6366f1', cover_image || null, publicFlag, req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/word-books/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, cover_color, cover_image, is_public } = req.body;
  const publicFlag = is_public === undefined ? (isPG ? true : 1) : (is_public ? (isPG ? true : 1) : (isPG ? false : 0));
  await db.prepare(
    'UPDATE word_books SET name = ?, description = ?, cover_color = ?, cover_image = ?, is_public = ? WHERE id = ? AND teacher_id = ?'
  ).run(name, description || '', cover_color || '#6366f1', cover_image || null, publicFlag, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/word-books/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const wb = await db.prepare('SELECT * FROM word_books WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!wb) return res.status(404).json({ error: '单词书不存在或无权限' });
  const hasLists = await db.prepare('SELECT 1 FROM word_lists WHERE word_book_id = ? LIMIT 1').get(req.params.id);
  if (hasLists) return res.status(400).json({ error: '该单词书下还有词表，请先删除词表' });
  await db.prepare('DELETE FROM word_books WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/word-lists', authMiddleware, async (req, res) => {
  const { word_book_id } = req.query;
  let rows;
  let baseSQL = 'SELECT wl.*, (SELECT COUNT(*) FROM words w WHERE w.word_list_id = wl.id) as word_count FROM word_lists wl';
  let whereSQL = '';
  let params = [];

  if (req.user.role === 'teacher') {
    whereSQL = ' WHERE wl.teacher_id = ?';
    params.push(req.user.id);
  } else {
    baseSQL += ' LEFT JOIN word_books wb ON wb.id = wl.word_book_id';
    whereSQL = ` WHERE (
      wl.word_book_id IS NULL
      OR ${IS_PUBLIC}
      OR EXISTS (
        SELECT 1 FROM tasks t
        INNER JOIN task_students ts ON ts.task_id = t.id
        WHERE t.word_list_id = wl.id AND ts.student_id = ?
      )
      OR wl.teacher_id = ?
    )`;
    params.push(req.user.id, req.user.id);
  }

  if (word_book_id) {
    whereSQL += ' AND wl.word_book_id = ?';
    params.push(word_book_id);
  }

  const finalSQL = baseSQL + whereSQL + ' ORDER BY wl.sort_order IS NULL, wl.sort_order ASC, wl.name ASC, wl.created_at DESC';
  rows = await db.prepare(finalSQL).all(...params);
  res.json({ wordLists: rows });
});

app.post('/api/word-lists', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, words, word_book_id } = req.body;
  if (!name) return res.status(400).json({ error: '请输入词表名称' });
  const info = await db.prepare(
    'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', word_book_id || null, req.user.id);
  const listId = info.lastInsertRowid;
  if (words && words.length) {
    const stmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.word && w.meaning) await stmt.run(listId, w.word, w.meaning, w.example || '', i + 1);
    }
  }
  res.json({ id: listId });
});

app.put('/api/word-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, word_book_id, sort_order } = req.body;
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  
  const finalName = name !== undefined ? name : list.name;
  const finalDesc = description !== undefined ? description : list.description;
  const finalBookId = word_book_id !== undefined ? (word_book_id || null) : list.word_book_id;
  
  if (sort_order !== undefined) {
    await db.prepare(
      'UPDATE word_lists SET name = ?, description = ?, word_book_id = ?, sort_order = ? WHERE id = ? AND teacher_id = ?'
    ).run(finalName, finalDesc || '', finalBookId, sort_order, req.params.id, req.user.id);
  } else {
    await db.prepare(
      'UPDATE word_lists SET name = ?, description = ?, word_book_id = ? WHERE id = ? AND teacher_id = ?'
    ).run(finalName, finalDesc || '', finalBookId, req.params.id, req.user.id);
  }
  res.json({ ok: true });
});

app.delete('/api/word-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  const hasTasks = await db.prepare('SELECT 1 FROM tasks WHERE word_list_id = ? LIMIT 1').get(req.params.id);
  if (hasTasks) return res.status(400).json({ error: '该词表有关联的任务，请先删除任务' });
  const wordIds = await db.prepare('SELECT id FROM words WHERE word_list_id = ?').all(req.params.id);
  for (const w of wordIds) {
    await db.prepare('DELETE FROM favorites WHERE word_id = ?').run(w.id);
  }
  await db.prepare('DELETE FROM words WHERE word_list_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM word_lists WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/words', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '词表不存在' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_lists wl
       LEFT JOIN word_books wb ON wb.id = wl.word_book_id
       WHERE wl.id = ? AND (
         wl.word_book_id IS NULL
         OR wl.teacher_id = ?
         OR ${IS_PUBLIC}
         OR EXISTS (
           SELECT 1 FROM tasks t
           INNER JOIN task_students ts ON ts.task_id = t.id
           WHERE t.word_list_id = wl.id AND ts.student_id = ?
         )
       )`
    ).get(req.params.id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const words = await db.prepare(
    'SELECT * FROM words WHERE word_list_id = ? ORDER BY sort_order, id'
  ).all(req.params.id);
  res.json({ words });
});

app.post('/api/word-lists/:id/words', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example } = req.body;
  if (!word || !meaning) return res.status(400).json({ error: '单词和释义必填' });
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM words WHERE word_list_id = ?').get(req.params.id);
  const nextOrder = (maxRow?.m || 0) + 1;
  const info = await db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, word, meaning, example || '', nextOrder);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/word-lists/:id/words/insert', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example, position, reference_word_id } = req.body;
  if (!word || !meaning) return res.status(400).json({ error: '单词和释义必填' });
  if (!['before', 'after', 'end'].includes(position)) {
    return res.status(400).json({ error: '无效的插入位置' });
  }
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });

  const allWords = await db.prepare('SELECT id, sort_order FROM words WHERE word_list_id = ? ORDER BY sort_order, id').all(req.params.id);
  let insertOrder;

  if (position === 'end' || allWords.length === 0) {
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM words WHERE word_list_id = ?').get(req.params.id);
    insertOrder = (maxRow?.m || 0) + 1;
  } else {
    const refWord = allWords.find(w => w.id === Number(reference_word_id));
    if (!refWord) return res.status(404).json({ error: '参考单词不存在' });
    insertOrder = position === 'before' ? refWord.sort_order : refWord.sort_order + 1;
    for (const w of allWords) {
      if (w.sort_order >= insertOrder) {
        await db.prepare('UPDATE words SET sort_order = sort_order + 1 WHERE id = ?').run(w.id);
      }
    }
  }

  const info = await db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, word, meaning, example || '', insertOrder);
  res.json({ id: info.lastInsertRowid, sort_order: insertOrder });
});

app.put('/api/words/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example } = req.body;
  const w = await db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE w.id = ? AND wl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: '单词不存在或无权限' });
  await db.prepare(
    'UPDATE words SET word = ?, meaning = ?, example = ? WHERE id = ?'
  ).run(word, meaning, example || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/words/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const w = await db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE w.id = ? AND wl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: '单词不存在或无权限' });
  await db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT t.*,
        (SELECT COUNT(DISTINCT student_id) FROM task_students ts WHERE ts.task_id = t.id) as student_count
       FROM tasks t
       WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT t.*, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at
       FROM tasks t
       INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       ORDER BY t.created_at DESC`
    ).all(req.user.id);
  }

  const wlNameCache = {};
  const getWlName = async (id) => {
    if (wlNameCache[id]) return wlNameCache[id];
    const wl = await db.prepare('SELECT name FROM word_lists WHERE id = ?').get(id);
    const name = wl ? wl.name : '未知词表';
    wlNameCache[id] = name;
    return name;
  };

  const tasksWithNames = [];
  for (const t of rows) {
    const listIds = getTaskWordListIds(t);
    const names = [];
    let totalWords = 0;
    for (const lid of listIds) {
      const name = await getWlName(lid);
      names.push(name);
      const wc = await db.prepare('SELECT COUNT(*) as cnt FROM words WHERE word_list_id = ?').get(lid);
      totalWords += Number(wc.cnt) || 0;
    }
    const wordListName = names.length > 1 ? `${names.join('、')}` : (names[0] || '未知词表');
    tasksWithNames.push({
      ...t,
      word_list_name: wordListName,
      word_list_count: listIds.length,
      total_words: totalWords,
    });
  }

  res.json({ tasks: tasksWithNames });
});

app.post('/api/tasks', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, word_list_id, word_list_ids, deadline, test_words_count, test_mode, student_ids, sentence_list_id } = req.body;
  if (!name) return res.status(400).json({ error: '请输入任务名称' });

  let listIds = [];
  if (word_list_ids && Array.isArray(word_list_ids) && word_list_ids.length > 0) {
    listIds = word_list_ids.map(Number);
  } else if (word_list_id) {
    listIds = [Number(word_list_id)];
  }
  if (listIds.length === 0) return res.status(400).json({ error: '请至少选择一个词表' });

  for (const lid of listIds) {
    const wl = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(lid, req.user.id);
    if (!wl) return res.status(403).json({ error: `词表 ID ${lid} 不存在或无权限` });
  }
  if (sentence_list_id) {
    const sl = await db.prepare('SELECT * FROM sentence_lists WHERE id = ? AND teacher_id = ?').get(sentence_list_id, req.user.id);
    if (!sl) return res.status(403).json({ error: '句子列表不存在或无权限' });
  }

  const wordListIdsJson = JSON.stringify(listIds);
  const primaryListId = listIds[0];

  const info = await db.prepare(
    'INSERT INTO tasks (name, word_list_id, word_list_ids, teacher_id, deadline, test_words_count, test_mode, sentence_list_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, primaryListId, wordListIdsJson, req.user.id, deadline || null, test_words_count || 10, test_mode || 'mixed', sentence_list_id || null);
  const taskId = info.lastInsertRowid;
  if (student_ids && student_ids.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO task_students (task_id, student_id) VALUES (?, ?)'
    );
    for (const sid of student_ids) await stmt.run(taskId, sid);
  }
  res.json({ id: taskId });
});

app.delete('/api/tasks/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在或无权限' });
  const tsIds = await db.prepare('SELECT id FROM task_students WHERE task_id = ?').all(req.params.id);
  for (const ts of tsIds) {
    await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
    await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  }
  await db.prepare('DELETE FROM task_students WHERE task_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM comments WHERE task_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM tasks WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/tasks/:id/progress', authMiddleware, requireRole('teacher'), async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在或无权限' });

  const listIds = getTaskWordListIds(task);
  const placeholders = listIds.map(() => '?').join(',');
  const totalWordsCount = listIds.length > 0
    ? (await db.prepare(`SELECT COUNT(*) as cnt FROM words WHERE word_list_id IN (${placeholders})`).all(...listIds))[0].cnt
    : 0;

  const rows = await db.prepare(
    `SELECT ts.*, u.username, ${totalWordsCount} as total_words
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);

  const words = listIds.length > 0
    ? await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY word_list_id, sort_order, id`
      ).all(...listIds)
    : [];

  res.json({ progress: rows, words });
});

app.get('/api/tasks/:id/study', authMiddleware, async (req, res) => {
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  const listIds = getTaskWordListIds(task);
  const placeholders = listIds.map(() => '?').join(',');
  const words = listIds.length > 0
    ? await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY word_list_id, sort_order, id`
      ).all(...listIds)
    : [];

  const studied = await db.prepare(
    'SELECT word_id, is_known FROM study_records WHERE task_student_id = ?'
  ).all(ts.id);
  const studiedMap = {};
  for (const s of studied) studiedMap[s.word_id] = s.is_known;
  await db.prepare(
    "UPDATE task_students SET status = CASE WHEN status = 'pending' THEN 'studying' ELSE status END, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(ts.id);
  res.json({ taskStudentId: ts.id, words, studiedMap });
});

app.post('/api/study-records', authMiddleware, async (req, res) => {
  const { task_student_id, word_id, is_known } = req.body;
  if (!task_student_id || !word_id) return res.status(400).json({ error: '参数错误' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  await db.prepare(
    `INSERT INTO study_records (task_student_id, word_id, is_known) VALUES (?, ?, ?)
     ON CONFLICT(task_student_id, word_id) DO UPDATE SET is_known = excluded.is_known, studied_at = CURRENT_TIMESTAMP`
  ).run(task_student_id, word_id, is_known ? 1 : 0);

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  const listIds = task ? getTaskWordListIds(task) : [];
  const studiedRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM study_records sr WHERE sr.task_student_id = ?'
  ).get(ts.id);
  const studied = Number(studiedRow.cnt) || 0;

  let total = 0;
  if (listIds.length > 0) {
    const placeholders = listIds.map(() => '?').join(',');
    const totalRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM words WHERE word_list_id IN (${placeholders})`
    ).all(...listIds);
    total = Number(totalRow[0].cnt) || 0;
  }

  const pct = total > 0 ? Math.min(100, (studied / total) * 100) : 0;
  await db.prepare('UPDATE task_students SET study_progress = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(pct, task_student_id);
  res.json({ ok: true, progress: pct });
});

app.get('/api/tasks/:id/test-words', authMiddleware, async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });

  const listIds = getTaskWordListIds(task);
  const limit = task.test_words_count || 10;
  let allWords = [];

  if (listIds.length > 0) {
    const placeholders = listIds.map(() => '?').join(',');
    const totalCountRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM words WHERE word_list_id IN (${placeholders})`
    ).all(...listIds);
    const totalCount = Number(totalCountRow[0].cnt) || 0;

    if (totalCount <= limit) {
      allWords = await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY RANDOM()`
      ).all(...listIds);
    } else {
      allWords = await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`
      ).all(...listIds, limit);
    }
  }

  const mode = task.test_mode || 'en_to_zh';
  const words = allWords.map((w, i) => {
    let qType = 'en_to_zh';
    if (mode === 'zh_to_en') qType = 'zh_to_en';
    else if (mode === 'mixed') qType = i % 2 === 0 ? 'en_to_zh' : 'zh_to_en';
    return { ...w, question_type: qType };
  });
  res.json({ taskStudentId: ts.id, words, testMode: mode });
});

app.post('/api/tests/submit', authMiddleware, async (req, res) => {
  const { task_student_id, answers } = req.body;
  if (!task_student_id || !answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  let correct = 0;
  const insertTr = db.prepare(
    'INSERT INTO test_records (task_student_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    const word = await db.prepare('SELECT * FROM words WHERE id = ?').get(a.word_id);
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    let isCorrect = false;
    const userAns = (a.user_answer || '').trim().toLowerCase();
    if (userAns.length === 0) {
      isCorrect = false;
    } else {
      const normUserAns = normalizeForCompare(userAns);
      if (qType === 'zh_to_en') {
        const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        isCorrect = validWords.some(w => {
          const nw = normalizeForCompare(w);
          return nw === normUserAns || normUserAns.includes(nw) || nw.includes(normUserAns);
        });
      } else {
        const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
        const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
        isCorrect = validMeanings.some(m => {
          const nm = normalizeForCompare(m);
          return nm === normUserAns || normUserAns.includes(nm) || nm.includes(normUserAns);
        });
      }
    }
    if (isCorrect) correct++;
    await insertTr.run(task_student_id, a.word_id, a.user_answer || '', isCorrect ? 1 : 0, qType);
  }
  const score = (correct / answers.length) * 100;
  await db.prepare(
    "UPDATE task_students SET status = 'tested', test_score = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(score, task_student_id);
  res.json({ score, correct, total: answers.length });
});

app.get('/api/tasks/:id/test-result', authMiddleware, async (req, res) => {
  let ts;
  if (req.user.role === 'teacher') {
    ts = await db.prepare(
      `SELECT ts.* FROM task_students ts
       INNER JOIN tasks t ON t.id = ts.task_id
       WHERE ts.task_id = ? AND t.teacher_id = ?`
    ).get(req.params.id, req.user.id);
  } else {
    ts = await db.prepare(
      'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
    ).get(req.params.id, req.user.id);
  }
  if (!ts) return res.status(404).json({ error: '未找到' });
  const records = await db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(ts.id);
  res.json({ score: ts.test_score, records });
});

app.put('/api/me/password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '参数错误' });
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
    return res.status(400).json({ error: '新密码长度需在6-100之间' });
  }
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10), req.user.id
  );
  res.json({ ok: true });
});

app.put('/api/me/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body;
  if (avatar === undefined) return res.status(400).json({ error: '参数错误' });
  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
  res.json({ ok: true });
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT f.*, w.word, w.meaning, w.example, w.word_list_id, wl.name as word_list_name
     FROM favorites f
     INNER JOIN words w ON w.id = f.word_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ).all(req.user.id);
  res.json({ favorites: rows });
});

app.post('/api/favorites', authMiddleware, async (req, res) => {
  const { word_id } = req.body;
  if (!word_id) return res.status(400).json({ error: '参数错误' });
  await db.prepare('INSERT OR IGNORE INTO favorites (user_id, word_id) VALUES (?, ?)').run(req.user.id, word_id);
  res.json({ ok: true });
});

app.delete('/api/favorites/:wordId', authMiddleware, async (req, res) => {
  await db.prepare('DELETE FROM favorites WHERE user_id = ? AND word_id = ?').run(req.user.id, req.params.wordId);
  res.json({ ok: true });
});

app.get('/api/wrong-book', authMiddleware, async (req, res) => {
  const { sort = 'error_count' } = req.query;
  const orderBy = sort === 'recent'
    ? 'MAX(all_rec.tested_at) DESC'
    : sort === 'word'
    ? 'w.word ASC'
    : 'SUM(CASE WHEN all_rec.is_correct = 0 THEN 1 ELSE 0 END) DESC, MAX(all_rec.tested_at) DESC';
  const rows = await db.prepare(
    `SELECT w.*, wl.name as word_list_name,
       SUM(CASE WHEN all_rec.is_correct = 0 THEN 1 ELSE 0 END) as error_count,
       SUM(CASE WHEN all_rec.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
       MAX(all_rec.tested_at) as last_tested_at
     FROM (
       SELECT tr.word_id, tr.is_correct, tr.tested_at
       FROM test_records tr
       INNER JOIN task_students ts ON ts.id = tr.task_student_id
       WHERE ts.student_id = ?
       UNION ALL
       SELECT str.word_id, str.is_correct, str.created_at as tested_at
       FROM self_test_records str
       INNER JOIN self_tests st ON st.id = str.self_test_id
       WHERE st.student_id = ?
     ) all_rec
     INNER JOIN words w ON w.id = all_rec.word_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     GROUP BY w.id, w.word, w.meaning, w.example, w.created_at, w.word_list_id, wl.name
     HAVING SUM(CASE WHEN all_rec.is_correct = 0 THEN 1 ELSE 0 END) > 0
     ORDER BY ${orderBy}`
  ).all(req.user.id, req.user.id);
  const fixedRows = rows.map(r => ({
    ...r,
    error_count: Number(r.error_count) || 0,
    correct_count: Number(r.correct_count) || 0,
  }));
  res.json({ wrongWords: fixedRows });
});

app.get('/api/stats/me', authMiddleware, async (req, res) => {
  const totalTasks = (await db.prepare(
    'SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ?'
  ).get(req.user.id)).cnt;
  const testedTasks = (await db.prepare(
    "SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ? AND status = 'tested'"
  ).get(req.user.id)).cnt;
  const avgScore = (await db.prepare(
    'SELECT AVG(test_score) as avg FROM task_students WHERE student_id = ? AND test_score IS NOT NULL'
  ).get(req.user.id)).avg || 0;
  const studyDays = (await db.prepare(
    "SELECT COUNT(DISTINCT DATE(last_studied_at)) as cnt FROM task_students WHERE student_id = ? AND last_studied_at IS NOT NULL"
  ).get(req.user.id)).cnt;
  const totalWords = (await db.prepare(
    `SELECT COUNT(DISTINCT sr.word_id) as cnt FROM study_records sr
     INNER JOIN task_students ts ON ts.id = sr.task_student_id
     WHERE ts.student_id = ?`
  ).get(req.user.id)).cnt;
  const wrongCount = (await db.prepare(
    `SELECT COUNT(DISTINCT tr.word_id) as cnt FROM test_records tr
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     WHERE ts.student_id = ? AND tr.is_correct = 0`
  ).get(req.user.id)).cnt;
  res.json({
    totalTasks: Number(totalTasks) || 0,
    testedTasks: Number(testedTasks) || 0,
    avgScore: Math.round(Number(avgScore) || 0),
    studyDays: Number(studyDays) || 0,
    totalWords: Number(totalWords) || 0,
    wrongCount: Number(wrongCount) || 0,
  });
});

app.get('/api/study-stats', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const uid = req.user.id;

  const userRow = await db.prepare(
    'SELECT rank_bonus_days, rank_bonus_words FROM users WHERE id = ?'
  ).get(uid);
  const bonusDays = Number(userRow?.rank_bonus_days) || 0;
  const bonusWords = Number(userRow?.rank_bonus_words) || 0;

  const todaySession = await db.prepare(
    'SELECT * FROM study_sessions WHERE student_id = ? AND session_date = ?'
  ).get(uid, today);

  const totalDurationRow = await db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as s FROM study_sessions WHERE student_id = ?'
  ).get(uid);

  const totalWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(uid);

  const checkinRows = await db.prepare(
    'SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC'
  ).all(uid);

  let streak = 0;
  const dates = checkinRows.map(r => r.checkin_date);
  const dateSet = new Set(dates);
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const todayStr = cursor.toISOString().slice(0, 10);
  const yesterday = new Date(cursor);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (dateSet.has(todayStr) || dateSet.has(yesterdayStr)) {
    if (!dateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const d = cursor.toISOString().slice(0, 10);
      if (dateSet.has(d)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
  }

  res.json({
    todayDuration: Number(todaySession?.duration_seconds) || 0,
    totalDuration: Number(totalDurationRow.s) || 0,
    todayWords: Number(todaySession?.words_studied) || 0,
    totalWords: Number(totalWordsRow.w) || 0,
    checkinDays: checkinRows.length,
    streakDays: streak,
    rank_bonus_days: bonusDays,
    rank_bonus_words: bonusWords,
  });
});

app.post('/api/study-sessions/track', authMiddleware, async (req, res) => {
  let { duration_seconds = 0, words_studied = 0 } = req.body;
  duration_seconds = Math.min(Math.max(Number(duration_seconds) || 0, 0), 86400);
  words_studied = Math.min(Math.max(Number(words_studied) || 0, 0), 10000);
  const today = new Date().toISOString().slice(0, 10);
  const uid = req.user.id;

  const exists = await db.prepare(
    'SELECT * FROM study_sessions WHERE student_id = ? AND session_date = ?'
  ).get(uid, today);

  if (exists) {
    await db.prepare(
      `UPDATE study_sessions SET duration_seconds = duration_seconds + ?,
        words_studied = words_studied + ? WHERE id = ?`
    ).run(duration_seconds, words_studied, exists.id);
  } else {
    await db.prepare(
      'INSERT INTO study_sessions (student_id, session_date, duration_seconds, words_studied) VALUES (?, ?, ?, ?)'
    ).run(uid, today, duration_seconds, words_studied);
  }
  res.json({ ok: true });
});

app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  const nullsLast = db.isPG ? 'NULLS LAST' : '';
  const rows = await db.prepare(
    `SELECT u.id, u.username,
      COUNT(DISTINCT ts.id) as tasks,
      AVG(CASE WHEN ts.test_score IS NOT NULL THEN ts.test_score END) as avg_score,
      COUNT(DISTINCT DATE(ts.last_studied_at)) as days
     FROM users u
     LEFT JOIN task_students ts ON ts.student_id = u.id
     WHERE u.role = 'student'
     GROUP BY u.id
     ORDER BY avg_score DESC ${nullsLast}, days DESC, tasks DESC
     LIMIT 20`
  ).all();
  const fixedRows = rows.map(r => ({
    ...r,
    tasks: Number(r.tasks) || 0,
    days: Number(r.days) || 0,
    avg_score: Number(r.avg_score) || 0,
  }));
  res.json({ leaderboard: fixedRows });
});

app.post('/api/users/batch', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: '参数错误' });
  if (users.length > 1000) return res.status(400).json({ error: '单次最多创建 1000 个用户' });
  let added = 0, skipped = 0;
  await db.transaction(async (txDb) => {
    const stmt = txDb.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    );
    for (const u of users) {
      if (!u.username || !u.password) { skipped++; continue; }
      if (typeof u.username !== 'string' || u.username.length < 2 || u.username.length > 50) { skipped++; continue; }
      if (typeof u.password !== 'string' || u.password.length < 6 || u.password.length > 100) { skipped++; continue; }
      if (u.role && !['teacher', 'student'].includes(u.role)) { skipped++; continue; }
      const exists = await txDb.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
      if (exists) { skipped++; continue; }
      await stmt.run(u.username.trim(), bcrypt.hashSync(u.password, 10), u.role || 'student');
      added++;
    }
  });
  res.json({ added, skipped });
});

app.get('/api/tasks/:id/export', authMiddleware, requireRole('teacher'), async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在或无权限' });
  const rows = await db.prepare(
    `SELECT u.username, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);
  const csv = [
    ['用户名', '状态', '学习进度%', '测试分数', '最后学习时间'].join(','),
    ...rows.map(r => [
      r.username,
      { pending: '未开始', studying: '学习中', tested: '已测试' }[r.status] || r.status,
      r.study_progress || 0,
      r.test_score ?? '',
      r.last_studied_at || ''
    ].join(','))
  ].join('\n');
  const safeName = (task?.name || '成绩').replace(/[<>"\\\r\n\t;]/g, '').slice(0, 50);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
  res.send('\ufeff' + csv);
});

app.post('/api/task-students/:id/reset', authMiddleware, requireRole('teacher'), async (req, res) => {
  const ts = await db.prepare(
    `SELECT ts.* FROM task_students ts
     INNER JOIN tasks t ON t.id = ts.task_id
     WHERE ts.id = ? AND t.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未找到或无权限' });
  await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
  await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  await db.prepare(
    "UPDATE task_students SET status = 'pending', study_progress = 0, test_score = NULL, last_studied_at = NULL WHERE id = ?"
  ).run(ts.id);
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/export', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) {
      return res.status(403).json({ error: '无权限' });
    }
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_lists wl
       LEFT JOIN word_books wb ON wb.id = wl.word_book_id
       WHERE wl.id = ? AND (
         wl.word_book_id IS NULL
         OR wl.teacher_id = ?
         OR ${IS_PUBLIC}
         OR EXISTS (
           SELECT 1 FROM tasks t
           INNER JOIN task_students ts ON ts.task_id = t.id
           WHERE t.word_list_id = wl.id AND ts.student_id = ?
         )
       )`
    ).get(req.params.id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const words = await db.prepare('SELECT word, meaning, example FROM words WHERE word_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, words });
});

app.post('/api/word-lists/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, words, word_book_id } = req.body;
  if (!name || !words || !Array.isArray(words)) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', word_book_id || null, req.user.id);
  const listId = info.lastInsertRowid;
  const stmt = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  let count = 0;
  const seen = new Set();
  for (const w of words) {
    if (!w.word || !w.meaning) continue;
    const key = w.word.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    count++;
    await stmt.run(listId, w.word.trim(), w.meaning.trim(), w.example || '', count);
  }
  res.json({ id: listId, imported: count, skipped: words.length - count });
});

app.post('/api/word-lists/:id/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { words } = req.body;
  if (!words || !Array.isArray(words)) return res.status(400).json({ error: '参数错误' });
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  const existing = await db.prepare('SELECT word FROM words WHERE word_list_id = ?').all(req.params.id);
  const existingSet = new Set(existing.map(w => w.word.trim().toLowerCase()));
  const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM words WHERE word_list_id = ?').get(req.params.id);
  let sortIdx = maxRow?.m || 0;
  const stmt = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  let count = 0;
  const seen = new Set();
  for (const w of words) {
    if (!w.word || !w.meaning) continue;
    const key = w.word.trim().toLowerCase();
    if (existingSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    sortIdx++;
    count++;
    await stmt.run(req.params.id, w.word.trim(), w.meaning.trim(), w.example || '', sortIdx);
  }
  res.json({ id: req.params.id, imported: count, skipped: words.length - count });
});

app.get('/api/comments', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT c.*, u.username as student_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.student_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.teacher_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT c.*, u.username as teacher_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.teacher_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.student_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ comments: rows });
});

app.post('/api/comments', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { student_id, task_id, content } = req.body;
  if (!student_id || !content) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO comments (teacher_id, student_id, task_id, content) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, student_id, task_id || null, content);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/comments/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM comments WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/settings', authMiddleware, async (req, res) => {
  let s;
  try {
    s = await db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  } catch (e) {
    console.warn('获取设置失败，使用默认值:', e.message);
    s = null;
  }
  if (!s) s = { theme: 'light', voice: 'default' };
  if (!s.voice) s.voice = 'default';
  res.json({ settings: s });
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  const { theme, voice } = req.body;
  let existing;
  try {
    existing = await db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  } catch (e) { existing = null; }
  if (existing) {
    try {
      await db.prepare(
        'UPDATE settings SET theme = ?, voice = ? WHERE user_id = ?'
      ).run(theme || existing.theme || 'light', voice !== undefined ? voice : existing.voice || 'default', req.user.id);
    } catch (e) {
      await db.prepare('UPDATE settings SET theme = ? WHERE user_id = ?').run(theme || existing.theme || 'light', req.user.id);
    }
  } else {
    try {
      await db.prepare(
        `INSERT INTO settings (user_id, theme, voice) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme, voice = excluded.voice`
      ).run(req.user.id, theme || 'light', voice || 'default');
    } catch (e) {
      await db.prepare(`INSERT INTO settings (user_id, theme) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme`).run(req.user.id, theme || 'light');
    }
  }
  res.json({ ok: true });
});

app.get('/api/sentence-lists', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      'SELECT * FROM sentence_lists WHERE teacher_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT DISTINCT sl.* FROM sentence_lists sl
       LEFT JOIN tasks t ON t.sentence_list_id = sl.id
       LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       WHERE sl.teacher_id = ? OR ts.id IS NOT NULL
       ORDER BY sl.created_at DESC`
    ).all(req.user.id, req.user.id);
  }
  res.json({ sentenceLists: rows });
});

app.post('/api/sentence-lists', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '名称必填' });
  const info = await db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description } = req.body;
  await db.prepare('UPDATE sentence_lists SET name = ?, description = ? WHERE id = ? AND teacher_id = ?').run(name, description || '', req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '句子列表不存在或无权限' });
  const hasTasks = await db.prepare('SELECT 1 FROM tasks WHERE sentence_list_id = ? LIMIT 1').get(req.params.id);
  if (hasTasks) return res.status(400).json({ error: '该句子列表有关联的任务，请先删除任务' });
  await db.prepare('DELETE FROM sentences WHERE sentence_list_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM sentence_lists WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/sentences', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '句子列表不存在' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM sentence_lists sl
       LEFT JOIN tasks t ON t.sentence_list_id = sl.id
       LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       WHERE sl.id = ? AND (sl.teacher_id = ? OR ts.id IS NOT NULL)`
    ).get(req.user.id, req.params.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const rows = await db.prepare('SELECT * FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ sentences: rows });
});

app.post('/api/sentence-lists/:id/sentences', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary } = req.body;
  if (!sentence_en || !sentence_zh) return res.status(400).json({ error: '英文和中文都必填' });
  const info = await db.prepare(
    'INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, sentence_en, sentence_zh, analysis || '', vocabulary || '', grammar || '', structure || '', correction || '', summary || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentences/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary } = req.body;
  const s = await db.prepare(
    `SELECT s.* FROM sentences s
     INNER JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE s.id = ? AND sl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: '句子不存在或无权限' });
  await db.prepare('UPDATE sentences SET sentence_en = ?, sentence_zh = ?, analysis = ?, vocabulary = ?, grammar = ?, structure = ?, correction = ?, summary = ? WHERE id = ?').run(sentence_en, sentence_zh, analysis || '', vocabulary || '', grammar || '', structure || '', correction || '', summary || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/sentences/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const s = await db.prepare(
    `SELECT s.* FROM sentences s
     INNER JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE s.id = ? AND sl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: '句子不存在或无权限' });
  await db.prepare('DELETE FROM sentences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/export', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '不存在' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM sentence_lists sl
       LEFT JOIN tasks t ON t.sentence_list_id = sl.id
       LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       WHERE sl.id = ? AND (sl.teacher_id = ? OR ts.id IS NOT NULL)`
    ).get(req.user.id, req.params.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const sentences = await db.prepare('SELECT sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, sentences });
});

app.post('/api/sentence-lists/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, sentences } = req.body;
  if (!name || !Array.isArray(sentences)) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  const insert = db.prepare('INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  let count = 0;
  for (const s of sentences) {
    if (s.sentence_en && s.sentence_zh) {
      await insert.run(info.lastInsertRowid, s.sentence_en, s.sentence_zh, s.analysis || '', s.vocabulary || '', s.grammar || '', s.structure || '', s.correction || '', s.summary || '');
      count++;
    }
  }
  res.json({ id: info.lastInsertRowid, imported: count });
});

app.post('/api/translation/submit', authMiddleware, async (req, res) => {
  const { sentence_id, user_translation, is_correct } = req.body;
  if (!sentence_id) return res.status(400).json({ error: '参数错误' });
  await db.prepare(
    'INSERT INTO translation_records (student_id, sentence_id, user_translation, is_correct) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, sentence_id, user_translation || '', is_correct ? 1 : 0);
  res.json({ ok: true });
});

app.get('/api/translation/records', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT tr.*, s.sentence_en, s.sentence_zh, s.analysis, sl.name as list_name
     FROM translation_records tr
     INNER JOIN sentences s ON s.id = tr.sentence_id
     LEFT JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE tr.student_id = ? ORDER BY tr.translated_at DESC LIMIT 200`
  ).all(req.user.id);
  res.json({ records: rows });
});

app.get('/api/task-students/:id/test-records', authMiddleware, requireRole('teacher'), async (req, res) => {
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  if (task && task.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  const records = await db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example, u.username as student_name
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     INNER JOIN users u ON u.id = ts.student_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(req.params.id);
  res.json({ taskStudent: ts, records });
});

app.put('/api/test-records/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { is_correct } = req.body;
  const rec = await db.prepare('SELECT * FROM test_records WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: '未找到' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(rec.task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  if (task && task.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare('UPDATE test_records SET is_correct = ? WHERE id = ?').run(is_correct ? 1 : 0, req.params.id);
  const stats = await db.prepare(
    'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct FROM test_records WHERE task_student_id = ?'
  ).get(ts.id);
  const score = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  await db.prepare('UPDATE task_students SET test_score = ? WHERE id = ?').run(score, ts.id);
  res.json({ ok: true, score });
});

app.get('/api/checkins/status', authMiddleware, requireRole('student'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const studentId = req.user.id;

  let bonusDays = 0, bonusWords = 0;
  try {
    const userRow = await db.prepare(
      'SELECT rank_bonus_days, rank_bonus_words FROM users WHERE id = ?'
    ).get(studentId);
    bonusDays = Number(userRow?.rank_bonus_days) || 0;
    bonusWords = Number(userRow?.rank_bonus_words) || 0;
  } catch (e) {
    console.warn('获取等级奖励字段失败，使用默认值 0:', e.message);
  }

  const todayCheckin = await db.prepare(
    "SELECT * FROM checkins WHERE student_id = ? AND checkin_date = ?"
  ).get(studentId, today);

  const totalCheckins = await db.prepare(
    "SELECT COUNT(*) as cnt FROM checkins WHERE student_id = ?"
  ).get(studentId);

  let canCheckin = false;
  let checkinReason = '';
  let todayTest = null;

  const recentTasks = await db.prepare(
    `SELECT ts.*, t.name as task_name
       FROM task_students ts
       LEFT JOIN tasks t ON t.id = ts.task_id
       WHERE ts.student_id = ? AND ts.status = 'tested'
       ORDER BY ts.last_studied_at DESC LIMIT 20`
  ).all(studentId);

  const todayTaskTests = recentTasks.filter(ts => {
    if (!ts.last_studied_at) return false;
    const testDate = new Date(ts.last_studied_at).toISOString().split('T')[0];
    return testDate === today;
  });

  const recentSelfTests = await db.prepare(
    `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
       FROM self_tests st
       LEFT JOIN word_books wb ON wb.id = st.word_book_id
       LEFT JOIN word_lists wl ON wl.id = st.word_list_id
       WHERE st.student_id = ?
       ORDER BY st.created_at DESC LIMIT 20`
  ).all(studentId);

  const todaySelfTests = recentSelfTests.filter(st => {
    if (!st.created_at) return false;
    const testDate = new Date(st.created_at).toISOString().split('T')[0];
    return testDate === today;
  });

  const allTodayScores = [
    ...todayTaskTests.map(t => ({ score: t.test_score || 0, name: t.task_name || '任务测试', type: 'task' })),
    ...todaySelfTests.map(t => ({ score: t.score || 0, name: t.word_book_name || t.word_list_name || '自测', type: 'self' })),
  ];

  if (allTodayScores.length > 0) {
    const bestScore = Math.max(...allTodayScores.map(t => t.score));
    const bestTest = allTodayScores.find(t => t.score === bestScore);
    todayTest = { score: bestScore, name: bestTest.name, type: bestTest.type };
    if (bestScore >= 70) {
      canCheckin = !todayCheckin;
      checkinReason = canCheckin ? `今日最佳成绩 ${Math.round(bestScore)}%（${bestTest.name}），可以打卡！` : '今日已打卡';
    } else {
      checkinReason = `今日最高正确率仅 ${Math.round(bestScore)}%，需达到 70% 才能打卡`;
    }
  } else {
    checkinReason = '今日还没有完成测试，完成测试且正确率 ≥ 70% 即可打卡（任务测试或自测均可）';
  }

  const allCheckins = await db.prepare(
    "SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC"
  ).all(studentId);

  const totalWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(studentId);
  const totalWords = Number(totalWordsRow.w) || 0;

  const streak = calcStreak(allCheckins);
  const total = totalCheckins.cnt || 0;

  const effectiveStreak = streak + bonusDays;
  const effectiveTotal = total + bonusDays;
  const effectiveWords = totalWords + bonusWords;

  const rank = getRank(effectiveStreak, effectiveWords);
  const rankByTotal = getRank(effectiveTotal, effectiveWords);
  const nextRank = getNextRank(effectiveStreak, effectiveWords);

  res.json({
    checked_in: !!todayCheckin,
    can_checkin: canCheckin,
    checkin_reason: checkinReason,
    today_test: todayTest,
    total_checkins: total,
    today_checkin: todayCheckin,
    streak: streak,
    total_words: totalWords,
    rank_bonus_days: bonusDays,
    rank_bonus_words: bonusWords,
    rank: rank,
    rank_total: rankByTotal,
    next_rank: nextRank,
  });
});

app.post('/api/checkins', authMiddleware, requireRole('student'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const studentId = req.user.id;

  const todayCheckin = await db.prepare(
    "SELECT * FROM checkins WHERE student_id = ? AND checkin_date = ?"
  ).get(studentId, today);

  if (todayCheckin) {
    return res.status(400).json({ error: '今日已打卡' });
  }

  const taskTests = await db.prepare(
    `SELECT ts.* FROM task_students ts
       WHERE ts.student_id = ? AND ts.status = 'tested'`
  ).all(studentId);

  const todayValidTasks = taskTests.filter(ts => {
    if (!ts.last_studied_at) return false;
    const testDate = new Date(ts.last_studied_at).toISOString().split('T')[0];
    return testDate === today && (ts.test_score || 0) >= 70;
  });

  const selfTests = await db.prepare(
    `SELECT * FROM self_tests WHERE student_id = ?`
  ).all(studentId);

  const todayValidSelf = selfTests.filter(st => {
    if (!st.created_at) return false;
    const testDate = new Date(st.created_at).toISOString().split('T')[0];
    return testDate === today && (st.score || 0) >= 70;
  });

  const allValid = [
    ...todayValidTasks.map(t => ({ id: t.id, score: t.test_score || 0, type: 'task' })),
    ...todayValidSelf.map(t => ({ id: t.id, score: t.score || 0, type: 'self' })),
  ];

  if (allValid.length === 0) {
    return res.status(400).json({ error: '今日没有符合条件的测试记录（需正确率 ≥ 70%，任务测试或自测均可）' });
  }

  const bestTest = allValid.reduce((a, b) => a.score > b.score ? a : b);

  const info = await db.prepare(
    `INSERT INTO checkins (student_id, checkin_date, task_student_id, test_score)
       VALUES (?, ?, ?, ?)`
  ).run(studentId, today, bestTest.type === 'task' ? bestTest.id : null, bestTest.score);

  res.json({ ok: true, id: info.lastInsertRowid, test_score: bestTest.score });
});

app.get('/api/checkins', authMiddleware, requireRole('student'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT * FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC LIMIT 30`
  ).all(req.user.id);
  res.json({ checkins: rows });
});

app.get('/api/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM student_tags st WHERE st.tag_id = t.id) as student_count
       FROM tags t WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
  ).all(req.user.id);
  res.json({ tags: rows });
});

app.post('/api/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入标签名称' });
  const info = await db.prepare(
    'INSERT INTO tags (name, color, teacher_id) VALUES (?, ?, ?)'
  ).run(name.trim(), color || '#6366f1', req.user.id);
  res.json({ id: info.lastInsertRowid, ok: true });
});

app.put('/api/tags/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, color } = req.body;
  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: '标签不存在' });
  if (tag.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare(
    'UPDATE tags SET name = ?, color = ? WHERE id = ?'
  ).run(name || tag.name, color || tag.color, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tags/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: '标签不存在' });
  if (tag.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare('DELETE FROM student_tags WHERE tag_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/students/:id/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT t.* FROM tags t
         INNER JOIN student_tags st ON st.tag_id = t.id
         WHERE st.student_id = $1 AND t.teacher_id = $2`
      : `SELECT t.* FROM tags t
         INNER JOIN student_tags st ON st.tag_id = t.id
         WHERE st.student_id = ? AND t.teacher_id = ?`
  ).all(req.params.id, req.user.id);
  res.json({ tags: rows });
});

app.post('/api/students/:id/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { tag_ids } = req.body;
  const studentId = req.params.id;
  await db.prepare('DELETE FROM student_tags WHERE student_id = ?').run(studentId);
  if (tag_ids && tag_ids.length > 0) {
    const insert = db.prepare(
      isPG
        ? 'INSERT INTO student_tags (student_id, tag_id) VALUES ($1, $2)'
        : 'INSERT INTO student_tags (student_id, tag_id) VALUES (?, ?)'
    );
    for (const tagId of tag_ids) {
      const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
      if (tag && tag.teacher_id === req.user.id) {
        try { await insert.run(studentId, tagId); } catch (e) {}
      }
    }
  }
  res.json({ ok: true });
});

app.get('/api/tags/:id/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT u.* FROM users u
         INNER JOIN student_tags st ON st.student_id = u.id
         WHERE st.tag_id = $1`
      : `SELECT u.* FROM users u
         INNER JOIN student_tags st ON st.student_id = u.id
         WHERE st.tag_id = ?`
  ).all(req.params.id);
  res.json({ students: rows });
});

app.get('/api/checkins/all', authMiddleware, requireRole('teacher'), async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const rows = await db.prepare(
    isPG
      ? `SELECT c.*, u.username
         FROM checkins c
         LEFT JOIN users u ON u.id = c.student_id
         WHERE c.checkin_date = $1
         ORDER BY c.created_at DESC`
      : `SELECT c.*, u.username
         FROM checkins c
         LEFT JOIN users u ON u.id = c.student_id
         WHERE c.checkin_date = ?
         ORDER BY c.created_at DESC`
  ).all(date);
  const allStudents = await db.prepare("SELECT id, username FROM users WHERE role = 'student'").all();
  res.json({ checkins: rows, all_students: allStudents, date });
});

app.get('/api/self-tests/words', authMiddleware, requireRole('student'), async (req, res) => {
  const { word_book_id, word_list_id, count = 20, mode = 'fill_blank', lang_mode = 'mixed' } = req.query;
  let words = [];
  if (word_list_id) {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_lists wl
       LEFT JOIN word_books wb ON wb.id = wl.word_book_id
       WHERE wl.id = ? AND (
         wl.word_book_id IS NULL
         OR wl.teacher_id = ?
         OR ${IS_PUBLIC}
         OR EXISTS (
           SELECT 1 FROM tasks t
           INNER JOIN task_students ts ON ts.task_id = t.id
           WHERE t.word_list_id = wl.id AND ts.student_id = ?
         )
       )`
    ).get(word_list_id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限访问该词表' });
    words = await db.prepare('SELECT * FROM words WHERE word_list_id = ? ORDER BY RANDOM() LIMIT ?').all(word_list_id, Math.min(Number(count), 100));
  } else if (word_book_id) {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_books wb
       WHERE wb.id = ? AND (
         ${IS_PUBLIC} OR wb.teacher_id = ? OR
         EXISTS (
           SELECT 1 FROM word_lists wl2
           INNER JOIN tasks t ON t.word_list_id = wl2.id
           INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
           WHERE wl2.word_book_id = wb.id
         )
       )`
    ).get(word_book_id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限访问该单词书' });
    words = await db.prepare(
      `SELECT w.* FROM words w
       INNER JOIN word_lists wl ON wl.id = w.word_list_id
       WHERE wl.word_book_id = ?
       ORDER BY RANDOM() LIMIT ?`
    ).all(word_book_id, Math.min(Number(count), 100));
  }

  const allWords = await db.prepare(`
    SELECT w.* FROM words w
    INNER JOIN word_lists wl ON wl.id = w.word_list_id
    WHERE wl.id IN (
      SELECT wl2.id FROM word_lists wl2
      LEFT JOIN word_books wb ON wb.id = wl2.word_book_id
      WHERE wl2.teacher_id = ? OR ${IS_PUBLIC}
    )
    ORDER BY RANDOM() LIMIT 200
  `).all(req.user.id);

  const getLangMode = () => {
    if (lang_mode === 'en_to_zh') return 'en_to_zh';
    if (lang_mode === 'zh_to_en') return 'zh_to_en';
    return Math.random() > 0.5 ? 'en_to_zh' : 'zh_to_en';
  };

  const makeChoiceOptions = (correctWord, allWordsList, direction) => {
    const shuffled = [...allWordsList].sort(() => Math.random() - 0.5).filter(w => w.id !== correctWord.id);
    const distractors = shuffled.slice(0, 3);
    const correctOption = direction === 'en_to_zh' ? correctWord.meaning : correctWord.word;
    const options = [
      correctOption,
      ...distractors.map(w => direction === 'en_to_zh' ? w.meaning : w.word)
    ].map((text, idx) => ({ label: String.fromCharCode(65 + idx), text }));
    return options.sort(() => Math.random() - 0.5);
  };

  const makeListeningOptions = (correctWord, allWordsList) => {
    const shuffled = [...allWordsList].sort(() => Math.random() - 0.5).filter(w => w.id !== correctWord.id);
    const distractors = shuffled.slice(0, 3);
    const options = [
      { word: correctWord.word, meaning: correctWord.meaning, is_correct: true },
      ...distractors.map(w => ({ word: w.word, meaning: w.meaning, is_correct: false }))
    ].sort(() => Math.random() - 0.5);
    return options;
  };

  const questionTypes = ['fill_blank', 'choice', 'spelling', 'listening', 'mixed'];
  const validMode = questionTypes.includes(mode) ? mode : 'fill_blank';

  const questions = words.map(w => {
    let qType = validMode;
    if (qType === 'mixed') {
      const coreTypes = ['fill_blank', 'choice', 'spelling', 'listening'];
      qType = coreTypes[Math.floor(Math.random() * coreTypes.length)];
    }
    const lMode = getLangMode();
    const base = {
      word_id: w.id,
      word: w.word,
      meaning: w.meaning,
      question_type: qType,
      lang_mode: lMode,
    };

    if (qType === 'fill_blank') {
      return { ...base, question_type: lMode };
    } else if (qType === 'choice') {
      return {
        ...base,
        options: makeChoiceOptions(w, allWords, lMode),
      };
    } else if (qType === 'spelling') {
      const firstLetter = w.word.charAt(0);
      const blankHint = firstLetter + '_'.repeat(Math.max(0, w.word.length - 1));
      return {
        ...base,
        lang_mode: 'zh_to_en',
        hint: blankHint,
      };
    } else if (qType === 'listening') {
      return {
        ...base,
        lang_mode: 'en_to_zh',
        options: makeListeningOptions(w, allWords),
      };
    }
    return base;
  });
  res.json({ questions, total: questions.length });
});

app.post('/api/self-tests/submit', authMiddleware, requireRole('student'), async (req, res) => {
  const { word_book_id, word_list_id, answers } = req.body;
  if (!answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  if (answers.length > 200) return res.status(400).json({ error: '单次最多 200 题' });
  let correct = 0;
  const wordIds = [...new Set(answers.map(a => a.word_id).filter(Boolean))];
  const placeholders = wordIds.map(() => '?').join(',');
  const words = await db.prepare(
    `SELECT * FROM words WHERE id IN (${placeholders})`
  ).all(...wordIds);
  const wordMap = {};
  for (const w of words) wordMap[w.id] = w;
  for (const a of answers) {
    a.is_correct = false;
    const word = wordMap[a.word_id];
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    const userAns = (a.user_answer || '').trim().toLowerCase();
    if (userAns.length === 0) {
      a.is_correct = false;
    } else if (qType === 'choice' || qType === 'listening') {
      const correctAns = (qType === 'listening' ? word.word : (a.lang_mode === 'zh_to_en' ? word.word : word.meaning)).trim().toLowerCase();
      a.is_correct = normalizeForCompare(userAns) === normalizeForCompare(correctAns);
    } else if (qType === 'spelling' || qType === 'zh_to_en') {
      const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const normUserAns = normalizeForCompare(userAns);
      if (validWords.some(w => {
        const nw = normalizeForCompare(w);
        return nw === normUserAns || normUserAns.includes(nw) || nw.includes(normUserAns);
      })) a.is_correct = true;
    } else {
      const normUserAns = normalizeForCompare(userAns);
      const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
      const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
      if (validMeanings.some(m => {
        const nm = normalizeForCompare(m);
        return nm === normUserAns || normUserAns.includes(nm) || nm.includes(normUserAns);
      })) a.is_correct = true;
    }
    if (a.is_correct) correct++;
  }
  const score = (correct / answers.length) * 100;
  const info = await db.prepare(
    isPG
      ? 'INSERT INTO self_tests (student_id, word_book_id, word_list_id, total_words, correct_count, score) VALUES ($1, $2, $3, $4, $5, $6)'
      : 'INSERT INTO self_tests (student_id, word_book_id, word_list_id, total_words, correct_count, score) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, word_book_id || null, word_list_id || null, answers.length, correct, score);
  const selfTestId = info.lastInsertRowid;
  const insertRec = db.prepare(
    isPG
      ? 'INSERT INTO self_test_records (self_test_id, word_id, user_answer, is_correct, question_type) VALUES ($1, $2, $3, $4, $5)'
      : 'INSERT INTO self_test_records (self_test_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    await insertRec.run(selfTestId, a.word_id, a.user_answer || '', a.is_correct ? 1 : 0, a.question_type || 'en_to_zh');
  }
  res.json({ self_test_id: selfTestId, score, correct, total: answers.length, answers });
});

app.get('/api/self-tests', authMiddleware, requireRole('student'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = $1
         ORDER BY st.created_at DESC LIMIT 50`
      : `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = ?
         ORDER BY st.created_at DESC LIMIT 50`
  ).all(req.user.id);
  res.json({ self_tests: rows });
});

function loadVersionInfo() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    let buildTime = '开发模式';
    try {
      const info = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build-info.json'), 'utf8'));
      buildTime = info.buildTime || buildTime;
    } catch (e) {}
    return {
      version: pkg.version || '1.0.0',
      buildTime,
      environment: isPG ? '生产环境' : '开发环境',
    };
  } catch (e) {
    return { version: '1.0.0', buildTime: '未知', environment: '开发环境' };
  }
}

app.get('/api/version', (req, res) => {
  res.json(loadVersionInfo());
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('未捕获错误:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器内部错误' });
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务运行在 http://0.0.0.0:${PORT}`);
});
