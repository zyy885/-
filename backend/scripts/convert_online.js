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

function convertName(name) {
  if (!name) return name;
  const patterns = [
    /^第([零一二三四五六七八九十百千万两]+)([页节章单元天])(.*)$/,
    /^第([零一二三四五六七八九十百千万两]+)$/,
    /^([零一二三四五六七八九十百千万两]+)([页节章单元天])(.*)$/,
  ];
  for (const p of patterns) {
    const m = name.match(p);
    if (m) {
      if (m.length === 4) {
        const n = chineseToNum(m[1]);
        if (n > 0) {
          if (name.startsWith('第')) {
            return '第' + n + m[2] + (m[3] || '');
          } else {
            return n + m[2] + (m[3] || '');
          }
        }
      } else if (m.length === 3) {
        const n = chineseToNum(m[1]);
        if (n > 0) {
          return '第' + n;
        }
      }
    }
  }
  return name;
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
  console.log('🚀 开始同步线上数据:', BASE_URL);
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

  let updatedLists = 0;
  for (const l of lists) {
    const newName = convertName(l.name);
    if (newName !== l.name) {
      console.log(`   更新词表: "${l.name}" → "${newName}"`);
      const updateRes = await api('PUT', `/api/word-lists/${l.id}`, {
        name: newName,
        description: l.description || '',
        word_book_id: l.word_book_id || null,
      }, token);
      if (updateRes.ok) {
        updatedLists++;
      } else {
        console.error(`     ❌ 更新失败:`, updateRes.data);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }
  console.log(`   词表更新完成: ${updatedLists} 个`);
  console.log('');

  // 3. 获取所有句子列表（如果有 API 的话）
  console.log('3️⃣  获取句子列表...');
  try {
    const sentRes = await api('GET', '/api/sentence-lists', null, token);
    const sentLists = sentRes.data.sentenceLists || sentRes.data.lists || [];
    console.log(`   共 ${sentLists.length} 个句子列表`);

    let updatedSent = 0;
    for (const l of sentLists) {
      const newName = convertName(l.name);
      if (newName !== l.name) {
        console.log(`   更新句表: "${l.name}" → "${newName}"`);
        const updateRes = await api('PUT', `/api/sentence-lists/${l.id}`, {
          name: newName,
          description: l.description || '',
        }, token);
        if (updateRes.ok) {
          updatedSent++;
        } else {
          console.error(`     ❌ 更新失败:`, updateRes.data);
        }
        await new Promise(r => setTimeout(r, 100));
      }
    }
    console.log(`   句表更新完成: ${updatedSent} 个`);
  } catch (e) {
    console.log(`   跳过句子列表（API 不可用）`);
  }

  console.log('');
  console.log('========================================');
  console.log('✅ 全部完成！');
  console.log(`  更新词表: ${updatedLists} 个`);
  console.log('========================================');
}

main().catch(console.error);
