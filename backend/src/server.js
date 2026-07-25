const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signToken, authMiddleware, requireRole } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
const fs = require('fs');
if (fs.existsSync(FRONTEND_DIST)) {
  console.log('检测到前端构建产物，已启用静态文件托管');
  app.use(express.static(FRONTEND_DIST));
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '参数错误' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, 'student');
  const user = { id: info.lastInsertRowid, username, role: 'student' };
  res.json({ token: signToken(user), user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/students', authMiddleware, requireRole('teacher'), (req, res) => {
  const students = db.prepare(
    "SELECT id, username, created_at FROM users WHERE role = 'student' ORDER BY id"
  ).all();
  res.json({ students });
});

app.get('/api/users', authMiddleware, requireRole('teacher'), (req, res) => {
  const users = db.prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY role, username'
  ).all();
  res.json({ users });
});

app.post('/api/users', authMiddleware, requireRole('teacher'), (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: '参数错误' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, role);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/users/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '不能删除当前登录账号' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/word-lists', authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = db.prepare(
      'SELECT wl.*, (SELECT COUNT(*) FROM words w WHERE w.word_list_id = wl.id) as word_count FROM word_lists wl WHERE wl.teacher_id = ? ORDER BY wl.created_at DESC'
    ).all(req.user.id);
  } else {
    rows = db.prepare(
      `SELECT DISTINCT wl.*, (SELECT COUNT(*) FROM words w WHERE w.word_list_id = wl.id) as word_count
       FROM word_lists wl
       INNER JOIN tasks t ON t.word_list_id = wl.id
       INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       ORDER BY wl.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ wordLists: rows });
});

app.post('/api/word-lists', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, description, words } = req.body;
  if (!name) return res.status(400).json({ error: '请输入词表名称' });
  const info = db.prepare(
    'INSERT INTO word_lists (name, description, teacher_id) VALUES (?, ?, ?)'
  ).run(name, description || '', req.user.id);
  const listId = info.lastInsertRowid;
  if (words && words.length) {
    const stmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example) VALUES (?, ?, ?, ?)'
    );
    for (const w of words) {
      if (w.word && w.meaning) stmt.run(listId, w.word, w.meaning, w.example || '');
    }
  }
  res.json({ id: listId });
});

app.put('/api/word-lists/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, description } = req.body;
  db.prepare(
    'UPDATE word_lists SET name = ?, description = ? WHERE id = ? AND teacher_id = ?'
  ).run(name, description || '', req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/word-lists/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  db.prepare('DELETE FROM word_lists WHERE id = ? AND teacher_id = ?').run(
    req.params.id, req.user.id
  );
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/words', authMiddleware, (req, res) => {
  const words = db.prepare(
    'SELECT * FROM words WHERE word_list_id = ? ORDER BY id'
  ).all(req.params.id);
  res.json({ words });
});

app.post('/api/word-lists/:id/words', authMiddleware, requireRole('teacher'), (req, res) => {
  const { word, meaning, example } = req.body;
  if (!word || !meaning) return res.status(400).json({ error: '单词和释义必填' });
  const info = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, word, meaning, example || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/words/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  const { word, meaning, example } = req.body;
  db.prepare(
    'UPDATE words SET word = ?, meaning = ?, example = ? WHERE id = ?'
  ).run(word, meaning, example || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/words/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/tasks', authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = db.prepare(
      `SELECT t.*, wl.name as word_list_name,
        (SELECT COUNT(DISTINCT student_id) FROM task_students ts WHERE ts.task_id = t.id) as student_count
       FROM tasks t
       INNER JOIN word_lists wl ON wl.id = t.word_list_id
       WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = db.prepare(
      `SELECT t.*, wl.name as word_list_name, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at,
        (SELECT COUNT(*) FROM words w WHERE w.word_list_id = t.word_list_id) as total_words
       FROM tasks t
       INNER JOIN word_lists wl ON wl.id = t.word_list_id
       INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       ORDER BY t.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ tasks: rows });
});

app.post('/api/tasks', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, word_list_id, deadline, test_words_count, test_mode, student_ids } = req.body;
  if (!name || !word_list_id) return res.status(400).json({ error: '参数错误' });
  const info = db.prepare(
    'INSERT INTO tasks (name, word_list_id, teacher_id, deadline, test_words_count, test_mode) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, word_list_id, req.user.id, deadline || null, test_words_count || 10, test_mode || 'mixed');
  const taskId = info.lastInsertRowid;
  if (student_ids && student_ids.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO task_students (task_id, student_id) VALUES (?, ?)'
    );
    for (const sid of student_ids) stmt.run(taskId, sid);
  }
  res.json({ id: taskId });
});

app.delete('/api/tasks/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/tasks/:id/progress', authMiddleware, requireRole('teacher'), (req, res) => {
  const rows = db.prepare(
    `SELECT ts.*, u.username,
      (SELECT COUNT(*) FROM words w WHERE w.word_list_id = t.word_list_id) as total_words
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     INNER JOIN tasks t ON t.id = ts.task_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);
  const words = db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN tasks t ON t.word_list_id = w.word_list_id
     WHERE t.id = ? ORDER BY w.id`
  ).all(req.params.id);
  res.json({ progress: rows, words });
});

app.get('/api/tasks/:id/study', authMiddleware, (req, res) => {
  const ts = db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });
  const words = db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN tasks t ON t.word_list_id = w.word_list_id
     WHERE t.id = ? ORDER BY w.id`
  ).all(req.params.id);
  const studied = db.prepare(
    'SELECT word_id, is_known FROM study_records WHERE task_student_id = ?'
  ).all(ts.id);
  const studiedMap = {};
  for (const s of studied) studiedMap[s.word_id] = s.is_known;
  db.prepare(
    "UPDATE task_students SET status = CASE WHEN status = 'pending' THEN 'studying' ELSE status END, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(ts.id);
  res.json({ taskStudentId: ts.id, words, studiedMap });
});

