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

  // ========== 获取两端的单词书和词表 ==========
  console.log('\n📚 获取单词书数据...');
  const srcWb = await request(SOURCE_API, sourceToken, 'GET', '/word-books');
  const srcBooks = srcWb.wordBooks || [];
  const tgtWb = await request(TARGET_API, targetToken, 'GET', '/word-books');
  const tgtBooks = tgtWb.wordBooks || [];

  const srcBookByName = {};
  for (const b of srcBooks) srcBookByName[b.name] = b;
  const tgtBookByName = {};
  for (const b of tgtBooks) tgtBookByName[b.name] = b;

  console.log(`  源: ${srcBooks.map(b => b.name).join(', ')}`);
  console.log(`  目标: ${tgtBooks.map(b => b.name).join(', ')}`);

  // 建立单词书ID映射：源ID -> 目标ID
  const bookIdMap = {};
  for (const srcBook of srcBooks) {
    const tgtBook = tgtBookByName[srcBook.name];
    if (tgtBook) {
      bookIdMap[srcBook.id] = tgtBook.id;
      console.log(`  映射: ${srcBook.name} (源ID:${srcBook.id} -> 目标ID:${tgtBook.id})`);
    }
  }

  // ========== 获取两端词表 ==========
  console.log('\n📋 获取词表数据...');
  const srcWl = await request(SOURCE_API, sourceToken, 'GET', '/word-lists');
  const srcLists = srcWl.wordBooks || srcWl.wordLists || [];
  const tgtWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const tgtLists = tgtWl.wordBooks || tgtWl.wordLists || [];

  console.log(`  源词表数: ${srcLists.length}`);
  console.log(`  目标词表数: ${tgtLists.length}`);

  // 目标词表按名称索引
  const tgtListByName = {};
  for (const l of tgtLists) tgtListByName[l.name] = l;

  // ========== 第一步：迁移缺失的词表 ==========
  console.log('\n🔄 第一步：迁移缺失的词表...');
  let migratedCount = 0;
  for (const srcList of srcLists) {
    if (tgtListByName[srcList.name]) continue;
    
    console.log(`  📥 迁移缺失: ${srcList.name}...`);
    const targetWordBookId = srcList.word_book_id ? bookIdMap[srcList.word_book_id] : null;
    
    const newList = await request(TARGET_API, targetToken, 'POST', '/word-lists', {
      name: srcList.name,
      description: srcList.description || '',
      is_public: srcList.is_public !== false,
      word_book_id: targetWordBookId || undefined
    });

    if (!newList.id) {
      console.log(`    ❌ 创建失败: ${JSON.stringify(newList)}`);
      continue;
    }

    const wordsData = await request(SOURCE_API, sourceToken, 'GET', `/word-lists/${srcList.id}/words`);
    const words = wordsData.words || [];
    for (const w of words) {
      await request(TARGET_API, targetToken, 'POST', `/word-lists/${newList.id}/words`, {
        word: w.word,
        meaning: w.meaning,
        phonetic: w.phonetic || '',
        example: w.example || '',
        example_meaning: w.example_meaning || ''
      });
    }
    console.log(`    ✅ 完成 (${words.length} 个单词, 单词书ID: ${targetWordBookId || '无'})`);
    tgtListByName[newList.name] = newList;
    migratedCount++;
  }
  console.log(`  迁移完成: ${migratedCount} 个缺失词表`);

  // ========== 第二步：修正所有词表的 word_book_id ==========
  console.log('\n🔄 第二步：修正词表的 word_book_id 关联...');
  
  // 重新获取目标端所有词表（包含刚迁移的）
  const tgtWl2 = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const allTgtLists = tgtWl2.wordBooks || tgtWl2.wordLists || [];
  
  // 源词表按名称索引，用于获取正确的 word_book_id
  const srcListByName = {};
  for (const l of srcLists) srcListByName[l.name] = l;

  let fixedCount = 0;
  for (const tgtList of allTgtLists) {
    const srcList = srcListByName[tgtList.name];
    if (!srcList) continue;

    const correctWordBookId = srcList.word_book_id ? bookIdMap[srcList.word_book_id] : null;
    const currentWordBookId = tgtList.word_book_id || null;

    if (correctWordBookId == currentWordBookId) continue;

    const bookName = correctWordBookId ? tgtBooks.find(b => b.id === correctWordBookId)?.name : '无';
    console.log(`  ✏️ 修正: ${tgtList.name} (word_book_id: ${currentWordBookId || '无'} -> ${correctWordBookId || '无'} [${bookName}])`);
    
    await request(TARGET_API, targetToken, 'PUT', `/word-lists/${tgtList.id}`, {
      word_book_id: correctWordBookId || undefined
    });
    fixedCount++;
  }
  console.log(`  修正完成: ${fixedCount} 个词表的关联`);

  // ========== 验证结果 ==========
  console.log('\n✅ 验证最终结果...');
  const finalWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const finalLists = finalWl.wordBooks || finalWl.wordLists || [];
  
  const finalGrouped = {};
  for (const l of finalLists) {
    const wbId = l.word_book_id || 'none';
    if (!finalGrouped[wbId]) finalGrouped[wbId] = [];
    finalGrouped[wbId].push(l);
  }
  
  for (const [wbId, lists] of Object.entries(finalGrouped)) {
    const bookName = wbId === 'none' ? '(无归属)' : tgtBooks.find(b => b.id == wbId)?.name || wbId;
    console.log(`  ${bookName} (ID:${wbId}): ${lists.length} 个词表`);
  }
  
  console.log(`\n🎉 完成！总计 ${finalLists.length} 个词表`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
