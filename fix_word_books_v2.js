const SOURCE_API = 'https://vocab-1ial.onrender.com/api';
const TARGET_API = 'https://precious-exploration-production-0835.up.railway.app/api';
const CREDENTIALS = { username: 'teacher', password: '123456' };

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
  for (let i = 0; i < 3; i++) {
    try {
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
    } catch (e) {
      console.log(`    网络错误，重试 ${i + 1}/3...`);
      await sleep(2000);
    }
  }
  throw new Error('请求失败');
}

async function main() {
  console.log('🔄 连接源数据库 (Render)...');
  const sourceToken = await login(SOURCE_API);
  console.log('✅ 源数据库登录成功');

  console.log('🔄 连接目标数据库 (Railway)...');
  const targetToken = await login(TARGET_API);
  console.log('✅ 目标数据库登录成功');

  // ========== 获取数据 ==========
  console.log('\n📚 获取单词书数据...');
  const srcWb = await request(SOURCE_API, sourceToken, 'GET', '/word-books');
  const srcBooks = srcWb.wordBooks || [];
  const tgtWb = await request(TARGET_API, targetToken, 'GET', '/word-books');
  const tgtBooks = tgtWb.wordBooks || [];

  const tgtBookByName = {};
  for (const b of tgtBooks) tgtBookByName[b.name] = b;

  const bookIdMap = {};
  for (const srcBook of srcBooks) {
    const tgtBook = tgtBookByName[srcBook.name];
    if (tgtBook) bookIdMap[srcBook.id] = tgtBook.id;
  }
  console.log(`  单词书映射: ${JSON.stringify(bookIdMap)}`);

  console.log('\n📋 获取词表数据...');
  const srcWl = await request(SOURCE_API, sourceToken, 'GET', '/word-lists');
  const srcLists = srcWl.wordBooks || srcWl.wordLists || [];
  const tgtWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const tgtLists = tgtWl.wordBooks || tgtWl.wordLists || [];

  console.log(`  源: ${srcLists.length}, 目标: ${tgtLists.length}`);

  // ========== 第一步：删除重复词表 ==========
  console.log('\n🗑️ 第一步：删除重复词表...');
  const nameCount = {};
  for (const l of tgtLists) {
    nameCount[l.name] = (nameCount[l.name] || 0) + 1;
  }
  const duplicates = Object.entries(nameCount).filter(([n, c]) => c > 1);
  console.log(`  发现 ${duplicates.length} 个重复名称的词表`);

  for (const [name, count] of duplicates) {
    const sameName = tgtLists.filter(l => l.name === name);
    for (let i = 1; i < sameName.length; i++) {
      console.log(`  删除重复: ${name} (ID: ${sameName[i].id})`);
      await request(TARGET_API, targetToken, 'DELETE', `/word-lists/${sameName[i].id}`);
    }
  }

  // 重新获取目标词表
  const tgtWl2 = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  let curTgtLists = tgtWl2.wordBooks || tgtWl2.wordLists || [];
  console.log(`  清理后目标词表数: ${curTgtLists.length}`);

  // 按名称索引
  const srcListByName = {};
  for (const l of srcLists) srcListByName[l.name] = l;
  let tgtListByName = {};
  for (const l of curTgtLists) tgtListByName[l.name] = l;

  // ========== 第二步：迁移缺失的词表 ==========
  console.log('\n🔄 第二步：迁移缺失的词表...');
  const missing = srcLists.filter(l => !tgtListByName[l.name]);
  console.log(`  需要迁移 ${missing.length} 个缺失词表`);

  for (let i = 0; i < missing.length; i++) {
    const srcList = missing[i];
    console.log(`  📥 [${i + 1}/${missing.length}] 迁移: ${srcList.name}...`);
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
    console.log(`    ✅ 完成 (${words.length} 个单词)`);
    tgtListByName[newList.name] = newList;
  }

  // 重新获取目标词表
  const tgtWl3 = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  curTgtLists = tgtWl3.wordBooks || tgtWl3.wordLists || [];
  console.log(`  迁移后目标词表数: ${curTgtLists.length}`);

  // ========== 第三步：修正所有词表的 word_book_id ==========
  console.log('\n🔄 第三步：修正词表的 word_book_id 关联...');
  let fixedCount = 0;
  for (const tgtList of curTgtLists) {
    const srcList = srcListByName[tgtList.name];
    if (!srcList) continue;

    const correctWordBookId = srcList.word_book_id ? bookIdMap[srcList.word_book_id] : null;
    const currentWordBookId = tgtList.word_book_id || null;

    if (correctWordBookId == currentWordBookId) continue;

    const bookName = correctWordBookId ? tgtBooks.find(b => b.id === correctWordBookId)?.name : '无';
    console.log(`  ✏️ 修正: ${tgtList.name} -> ${bookName}`);
    
    await request(TARGET_API, targetToken, 'PUT', `/word-lists/${tgtList.id}`, {
      word_book_id: correctWordBookId || undefined
    });
    fixedCount++;
  }
  console.log(`  修正了 ${fixedCount} 个词表的关联`);

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
  
  let total = 0;
  for (const [wbId, lists] of Object.entries(finalGrouped)) {
    const bookName = wbId === 'none' ? '(无归属)' : tgtBooks.find(b => b.id == wbId)?.name || wbId;
    console.log(`  ${bookName}: ${lists.length} 个词表`);
    total += lists.length;
  }
  
  console.log(`\n🎉 完成！总计 ${total} 个词表`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