app.post('/api/study-records', authMiddleware, (req, res) => {
  const { task_student_id, word_id, is_known } = req.body;
  if (!task_student_id || !word_id) return res.status(400).json({ error: '参数错误' });
  const ts = db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  db.prepare(
    `INSERT INTO study_records (task_student_id, word_id, is_known) VALUES (?, ?, ?)
     ON CONFLICT(task_student_id, word_id) DO UPDATE SET is_known = excluded.is_known, studied_at = CURRENT_TIMESTAMP`
  ).run(task_student_id, word_id, is_known ? 1 : 0);
  const progress = db.prepare(
    `SELECT
      (SELECT COUNT(*) FROM study_records sr WHERE sr.task_student_id = ts.id) as studied,
      (SELECT COUNT(*) FROM words w
        INNER JOIN tasks t ON t.word_list_id = w.word_list_id
        WHERE t.id = ts.task_id) as total
     FROM task_students ts WHERE ts.id = ?`
  ).get(task_student_id);
  const pct = progress.total > 0 ? Math.min(100, (progress.studied / progress.total) * 100) : 0;
  db.prepare('UPDATE task_students SET study_progress = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(pct, task_student_id);
  res.json({ ok: true, progress: pct });
});

app.get('/api/tasks/:id/test-words', authMiddleware, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const ts = db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });
  const allWords = db.prepare(
    'SELECT * FROM words WHERE word_list_id = ? ORDER BY RANDOM() LIMIT ?'
  ).all(task.word_list_id, task.test_words_count || 10);
  const mode = task.test_mode || 'en_to_zh';
  const words = allWords.map((w, i) => {
    let qType = 'en_to_zh';
    if (mode === 'zh_to_en') qType = 'zh_to_en';
    else if (mode === 'mixed') qType = i % 2 === 0 ? 'en_to_zh' : 'zh_to_en';
    return { ...w, question_type: qType };
  });
  res.json({ taskStudentId: ts.id, words, testMode: mode });
});

