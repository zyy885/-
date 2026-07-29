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
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(`${apiBase}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000)
      });
      const text = await res.text();
      try { return JSON.parse(text); } catch { return text; }
    } catch (e) {
      console.log(`    网络错误(${e.message})，重试 ${i + 1}/5...`);
      await sleep(3000);
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

  // ========== 获取单词书 ==========
  console.log('\n📚 获取单词书...');
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
  console.log(`  映射: ${JSON.stringify(bookIdMap)}`);

  // ========== 获取词表 ==========
  console.log('\n📋 获取词表...');
  const srcWl = await request(SOURCE_API, sourceToken, 'GET', '/word-lists');
  const srcLists = srcWl.wordBooks || srcWl.wordLists || [];
  const tgtWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const tgtLists = tgtWl.wordBooks || tgtWl.wordLists || [];

  console.log(`  源: ${srcLists.length}, 目标: ${tgtLists.length}`);

  const srcListByName = {};
  for (const l of srcLists) srcListByName[l.name] = l;

  // ========== 修正 word_book_id ==========
  console.log('\n🔄 修正词表的 word_book_id 关联...');
  let fixedCount = 0;
  let skipCount = 0;

  for (let i = 0; i < tgtLists.length; i++) {
    const tgtList = tgtLists[i];
    const srcList = srcListByName[tgtList.name];
    
    if (!srcList) {
      skipCount++;
      continue;
    }

    const correctWordBookId = srcList.word_book_id ? bookIdMap[srcList.word_book_id] : null;
    const currentWordBookId = tgtList.word_book_id || null;

    if (correctWordBookId == currentWordBookId) {
      skipCount++;
      continue;
    }

    const bookName = correctWordBookId ? tgtBooks.find(b => b.id === correctWordBookId)?.name : '无';
    console.log(`  ✏️ [${i + 1}/${tgtLists.length}] ${tgtList.name} -> ${bookName}`);
    
    await request(TARGET_API, targetToken, 'PUT', `/word-lists/${tgtList.id}`, {
      word_book_id: correctWordBookId || undefined
    });
    fixedCount++;
  }

  console.log(`\n✅ 完成！修正了 ${fixedCount} 个词表，跳过 ${skipCount} 个`);

  // ========== 验证结果 ==========
  console.log('\n📊 验证最终结果...');
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
  console.log(`  总计: ${total} 个词表`);
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
