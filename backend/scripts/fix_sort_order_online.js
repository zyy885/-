const BASE_URL = 'https://vocab-1ial.onrender.com';
const USERNAME = 'teacher';
const PASSWORD = '123456';

const chineseNumMap = { '零':0, '一':1, '二':2, '两':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9, '十':10, '百':100, '千':1000, '万':10000 };

function chineseToNum(s) {
  s = s.trim();
  if (/^\d+$/.test(s)) return parseInt(s);
  let total = 0, temp = 0, lastUnit = 1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const v = chineseNumMap[c];
    if (v === undefined) continue;
    if (v >= 10) {
      if (temp === 0) temp = 1;
      temp *= v;
      if (v >= 100) { total += temp; temp = 0; }
      lastUnit = v;
    } else {
      if (lastUnit >= 10) { total += temp; temp = 0; }
      temp = v;
      lastUnit = 1;
    }
  }
  return total + temp;
}

function extractSeqNum(name) {
  if (!name) return Infinity;
  const patterns = [
    /^第([零一二三四五六七八九十百千万两\d]+)[页节章单元天]/,
    /^第([零一二三四五六七八九十百千万两\d]+)$/,
    /^([零一二三四五六七八九十百千万两\d]+)[页节章单元天]/,
    /List\s*(\d+)/i,
    /Unit\s*(\d+)/i,
    /Lesson\s*(\d+)/i,
    /(\d+)/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      const n = chineseToNum(m[1]);
      if (n > 0) return n;
    }
  }
  return Infinity;
}

async function api(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

async function main() {
  console.log('🚀 开始同步线上 sort_order:', BASE_URL);
  console.log('');

  // 1. 登录
  console.log('1️⃣  登录中...');
  const login = await api('POST', '/api/auth/login', { username: USERNAME, password: PASSWORD });
  if (!login.ok) {
    console.error('❌ 登录失败:', login.data);
    process.exit(1);
  }
  const token = login.data.token;
  console.log('✅ 登录成功');
  console.log('');

  // 2. 获取所有词表
  console.log('2️⃣  获取词表...');
  const listsRes = await api('GET', '/api/word-lists', null, token);
  const lists = listsRes.data.wordLists || [];
  console.log(`   共 ${lists.length} 个词表`);

  // 按 word_book_id 分组
  const groups = {};
  for (const l of lists) {
    const key = l.word_book_id || 'null';
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  }

  let updated = 0;
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    // 按序号排序
    const sorted = [...group].sort((a, b) => {
      const na = extractSeqNum(a.name);
      const nb = extractSeqNum(b.name);
      if (na !== nb) return na - nb;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    console.log(`\n   分组 ${key === 'null' ? '(未分类)' : key} (${sorted.length} 个):`);
    for (let i = 0; i < sorted.length; i++) {
      const l = sorted[i];
      const newOrder = i + 1;
      if (l.sort_order !== newOrder) {
        console.log(`     ${l.id}: ${l.name}  sort_order: ${l.sort_order} → ${newOrder}`);
        const updateRes = await api('PUT', `/api/word-lists/${l.id}`, {
          name: l.name,
          description: l.description || '',
          word_book_id: l.word_book_id || null,
          sort_order: newOrder,
        }, token);
        if (updateRes.ok) {
          updated++;
        } else {
          console.error(`       ❌ 更新失败:`, updateRes.data);
        }
        await new Promise(r => setTimeout(r, 80));
      }
    }
  }

  console.log('');
  console.log('========================================');
  console.log('✅ 全部完成！');
  console.log(`  更新词表 sort_order: ${updated} 个`);
  console.log('========================================');
}

main().catch(console.error);