app.post('/api/tests/submit', authMiddleware, (req, res) => {
  const { task_student_id, answers } = req.body;
  if (!task_student_id || !answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  const ts = db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  let correct = 0;
  const insertTr = db.prepare(
    'INSERT INTO test_records (task_student_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    const word = db.prepare('SELECT * FROM words WHERE id = ?').get(a.word_id);
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    let isCorrect = false;
    const userAns = (a.user_answer || '').trim().toLowerCase();
    const cleanMeaning = (s) => {
      s = s.trim().toLowerCase();
      s = s.replace(/\(.*?\)/g, '').trim();
      s = s.replace(/^[a-z]+\.\s*/, '').trim();
      s = s.replace(/^[（(][^）)]*[）)]\s*/, '').trim();
      return s;
    };
    if (qType === 'zh_to_en') {
      const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      isCorrect = validWords.some(w => w === userAns || userAns.includes(w) || w.includes(userAns));
    } else {
      const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
      const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
      isCorrect = validMeanings.some(m => m === userAns || userAns.includes(m) || m.includes(userAns));
    }
    if (isCorrect) correct++;
    insertTr.run(task_student_id, a.word_id, a.user_answer || '', isCorrect ? 1 : 0, qType);
  }
  const score = (correct / answers.length) * 100;
  db.prepare(
    "UPDATE task_students SET status = 'tested', test_score = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(score, task_student_id);
  res.json({ score, correct, total: answers.length });
});

app.get('/api/tasks/:id/test-result', authMiddleware, (req, res) => {
  const ts = db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const records = db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(ts.id);
  res.json({ score: ts.test_score, records });
});

app.put('/api/me/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '参数错误' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10), req.user.id
  );
  res.json({ ok: true });
});

app.get('/api/favorites', authMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT f.*, w.word, w.meaning, w.example, w.word_list_id, wl.name as word_list_name
     FROM favorites f
     INNER JOIN words w ON w.id = f.word_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ).all(req.user.id);
  res.json({ favorites: rows });
});

app.post('/api/favorites', authMiddleware, (req, res) => {
  const { word_id } = req.body;
  if (!word_id) return res.status(400).json({ error: '参数错误' });
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, word_id) VALUES (?, ?)').run(req.user.id, word_id);
  res.json({ ok: true });
});

app.delete('/api/favorites/:wordId', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND word_id = ?').run(req.user.id, req.params.wordId);
  res.json({ ok: true });
});

app.get('/api/wrong-book', authMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT DISTINCT w.*, tr.is_correct, tr.tested_at, wl.name as word_list_name
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE ts.student_id = ? AND tr.is_correct = 0
     ORDER BY tr.tested_at DESC`
  ).all(req.user.id);
  res.json({ wrongWords: rows });
});

app.get('/api/stats/me', authMiddleware, (req, res) => {
  const totalTasks = db.prepare(
    'SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ?'
  ).get(req.user.id).cnt;
  const testedTasks = db.prepare(
    "SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ? AND status = 'tested'"
  ).get(req.user.id).cnt;
  const avgScore = db.prepare(
    'SELECT AVG(test_score) as avg FROM task_students WHERE student_id = ? AND test_score IS NOT NULL'
  ).get(req.user.id).avg || 0;
  const studyDays = db.prepare(
    "SELECT COUNT(DISTINCT DATE(last_studied_at)) as cnt FROM task_students WHERE student_id = ? AND last_studied_at IS NOT NULL"
  ).get(req.user.id).cnt;
  const totalWords = db.prepare(
    `SELECT COUNT(DISTINCT sr.word_id) as cnt FROM study_records sr
     INNER JOIN task_students ts ON ts.id = sr.task_student_id
     WHERE ts.student_id = ?`
  ).get(req.user.id).cnt;
  const wrongCount = db.prepare(
    `SELECT COUNT(DISTINCT tr.word_id) as cnt FROM test_records tr
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     WHERE ts.student_id = ? AND tr.is_correct = 0`
  ).get(req.user.id).cnt;
  res.json({
    totalTasks, testedTasks, avgScore: Math.round(avgScore),
    studyDays, totalWords, wrongCount
  });
});

app.get('/api/leaderboard', authMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT u.id, u.username,
      COUNT(DISTINCT ts.id) as tasks,
      AVG(CASE WHEN ts.test_score IS NOT NULL THEN ts.test_score END) as avg_score,
      COUNT(DISTINCT DATE(ts.last_studied_at)) as days
     FROM users u
     LEFT JOIN task_students ts ON ts.student_id = u.id
     WHERE u.role = 'student'
     GROUP BY u.id
     ORDER BY avg_score DESC NULLS LAST, days DESC, tasks DESC
     LIMIT 20`
  ).all();
  res.json({ leaderboard: rows });
});

