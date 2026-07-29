const BASE_URL = 'https://vocab-1ial.onrender.com';
const USERNAME = 'teacher';
const PASSWORD = '123456';

function parseListName(name) {
  const m = name.match(/(\d{4})年阅读理解Text\s*(\d+)/);
  if (m) return { year: parseInt(m[1]), text: parseInt(m[2]) };
  return { year: 9999, text: 999 };
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
  console.log('等待线上部署完成...');
  let token = null;
  
  // 重试登录直到成功
  for (let i = 0; i < 30; i++) {
    try {
      const login = await api('POST', '/api/auth/login', { username: USERNAME, password: PASSWORD });
      if (login.ok) {
        token = login.data.token;
        console.log('✅ 登录成功');
        break;
      }
    } catch (e) {}
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 5000));
  }

  if (!token) {
    console.error('\n❌ 线上部署还未完成，请稍后再手动运行脚本');
    process.exit(1);
  }

  console.log('\n1️⃣  获取词表...');
  const listsRes = await api('GET', '/api/word-lists', null, token);
  const allLists = listsRes.data.wordLists || [];
  const kaoyanLists = allLists.filter(l => /\d{4}年阅读理解Text/.test(l.name));
  
  console.log('找到', kaoyanLists.length, '个考研词汇词表');
  
  kaoyanLists.sort((a, b) => {
    const pa = parseListName(a.name);
    const pb = parseListName(b.name);
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.text - pb.text;
  });

  console.log('\n2️⃣  设置排序...');
  for (let i = 0; i < kaoyanLists.length; i++) {
    const sortOrder = i + 1;
    const l = kaoyanLists[i];
    const update = await api('PUT', `/api/word-lists/${l.id}`, { sort_order: sortOrder }, token);
    if (update.ok) {
      console.log(`  ${sortOrder}. ${l.name} ✅`);
    } else {
      console.log(`  ${sortOrder}. ${l.name} ❌ -`, update.data);
    }
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n✅ 线上词表排序完成！');
}

main().catch(console.error);
