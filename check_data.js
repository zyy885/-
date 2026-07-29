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

  // ========== 检查单词书 ==========
  console.log('\n📚 === 源数据库(Render)单词书 ===');
  const srcWb = await request(SOURCE_API, sourceToken, 'GET', '/word-books');
  const srcBooks = srcWb.wordBooks || [];
  for (const b of srcBooks) {
    console.log(`  ID:${b.id} 名称:${b.name}`);
  }

  console.log('\n📚 === 目标数据库(Railway)单词书 ===');
  const tgtWb = await request(TARGET_API, targetToken, 'GET', '/word-books');
  const tgtBooks = tgtWb.wordBooks || [];
  for (const b of tgtBooks) {
    console.log(`  ID:${b.id} 名称:${b.name}`);
  }

  // ========== 检查词表 ==========
  console.log('\n📋 === 源数据库(Render)词表按单词书分组 ===');
  const srcWl = await request(SOURCE_API, sourceToken, 'GET', '/word-lists');
  const srcLists = srcWl.wordBooks || srcWl.wordLists || [];
  console.log(`总词表数: ${srcLists.length}`);
  
  const srcGrouped = {};
  for (const l of srcLists) {
    const wbId = l.word_book_id || 'none';
    if (!srcGrouped[wbId]) srcGrouped[wbId] = [];
    srcGrouped[wbId].push(l);
  }
  
  for (const [wbId, lists] of Object.entries(srcGrouped)) {
    const bookName = wbId === 'none' ? '(无归属)' : srcBooks.find(b => b.id == wbId)?.name || wbId;
    console.log(`\n  单词书: ${bookName} (ID:${wbId}) - ${lists.length}个词表`);
    const sample = lists.slice(0, 3);
    for (const l of sample) {
      console.log(`    - ${l.name}`);
    }
    if (lists.length > 3) console.log(`    ... 还有 ${lists.length - 3} 个`);
  }

  console.log('\n📋 === 目标数据库(Railway)词表按单词书分组 ===');
  const tgtWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const tgtLists = tgtWl.wordBooks || tgtWl.wordLists || [];
  console.log(`总词表数: ${tgtLists.length}`);
  
  const tgtGrouped = {};
  for (const l of tgtLists) {
    const wbId = l.word_book_id || 'none';
    if (!tgtGrouped[wbId]) tgtGrouped[wbId] = [];
    tgtGrouped[wbId].push(l);
  }
  
  for (const [wbId, lists] of Object.entries(tgtGrouped)) {
    const bookName = wbId === 'none' ? '(无归属)' : tgtBooks.find(b => b.id == wbId)?.name || wbId;
    console.log(`\n  单词书: ${bookName} (ID:${wbId}) - ${lists.length}个词表`);
    const sample = lists.slice(0, 3);
    for (const l of sample) {
      console.log(`    - ${l.name}`);
    }
    if (lists.length > 3) console.log(`    ... 还有 ${lists.length - 3} 个`);
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
