const path = require('path');
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
const isPG = !!DATABASE_URL;

let db;

if (isPG) {
  const { Pool } = require('pg');
  const sslDisabled = process.env.PGSSLMODE === 'disable';
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
  });
  pool.on('error', (err) => console.error('PG pool error:', err));
  db = pool;
} else {
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '..', 'vocab.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

function convertSQL(sql) {
  if (!isPG) return sql;
  let i = 0;
  const hasIgnore = /INSERT OR IGNORE INTO/i.test(sql);
  let result = sql.replace(/\?/g, () => `$${++i}`);
  result = result.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');
  if (hasIgnore) {
    result = result.trim() + ' ON CONFLICT DO NOTHING';
  }
  if (/^INSERT INTO/i.test(result.trim()) && !/RETURNING/i.test(result)) {
    result = result.trim() + ' RETURNING id';
  }
  return result;
}

function prepare(sql) {
  const finalSQL = convertSQL(sql);

  if (isPG) {
    return {
      async get(...args) {
        const res = await db.query(finalSQL, args);
        return res.rows[0] || undefined;
      },
      async all(...args) {
        const res = await db.query(finalSQL, args);
        return res.rows;
      },
      async run(...args) {
        const res = await db.query(finalSQL, args);
        return {
          changes: res.rowCount,
          lastInsertRowid: res.rows[0] ? res.rows[0].id : undefined,
        };
      },
    };
  }

  const stmt = db.prepare(finalSQL);
  return {
    get(...args) { return stmt.get(...args); },
    all(...args) { return stmt.all(...args); },
    run(...args) { return stmt.run(...args); },
  };
}

async function exec(sql) {
  if (isPG) {
    await db.query(sql);
  } else {
    db.exec(sql);
  }
}

const buildDDL = () => {
  if (isPG) {
    return `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
        avatar TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS word_books (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cover_color TEXT DEFAULT '#6366f1',
        cover_image TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS word_lists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        word_book_id INTEGER REFERENCES word_books(id) ON DELETE SET NULL,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS words (
        id SERIAL PRIMARY KEY,
        word_list_id INTEGER NOT NULL REFERENCES word_lists(id) ON DELETE CASCADE,
        word TEXT NOT NULL,
        meaning TEXT NOT NULL,
        example TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        word_list_id INTEGER NOT NULL REFERENCES word_lists(id) ON DELETE CASCADE,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deadline TIMESTAMP,
        test_words_count INTEGER DEFAULT 10,
        test_mode TEXT DEFAULT 'en_to_zh',
        sentence_list_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS task_students (
        id SERIAL PRIMARY KEY,
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'studying', 'tested')),
        study_progress REAL DEFAULT 0,
        test_score REAL,
        last_studied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (task_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS study_records (
        id SERIAL PRIMARY KEY,
        task_student_id INTEGER NOT NULL REFERENCES task_students(id) ON DELETE CASCADE,
        word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        is_known INTEGER DEFAULT 0,
        studied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (task_student_id, word_id)
      );

      CREATE TABLE IF NOT EXISTS test_records (
        id SERIAL PRIMARY KEY,
        task_student_id INTEGER NOT NULL REFERENCES task_students(id) ON DELETE CASCADE,
        word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        user_answer TEXT,
        is_correct INTEGER,
        question_type TEXT DEFAULT 'en_to_zh',
        tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, word_id)
      );

      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT DEFAULT 'light'
      );

      CREATE TABLE IF NOT EXISTS sentence_lists (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sentences (
        id SERIAL PRIMARY KEY,
        sentence_list_id INTEGER NOT NULL REFERENCES sentence_lists(id) ON DELETE CASCADE,
        sentence_en TEXT NOT NULL,
        sentence_zh TEXT NOT NULL,
        analysis TEXT,
        vocabulary TEXT,
        grammar TEXT,
        structure TEXT,
        correction TEXT,
        summary TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS translation_records (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sentence_id INTEGER NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
        user_translation TEXT,
        is_correct INTEGER,
        translated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS checkins (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        checkin_date DATE NOT NULL,
        task_student_id INTEGER REFERENCES task_students(id) ON DELETE SET NULL,
        test_score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, checkin_date)
      );

      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS student_tags (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS self_tests (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        word_book_id INTEGER REFERENCES word_books(id) ON DELETE SET NULL,
        word_list_id INTEGER REFERENCES word_lists(id) ON DELETE SET NULL,
        total_words INTEGER,
        correct_count INTEGER,
        score REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS self_test_records (
        id SERIAL PRIMARY KEY,
        self_test_id INTEGER NOT NULL REFERENCES self_tests(id) ON DELETE CASCADE,
        word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
        user_answer TEXT,
        is_correct INTEGER,
        question_type TEXT DEFAULT 'en_to_zh',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS study_sessions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_date DATE NOT NULL,
        duration_seconds INTEGER DEFAULT 0,
        words_studied INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (student_id, session_date)
      );
    `;
  }

  return `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS word_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cover_color TEXT DEFAULT '#6366f1',
      cover_image TEXT,
      is_public INTEGER DEFAULT 0,
      teacher_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS word_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      word_book_id INTEGER,
      teacher_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_book_id) REFERENCES word_books(id) ON DELETE SET NULL,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_list_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL,
      example TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_list_id) REFERENCES word_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      word_list_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      deadline DATETIME,
      test_words_count INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_list_id) REFERENCES word_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'studying', 'tested')),
      study_progress REAL DEFAULT 0,
      test_score REAL,
      last_studied_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (task_id, student_id),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_student_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      is_known INTEGER DEFAULT 0,
      studied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_student_id) REFERENCES task_students(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
      UNIQUE (task_student_id, word_id)
    );

    CREATE TABLE IF NOT EXISTS test_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_student_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      user_answer TEXT,
      is_correct INTEGER,
      tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_student_id) REFERENCES task_students(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      task_id INTEGER,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER PRIMARY KEY,
      theme TEXT DEFAULT 'light',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sentence_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      teacher_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sentence_list_id INTEGER NOT NULL,
      sentence_en TEXT NOT NULL,
      sentence_zh TEXT NOT NULL,
      analysis TEXT,
      vocabulary TEXT,
      grammar TEXT,
      structure TEXT,
      correction TEXT,
      summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sentence_list_id) REFERENCES sentence_lists(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS translation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      sentence_id INTEGER NOT NULL,
      user_translation TEXT,
      is_correct INTEGER,
      translated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      checkin_date TEXT NOT NULL,
      task_student_id INTEGER,
      test_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (student_id, checkin_date),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (task_student_id) REFERENCES task_students(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      teacher_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS student_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (student_id, tag_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS self_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      word_book_id INTEGER,
      word_list_id INTEGER,
      total_words INTEGER,
      correct_count INTEGER,
      score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (word_book_id) REFERENCES word_books(id) ON DELETE SET NULL,
      FOREIGN KEY (word_list_id) REFERENCES word_lists(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS self_test_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      self_test_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      user_answer TEXT,
      is_correct INTEGER,
      question_type TEXT DEFAULT 'en_to_zh',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (self_test_id) REFERENCES self_tests(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      session_date TEXT NOT NULL,
      duration_seconds INTEGER DEFAULT 0,
      words_studied INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (student_id, session_date),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;
};

(async () => {
  await exec(buildDDL());

  try {
    if (isPG) {
      await db.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS test_mode TEXT DEFAULT 'en_to_zh'`);
      await db.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sentence_list_id INTEGER`);
      await db.query(`ALTER TABLE test_records ADD COLUMN IF NOT EXISTS question_type TEXT DEFAULT 'en_to_zh'`);
      await db.query(`ALTER TABLE word_lists ADD COLUMN IF NOT EXISTS word_book_id INTEGER REFERENCES word_books(id) ON DELETE SET NULL`);
      await db.query(`ALTER TABLE word_books ADD COLUMN IF NOT EXISTS cover_color TEXT DEFAULT '#6366f1'`);
      await db.query(`ALTER TABLE word_books ADD COLUMN IF NOT EXISTS cover_image TEXT`);
      await db.query(`ALTER TABLE word_books ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE`);
      await db.query(`ALTER TABLE words ADD COLUMN IF NOT EXISTS sort_order INTEGER`);
      await db.query(`UPDATE words SET sort_order = id WHERE sort_order IS NULL`);
      await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_study_records_unique ON study_records (task_student_id, word_id)`);
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_bonus_days INTEGER DEFAULT 0`);
      await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_bonus_words INTEGER DEFAULT 0`);
      await db.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS voice TEXT DEFAULT 'default'`);
      await db.query(`ALTER TABLE sentences ADD COLUMN IF NOT EXISTS vocabulary TEXT`);
      await db.query(`ALTER TABLE sentences ADD COLUMN IF NOT EXISTS grammar TEXT`);
      await db.query(`ALTER TABLE sentences ADD COLUMN IF NOT EXISTS structure TEXT`);
      await db.query(`ALTER TABLE sentences ADD COLUMN IF NOT EXISTS correction TEXT`);
      await db.query(`ALTER TABLE sentences ADD COLUMN IF NOT EXISTS summary TEXT`);
    } else {
      try { db.prepare('ALTER TABLE tasks ADD COLUMN test_mode TEXT DEFAULT "en_to_zh"').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE tasks ADD COLUMN sentence_list_id INTEGER').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE test_records ADD COLUMN question_type TEXT DEFAULT "en_to_zh"').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE word_lists ADD COLUMN word_book_id INTEGER').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE word_books ADD COLUMN cover_color TEXT DEFAULT "#6366f1"').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE word_books ADD COLUMN cover_image TEXT').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE word_books ADD COLUMN is_public INTEGER DEFAULT 0').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE words ADD COLUMN sort_order INTEGER').run(); } catch (e) {}
      try { db.prepare('UPDATE words SET sort_order = id WHERE sort_order IS NULL').run(); } catch (e) {}
      try { db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_study_records_unique ON study_records (task_student_id, word_id)').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE users ADD COLUMN rank_bonus_days INTEGER DEFAULT 0').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE users ADD COLUMN rank_bonus_words INTEGER DEFAULT 0').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE settings ADD COLUMN voice TEXT DEFAULT "default"').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE sentences ADD COLUMN vocabulary TEXT').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE sentences ADD COLUMN grammar TEXT').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE sentences ADD COLUMN structure TEXT').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE sentences ADD COLUMN correction TEXT').run(); } catch (e) {}
      try { db.prepare('ALTER TABLE sentences ADD COLUMN summary TEXT').run(); } catch (e) {}
    }
  } catch (e) {}

  await initDefaultUsers();
})();

async function initDefaultUsers() {
  let count;
  if (isPG) {
    const res = await db.query('SELECT COUNT(*) as cnt FROM users');
    count = parseInt(res.rows[0].cnt);
  } else {
    count = db.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
  }

  if (count === 0) {
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const insertUser = prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)');
    await insertUser.run('teacher', hash('123456'), 'teacher');
    await insertUser.run('student1', hash('123456'), 'student');
    await insertUser.run('student2', hash('123456'), 'student');
    console.log('已创建默认用户: teacher/123456, student1/123456, student2/123456');
  }
}

async function transaction(fn) {
  if (isPG) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await fn({
        prepare: (sql) => {
          const finalSQL = convertSQL(sql);
          return {
            async get(...args) {
              const res = await client.query(finalSQL, args);
              return res.rows[0] || undefined;
            },
            async all(...args) {
              const res = await client.query(finalSQL, args);
              return res.rows;
            },
            async run(...args) {
              const res = await client.query(finalSQL, args);
              return {
                changes: res.rowCount,
                lastInsertRowid: res.rows[0] ? res.rows[0].id : undefined,
              };
            },
          };
        },
      });
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } else {
    const tx = db.transaction(fn);
    return tx();
  }
}

module.exports = {
  prepare,
  exec,
  transaction,
  isPG,
  raw: db,
};
