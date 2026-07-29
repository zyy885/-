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
  for (let i = 0; i < 10; i++) {
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
      console.log(`    网络错误(${e.message})，${i + 1}/10 后重试...`);
      await sleep(5000);
    }
  }
  throw new Error('请求失败');
}

async function main() {
  console.log('🔄 连接目标数据库 (Railway)...');
  const targetToken = await login(TARGET_API);
  console.log('✅ 目标数据库登录成功');

  // 获取单词书，找到"打卡100单词"的ID
  const tgtWb = await request(TARGET_API, targetToken, 'GET', '/word-books');
  const tgtBooks = tgtWb.wordBooks || [];
  const dabook = tgtBooks.find(b => b.name === '打卡100单词');
  if (!dabook) {
    console.error('❌ 找不到"打卡100单词"单词书');
    process.exit(1);
  }
  console.log(`  打卡100单词 ID: ${dabook.id}`);

  // 获取所有词表
  const tgtWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const tgtLists = tgtWl.wordBooks || tgtWl.wordLists || [];
  console.log(`  总词表数: ${tgtLists.length}`);

  // 找到需要修正的词表（第2天到第38天，且 word_book_id 不对）
  const needFix = tgtLists.filter(l => {
    const m = l.name.match(/^第(\d+)天$/);
    if (!m) return false;
    const day = parseInt(m[1]);
    return day >= 2 && day <= 38 && l.word_book_id != dabook.id;
  });

  console.log(`  需要修正 ${needFix.length} 个词表`);
  needFix.sort((a, b) => {
    const da = parseInt(a.name.match(/^第(\d+)天$/)?.[1] || 0);
    const db = parseInt(b.name.match(/^第(\d+)天$/)?.[1] || 0);
    return da - db;
  });

  // 逐个修正
  for (let i = 0; i < needFix.length; i++) {
    const list = needFix[i];
    console.log(`  ✏️ [${i + 1}/${needFix.length}] ${list.name} -> 打卡100单词`);
    await request(TARGET_API, targetToken, 'PUT', `/word-lists/${list.id}`, {
      word_book_id: dabook.id
    });
    await sleep(1000);
  }

  console.log(`\n✅ 完成！修正了 ${needFix.length} 个词表`);

  // 验证
  const finalWl = await request(TARGET_API, targetToken, 'GET', '/word-lists');
  const finalLists = finalWl.wordBooks || finalWl.wordLists || [];
  const grouped = {};
  for (const l of finalLists) {
    const wbId = l.word_book_id || 'none';
    if (!grouped[wbId]) grouped[wbId] = [];
    grouped[wbId].push(l);
  }
  console.log('\n📊 最终结果:');
  for (const [wbId, lists] of Object.entries(grouped)) {
    const bookName = wbId === 'none' ? '(无归属)' : tgtBooks.find(b => b.id == wbId)?.name || wbId;
    console.log(`  ${bookName}: ${lists.length} 个词表`);
  }
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
