const SOURCE_API = 'https://vocab-1ial.onrender.com/api';
const TARGET_API = 'https://precious-exploration-production-0835.up.railway.app/api';
const CREDENTIALS = { username: 'teacher', password: '123456' };

async function login(apiBase) {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDENTIALS)
  });
  const data = await res.json();
  if (!data.token) throw new Error(`登录失败: ${JSON.stringify(data)}`);
  return data.token;
}

async function request(apiBase, token, method, path, body) {
  const res = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function main() {
  console.log('🔄 连接源数据库 (Render)...');
  const sourceToken = await login(SOURCE_API);
  console.log('✅ 源数据库登录成功');

  console.log('🔄 连接目标数据库 (Railway)...');
  const targetToken = await login(TARGET_API);
  console.log('✅ 目标数据库登录成功');

  // ========== 第一步：迁移单词书 ==========
  console.log('\n📚 第一步：迁移单词书...');
  const wbData = await request(SOURCE_API, sourceToken, 'GET', '/word-books');
  const sourceBooks = wbData.wordBooks || [];
  console.log(`找到 ${sourceBooks.length} 本单词书`);

  const targetWbData = await request(TARGET_API, targetToken, 'GET', '/word-books');
  const targetBookNames = new Set((targetWbData.wordBooks || []).map(b => b.name));
  const bookIdMap = {}; // 源ID -> 目标ID

  for (const book of sourceBooks) {
    if (targetBookNames.has(book.name)) {
      console.log(`  ⏭ 跳过已存在: ${book.name}`);
      const existing = (targetWbData.wordBooks || []).find(b => b.name === book.name);
      if (existing) bookIdMap[book.id] = existing.id;
      continue;
    }
    console.log(`  📥 迁移: ${book.name}...`);
    const newBook = await request(TARGET_API, targetToken, 'POST', '/word-books', {
      name: book.name,
      description: book.description || '',
      is_public: book.is_public !== false,
      cover_color: book.cover_color || '#6366f1',
      cover_image: book.cover_image || ''
    });
    if (newBook.id) {
      bookIdMap[book.id] = newBook.id;
      console.log(`    ✅ 完成 (ID: ${newBook.id})`);
    } else {
      console.log(`    ❌ 失败: ${JSON.stringify(newBook)}`);
    }
  }

  // ========== 第二步：迁移词表 ==========
  console.log('\n📋 第二步：迁移词表...');
  const wlData = await request(SOURCE_API, sourceToken, 'GET', '/word-lists');
  const sourceLists = wlData.wordBooks || wlData.wordLists || [];
  console.log(`找到 ${sourceLists.length} 个词表`);

  const targetWlData = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const targetListNames = new Set((targetWlData.wordBooks || targetWlData.wordLists || []).map(l => l.name));
  const listIdMap = {}; // 源ID -> 目标ID

  let listCount = 0;
  for (const list of sourceLists) {
    listCount++;
    if (targetListNames.has(list.name)) {
      console.log(`  ⏭ [${listCount}/${sourceLists.length}] 跳过已存在: ${list.name}`);
      const existing = (targetWlData.wordBooks || targetWlData.wordLists || []).find(l => l.name === list.name);
      if (existing) listIdMap[list.id] = existing.id;
      continue;
    }
    console.log(`  📥 [${listCount}/${sourceLists.length}] 迁移: ${list.name}...`);

    const targetWordBookId = list.word_book_id ? bookIdMap[list.word_book_id] : null;
    const newList = await request(TARGET_API, targetToken, 'POST', '/word-lists', {
      name: list.name,
      description: list.description || '',
      is_public: list.is_public !== false,
      word_book_id: targetWordBookId || undefined
    });

    if (!newList.id) {
      console.log(`    ❌ 创建失败: ${JSON.stringify(newList)}`);
      continue;
    }
    listIdMap[list.id] = newList.id;

    // 获取源词表的单词
    const wordsData = await request(SOURCE_API, sourceToken, 'GET', `/word-lists/${list.id}/words`);
    const words = wordsData.words || [];

    // 批量插入单词
    for (const w of words) {
      await request(TARGET_API, targetToken, 'POST', `/word-lists/${newList.id}/words`, {
        word: w.word,
        meaning: w.meaning,
        phonetic: w.phonetic || '',
        example: w.example || '',
        example_meaning: w.example_meaning || ''
      });
    }
    console.log(`    ✅ 完成 (${words.length} 个单词)`);
  }

  // ========== 第三步：迁移句子列表 ==========
  console.log('\n📝 第三步：迁移句子列表...');
  const slData = await request(SOURCE_API, sourceToken, 'GET', '/sentence-lists');
  const sourceSL = slData.sentenceLists || [];
  console.log(`找到 ${sourceSL.length} 个句子列表`);

  const targetSLData = await request(TARGET_API, targetToken, 'GET', '/sentence-lists');
  const targetSLNames = new Set((targetSLData.sentenceLists || []).map(l => l.name));

  for (const list of sourceSL) {
    if (targetSLNames.has(list.name)) {
      console.log(`  ⏭ 跳过已存在: ${list.name}`);
      continue;
    }
    console.log(`  📥 迁移: ${list.name}...`);

    const newList = await request(TARGET_API, targetToken, 'POST', '/sentence-lists', {
      name: list.name,
      description: list.description || '',
      is_public: true
    });

    if (!newList.id) {
      console.log(`    ❌ 创建失败: ${JSON.stringify(newList)}`);
      continue;
    }

    // 获取源句子列表的所有句子
    const sentencesData = await request(SOURCE_API, sourceToken, 'GET', `/sentence-lists/${list.id}/sentences`);
    const sentences = sentencesData.sentences || [];

    // 批量插入句子
    for (const s of sentences) {
      await request(TARGET_API, targetToken, 'POST', `/sentence-lists/${newList.id}/sentences`, {
        sentence_en: s.sentence_en,
        sentence_zh: s.sentence_zh,
        analysis: s.analysis || '',
        vocabulary: s.vocabulary || '',
        grammar: s.grammar || '',
        structure: s.structure || '',
        correction: s.correction || '',
        summary: s.summary || ''
      });
    }
    console.log(`    ✅ 完成 (${sentences.length} 个句子)`);
  }

  console.log('\n🎉 数据迁移全部完成！');
  console.log(`   单词书: ${Object.keys(bookIdMap).length} 本`);
  console.log(`   词表: ${Object.keys(listIdMap).length} 个`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