app.post('/api/users/batch', authMiddleware, requireRole('teacher'), (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: '参数错误' });
  const stmt = db.prepare(
    'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  );
  let added = 0, skipped = 0;
  const tx = db.transaction(() => {
    for (const u of users) {
      if (!u.username || !u.password) { skipped++; continue; }
      const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
      if (exists) { skipped++; continue; }
      stmt.run(u.username, bcrypt.hashSync(u.password, 10), u.role || 'student');
      added++;
    }
  });
  tx();
  res.json({ added, skipped });
});

app.get('/api/tasks/:id/export', authMiddleware, requireRole('teacher'), (req, res) => {
  const rows = db.prepare(
    `SELECT u.username, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);
  const task = db.prepare('SELECT name FROM tasks WHERE id = ?').get(req.params.id);
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
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${(task?.name || '成绩')}.csv"`);
  res.send('\ufeff' + csv);
});

app.post('/api/task-students/:id/reset', authMiddleware, requireRole('teacher'), (req, res) => {
  const ts = db.prepare('SELECT * FROM task_students WHERE id = ?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
  db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  db.prepare(
    "UPDATE task_students SET status = 'pending', study_progress = 0, test_score = NULL, last_studied_at = NULL WHERE id = ?"
  ).run(ts.id);
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/export', authMiddleware, (req, res) => {
  const list = db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'teacher' && list.teacher_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  const words = db.prepare('SELECT word, meaning, example FROM words WHERE word_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, words });
});

app.post('/api/word-lists/import', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, description, words } = req.body;
  if (!name || !words || !Array.isArray(words)) return res.status(400).json({ error: '参数错误' });
  const info = db.prepare(
    'INSERT INTO word_lists (name, description, teacher_id) VALUES (?, ?, ?)'
  ).run(name, description || '', req.user.id);
  const listId = info.lastInsertRowid;
  const stmt = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example) VALUES (?, ?, ?, ?)'
  );
  let count = 0;
  for (const w of words) {
    if (w.word && w.meaning) { stmt.run(listId, w.word, w.meaning, w.example || ''); count++; }
  }
  res.json({ id: listId, imported: count });
});

app.get('/api/comments', authMiddleware, (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = db.prepare(
      `SELECT c.*, u.username as student_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.student_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.teacher_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = db.prepare(
      `SELECT c.*, u.username as teacher_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.teacher_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.student_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ comments: rows });
});

