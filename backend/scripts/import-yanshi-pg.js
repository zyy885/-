const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });

  const teacherRes = await pool.query(
    "SELECT id, username FROM users WHERE role = 'teacher' LIMIT 1"
  );
  
  let teacher;
  if (teacherRes.rows.length > 0) {
    teacher = teacherRes.rows[0];
  } else {
    const hash = bcrypt.hashSync('123456', 10);
    const newTeacher = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'teacher') RETURNING id, username",
      ['teacher', hash]
    );
    teacher = newTeacher.rows[0];
    console.log('已创建默认教师用户: teacher/123456');
  }
  console.log(`使用教师用户: ${teacher.username} (ID: ${teacher.id})`);

  const existing = await pool.query(
    "SELECT id FROM word_books WHERE name = '「研师」解词' LIMIT 1"
  );
  if (existing.rows.length > 0) {
    console.log('单词书已存在，跳过导入');
    await pool.end();
    process.exit(0);
  }

  const bookRes = await pool.query(
    'INSERT INTO word_books (name, description, cover_color, is_public, teacher_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    ['「研师」解词', '考研英语词汇学习', '#8B5CF6', true, teacher.id]
  );
  const bookId = bookRes.rows[0].id;
  console.log(`创建单词书: 「研师」解词 (ID: ${bookId})`);

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

  for (const part of parts) {
    const listRes = await pool.query(
      'INSERT INTO word_lists (name, description, word_book_id, teacher_id, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [part.name, part.description, bookId, teacher.id, 0]
    );
    const listId = listRes.rows[0].id;
    console.log(`创建词表: ${part.name} (ID: ${listId})`);

    for (let i = 0; i < part.words.length; i++) {
      const w = part.words[i];
      await pool.query(
        'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [listId, w.word, w.meaning, w.example || '', i + 1]
      );
    }
    console.log(`  插入 ${part.words.length} 个单词`);
  }

  const countRes = await pool.query(
    `SELECT COUNT(*) as cnt FROM words w
     INNER JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE wl.word_book_id = $1`,
    [bookId]
  );
  console.log(`\n导入完成！共导入 ${countRes.rows[0].cnt} 个单词`);

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  console.error('导入失败:', err);
  process.exit(1);
});