app.post('/api/comments', authMiddleware, requireRole('teacher'), (req, res) => {
  const { student_id, task_id, content } = req.body;
  if (!student_id || !content) return res.status(400).json({ error: '参数错误' });
  const info = db.prepare(
    'INSERT INTO comments (teacher_id, student_id, task_id, content) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, student_id, task_id || null, content);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/comments/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  db.prepare('DELETE FROM comments WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/settings', authMiddleware, (req, res) => {
  let s = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  if (!s) s = { theme: 'light' };
  res.json({ settings: s });
});

app.put('/api/settings', authMiddleware, (req, res) => {
  const { theme } = req.body;
  db.prepare(
    `INSERT INTO settings (user_id, theme) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme`
  ).run(req.user.id, theme || 'light');
  res.json({ ok: true });
});

try { db.prepare('ALTER TABLE tasks ADD COLUMN test_mode TEXT DEFAULT "en_to_zh"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE tasks ADD COLUMN sentence_list_id INTEGER').run(); } catch (e) {}
try { db.prepare('ALTER TABLE test_records ADD COLUMN question_type TEXT DEFAULT "en_to_zh"').run(); } catch (e) {}

app.get('/api/sentence-lists', authMiddleware, (req, res) => {
  const where = req.user.role === 'teacher' ? 'WHERE teacher_id = ?' : '';
  const params = req.user.role === 'teacher' ? [req.user.id] : [];
  const rows = db.prepare(`SELECT * FROM sentence_lists ${where} ORDER BY created_at DESC`).all(...params);
  res.json({ sentenceLists: rows });
});

app.post('/api/sentence-lists', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '名称必填' });
  const info = db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, description } = req.body;
  db.prepare('UPDATE sentence_lists SET name = ?, description = ? WHERE id = ? AND teacher_id = ?').run(name, description || '', req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  db.prepare('DELETE FROM sentence_lists WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/sentences', authMiddleware, (req, res) => {
  const rows = db.prepare('SELECT * FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ sentences: rows });
});

app.post('/api/sentence-lists/:id/sentences', authMiddleware, requireRole('teacher'), (req, res) => {
  const { sentence_en, sentence_zh, analysis } = req.body;
  if (!sentence_en || !sentence_zh) return res.status(400).json({ error: '英文和中文都必填' });
  const info = db.prepare(
    'INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis) VALUES (?, ?, ?, ?)'
  ).run(req.params.id, sentence_en, sentence_zh, analysis || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentences/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  const { sentence_en, sentence_zh, analysis } = req.body;
  db.prepare('UPDATE sentences SET sentence_en = ?, sentence_zh = ?, analysis = ? WHERE id = ?').run(sentence_en, sentence_zh, analysis || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/sentences/:id', authMiddleware, requireRole('teacher'), (req, res) => {
  db.prepare('DELETE FROM sentences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/export', authMiddleware, (req, res) => {
  const list = db.prepare('SELECT * FROM sentence_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '不存在' });
  const sentences = db.prepare('SELECT sentence_en, sentence_zh, analysis FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, sentences });
});

app.post('/api/sentence-lists/import', authMiddleware, requireRole('teacher'), (req, res) => {
  const { name, description, sentences } = req.body;
  if (!name || !Array.isArray(sentences)) return res.status(400).json({ error: '参数错误' });
  const info = db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  const insert = db.prepare('INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis) VALUES (?, ?, ?, ?)');
  let count = 0;
  for (const s of sentences) {
    if (s.sentence_en && s.sentence_zh) {
      insert.run(info.lastInsertRowid, s.sentence_en, s.sentence_zh, s.analysis || '');
      count++;
    }
  }
  res.json({ id: info.lastInsertRowid, imported: count });
});

app.post('/api/translation/submit', authMiddleware, (req, res) => {
  const { sentence_id, user_translation, is_correct } = req.body;
  if (!sentence_id) return res.status(400).json({ error: '参数错误' });
  db.prepare(
    'INSERT INTO translation_records (student_id, sentence_id, user_translation, is_correct) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, sentence_id, user_translation || '', is_correct ? 1 : 0);
  res.json({ ok: true });
});

app.get('/api/translation/records', authMiddleware, (req, res) => {
  const rows = db.prepare(
    `SELECT tr.*, s.sentence_en, s.sentence_zh, s.analysis, sl.name as list_name
     FROM translation_records tr
     INNER JOIN sentences s ON s.id = tr.sentence_id
     LEFT JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE tr.student_id = ? ORDER BY tr.translated_at DESC LIMIT 200`
  ).all(req.user.id);
  res.json({ records: rows });
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`服务运行在 http://localhost:${PORT}`);
});
