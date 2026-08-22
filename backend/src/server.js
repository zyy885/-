const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { isPG } = require('./db');
const { signToken, authMiddleware, requireRole } = require('./auth');
const { normalizeForCompare } = require('./utils/chinese');

const IS_PUBLIC = isPG ? 'wb.is_public = TRUE' : 'CAST(wb.is_public AS INTEGER) = 1';
const IS_PUBLIC_ALT = isPG ? 'wb2.is_public = TRUE' : 'CAST(wb2.is_public AS INTEGER) = 1';

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : null;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || !allowedOrigins || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('不允许的跨域请求'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

async function runMigrations() {
  if (isPG) {
    try {
      await db.raw.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_bonus_days INTEGER DEFAULT 0`);
      await db.raw.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_bonus_words INTEGER DEFAULT 0`);
      await db.raw.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS voice TEXT DEFAULT 'default'`);
      console.log('迁移执行完成');
    } catch (e) {
      console.error('迁移执行出错（可能已存在）:', e.message);
    }
  }
}
runMigrations();

async function runSeedData() {
  const BOOK_NAME = '「研师」解词';
  try {
    const teacher = await db.prepare(
      "SELECT id FROM users WHERE role = 'teacher' LIMIT 1"
    ).get();
    if (!teacher) {
      console.log('种子数据: 未找到教师用户，跳过');
      return;
    }

    const existing = await db.prepare(
      'SELECT id FROM word_books WHERE name = ? LIMIT 1'
    ).get(BOOK_NAME);
    
    let bookId;
    if (existing) {
      bookId = existing.id;
      console.log(`种子数据: 单词书「${BOOK_NAME}」已存在(ID: ${bookId})，检查缺失的词表...`);
    } else {
      const bookInfo = await db.prepare(
        'INSERT INTO word_books (name, description, cover_color, is_public, teacher_id) VALUES (?, ?, ?, ?, ?)'
      ).run(BOOK_NAME, '考研英语词汇学习', '#8B5CF6', isPG ? true : 1, teacher.id);
      bookId = bookInfo.lastInsertRowid;
      console.log(`种子数据: 创建单词书「${BOOK_NAME}」(ID: ${bookId})`);
    }

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
          { word: 'hunger', meaning: 'n. 饥饿；v. 渴望', example: 'hunger marketing\ndie of hunger for food\nStudents in remote areas hunger for education.' },
          { word: 'explain', meaning: 'v. 说明，解释', example: 'It was difficult to explain the problem to her.' },
          { word: 'rich', meaning: 'adj. 富有的，富裕的', example: 'a rich man\nbe rich in...' },
          { word: 'nature', meaning: 'n. 自然，天性', example: 'human nature\nby nature' },
          { word: 'climate', meaning: 'n. 气候，风气', example: 'global climate\nclimate change' },
          { word: 'tiny', meaning: 'adj. 极小的', example: 'a tiny baby' },
          { word: 'excite', meaning: 'v. 使…激动', example: 'The news excites me.' },
          { word: 'ease', meaning: 'v. 减轻，缓和\nn. 安逸；容易', example: 'We eased our relationship\na life of ease' },
          { word: 'desire', meaning: 'v. 渴望\nn. 欲望', example: 'the desired effect\na strong desire for power' },
          { word: 'birth', meaning: 'n. 诞生，出生，起源', example: 'She gave birth to a baby.' }
        ]
      },
      {
        name: 'PART 04 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'tour', meaning: 'n. 旅游', example: 'a tour and travel\na tour of the city' },
          { word: 'cash', meaning: 'n. 现金', example: 'cash in hand\nI\'m short of cash right now.' },
          { word: 'wide', meaning: 'adj. 宽的；广泛的\nadv. 广阔地；充分地', example: 'a wide mouth\nThe door was wide open.' },
          { word: 'sad', meaning: 'adj. 悲哀的，难过的', example: 'She looked sad and tired.' },
          { word: 'spirit', meaning: 'n. 精神，情绪', example: 'in high/low spirits\nThe news lifted our spirits.' },
          { word: 'speed', meaning: 'n. 速度\nv. 加速', example: 'speed limit\nHe drives at high speed.' },
          { word: 'reality', meaning: 'n. 现实', example: 'in reality\nWill time travel become a reality?' },
          { word: 'favorite', meaning: 'n. 最喜欢的人或物\nadj. 最爱的', example: 'Which one is your favorite?\nShe is my favorite singer.' },
          { word: 'power', meaning: 'n. 实力，电能，权力', example: 'economic power\npower plant\nin power' },
          { word: 'prepare', meaning: 'v. 准备', example: 'prepare for' }
        ]
      },
      {
        name: 'PART 05 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'product', meaning: 'n. 产品；产物', example: 'create/develop a new product' },
          { word: 'data', meaning: 'n. 数据，资料', example: 'historical/personal data\nThis data was collected from 69 countries.' },
          { word: 'damage', meaning: 'n. 伤害；损毁\nv. 伤害；损毁', example: 'brain/storm/fire damage\nSmoking seriously damages your health.' },
          { word: 'course', meaning: 'n. 进程；课程', example: 'the course of history\na French course' },
          { word: 'consider', meaning: 'v. 考虑，认为', example: 'We\'re considering buying a new car.' },
          { word: 'commodity', meaning: 'n. 商品，货物', example: 'commodity price' },
          { word: 'new', meaning: 'adj. 新的', example: 'brand new\nnew concept' },
          { word: 'novel', meaning: 'n. 小说\nadj. 新颖的', example: 'He is working on a new novel.\na novel feature' },
          { word: 'revise', meaning: 'v. 修改；修订', example: 'revise the policy' },
          { word: 'government', meaning: 'n. 政府', example: 'local government\ncentral government' }
        ]
      },
      {
        name: 'PART 06 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'author', meaning: 'n. 作者', example: 'best-selling author' },
          { word: 'work', meaning: 'v. 工作；起作用\nn. 工作；作品', example: 'I\'ve always worked in education.\nIt works.\nBeethoven\'s piano works' },
          { word: 'ordinary', meaning: 'adj. 普通的；平凡的；平常的', example: 'ordinary people\nThis is an ordinary meeting.' },
          { word: 'continent', meaning: 'n. 大陆，洲，陆地', example: 'the continent of Asia' },
          { word: 'hire', meaning: 'v. 雇佣；租借', example: 'hire a worker' },
          { word: 'undergo', meaning: 'v. 经历', example: 'undergo tests\nShe underwent much suffering during her childhood.' },
          { word: 'quality', meaning: 'n. 质量；素质', example: 'high quality\nquality of life\npersonal qualities' },
          { word: 'monitor', meaning: 'n. 监控器；班长', example: 'a heart monitor\nclass monitor' },
          { word: 'value', meaning: 'n. 价值；价值观\nv. 重视', example: 'moral values\nI really value your suggestions.' },
          { word: 'rate', meaning: 'n. 比率；速度\nv. 评价', example: 'growth rate\na high rate of unemployment\nrate sth. as sth.\nThe show was rated (as) a success.' }
        ]
      },
      {
        name: 'PART 07 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'against', meaning: 'prep. 违反；以…为背景', example: 'against the law\nagainst the background of...' },
          { word: 'rest', meaning: 'n. 休息；剩余部分\nv. 依靠', example: 'have a rest\nthe rest of the day\nrest on...' },
          { word: 'voice', meaning: 'n. 声音；意见\nv. 表达', example: 'The Voice of China\nhave a voice in...\nvoice concern about...' },
          { word: 'smile', meaning: 'n. 微笑\nv. 微笑', example: 'with a smile\nShe smiled at him and he smiled back.' },
          { word: 'wear', meaning: 'v. 穿戴\nn. 磨损', example: 'wear a tie\nwear and tear' },
          { word: 'street', meaning: 'n. 街道', example: 'The bank is just across the street.' },
          { word: 'polite', meaning: 'adj. 有礼貌的；文雅的', example: 'Please be polite to our guests.' },
          { word: 'need', meaning: 'v. 需要\nn. 需要；必须', example: 'Do you need any help?\nThere is no need for you to get up early tomorrow.' },
          { word: 'begin', meaning: 'v. 开始，着手', example: 'We began to work on the project in May.' },
          { word: 'lend', meaning: 'v. 借出；贷款', example: 'Can you lend me your car this evening?' }
        ]
      },
      {
        name: 'PART 08 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'ancient', meaning: 'adj. 古老的；古代的', example: 'ancient history' },
          { word: 'peace', meaning: 'n. 和平，太平', example: 'war and peace' },
          { word: 'war', meaning: 'n. 战争；战争状态', example: 'the Second World War' },
          { word: 'background', meaning: 'n. 背景', example: 'background information' },
          { word: 'month', meaning: 'n. 月；月份', example: 'the month of August' },
          { word: 'problem', meaning: 'n. 问题', example: 'big problems\nfind the answer to the problem' },
          { word: 'save', meaning: 'v. 拯救；节省\nprep. 除了', example: 'save one\'s life\nsave money\nThey knew nothing about her save her name.' },
          { word: 'wind', meaning: 'n. 风；气息\nv. 缠绕', example: 'strong/high winds\nwind the bandage around your finger' },
          { word: 'stop', meaning: 'v. 停止，阻止\nn. 停止；车站', example: 'The car stopped at the traffic lights.\nI get off at the next stop.' },
          { word: 'message', meaning: 'n. 消息；启示', example: 'leave message' }
        ]
      },
      {
        name: 'PART 09 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'key', meaning: 'n. 钥匙；关键\nadj. 关键的', example: 'the car keys\nthe key to success\nthe key factor/point' },
          { word: 'free', meaning: 'adj. 自由的；免费的', example: 'I don\'t have much free time.\nfree ticket\nfree advice' },
          { word: 'flood', meaning: 'n. 洪水；大量\nv. 淹没；涌入', example: 'flood damage\na flood of complaints\nThe rain flooded the house.\nflood into...' },
          { word: 'run', meaning: 'v. 奔跑；经营；运转', example: 'Can you run as fast as Mike?\nrun a hotel/school/business' },
          { word: 'slow', meaning: 'adj. 慢的，缓慢的', example: 'The traffic is heavy and slow.' },
          { word: 'relax', meaning: 'v. 松弛；放松', example: 'Let\'s just relax and enjoy ourselves.' },
          { word: 'deep', meaning: 'adj. 深的，深奥的\nadv. 深地', example: 'a deep hole/river\ndeep in the forest' },
          { word: 'soul', meaning: 'n. 灵魂，心灵', example: 'soul mate\nwith heart and soul' },
          { word: 'hug', meaning: 'n. 拥抱，紧抱\nv. 拥抱，紧抱', example: 'She gave her mother a big hug.\nhug each other' },
          { word: 'beach', meaning: 'n. 海滩，河滩', example: 'along the beach' }
        ]
      },
      {
        name: 'PART 10 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'airport', meaning: 'n. 机场；航空站', example: 'Would you meet me at the airport?' },
          { word: 'style', meaning: 'n. 风格；样式；文体', example: 'a style of management\nThe letter is written in formal style.' },
          { word: 'tired', meaning: 'adj. 疲劳的；厌倦的', example: 'I\'m too tired even to think.' },
          { word: 'coach', meaning: 'n. 教练；长途汽车', example: 'a basketball/football/tennis coach\nThey went to Italy on a coach tour.' },
          { word: 'fog', meaning: 'n. 雾', example: 'The fog disappeared like magic.' },
          { word: 'always', meaning: 'adv. 总是；始终', example: 'I\'m always at home in the evenings.' },
          { word: 'face', meaning: 'n. 脸；面部\nv. 面对；面临', example: 'Jack\'s face turned red.\nShe turned and faced him.' },
          { word: 'bank', meaning: 'n. 银行；岸', example: 'a bank manager\nIt\'s on the north bank of the Thames.' },
          { word: 'wait', meaning: 'v. 等待；等候', example: 'Wait for me!\nLet\'s wait until the rain stops.' },
          { word: 'blind', meaning: 'adj. 失明的，瞎的', example: 'One of her parents is blind.' }
        ]
      },
      {
        name: 'PART 11 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'borrow', meaning: 'v. 借入, 借用', example: 'May I borrow your newspaper?' },
          { word: 'method', meaning: 'n. 方法', example: 'a new method of solving the problem' },
          { word: 'advice', meaning: 'n. 建议, 忠告', example: 'a piece of advice\nHe offered some useful advice.' },
          { word: 'empty', meaning: 'adj. 空的, 空洞的', example: 'an empty box/glass\nHis room is empty.' },
          { word: 'cheap', meaning: 'adj. 便宜的, 低劣的', example: 'a cheap restaurant/hotel\nI am going to buy something cheap.' },
          { word: 'marry', meaning: 'v. 结婚; 嫁; 娶', example: 'Many people choose not to marry.' },
          { word: 'decide', meaning: 'v. 决定', example: 'He decided to get married.' },
          { word: 'develop', meaning: 'v. 发展, 培养, 开发', example: 'It is important to develop good study skills.' },
          { word: 'forest', meaning: 'n. 森林', example: 'a forest fire\nWe need to protect the forest.' },
          { word: 'main', meaning: 'adj. 主要的', example: 'The main thing is to stay calm.' }
        ]
      },
      {
        name: 'PART 12 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'painful', meaning: 'adj. 疼痛的', example: 'a painful experience/memory' },
          { word: 'goal', meaning: 'n. 目标; 球门', example: 'main goal\nHe had only one shot at goal.' },
          { word: 'media', meaning: 'n. 媒体, 媒介', example: 'the news media\nThe media have a lot of power today.' },
          { word: 'computer', meaning: 'n. 计算机, 电脑', example: 'a personal computer\na computer program' },
          { word: 'childhood', meaning: 'n. 幼年, 童年', example: 'She had a happy childhood.' },
          { word: 'film', meaning: 'n. 电影', example: 'the film industry\nLet\'s stay at home and watch a film.' },
          { word: 'date', meaning: 'n. 日期; 约会', example: 'What\'s the date today?' },
          { word: 'guess', meaning: 'v. 猜测; 以为\nn. 猜测; 以为', example: 'Think and guess.' },
          { word: 'couple', meaning: 'n. 一对(双); 夫妇', example: 'a couple of\nWe went there a couple of years ago.' },
          { word: 'alone', meaning: 'adj. 单独的\nadv. 独自; 仅仅', example: 'I was alone in the classroom.\nHe lives alone.' }
        ]
      },
      {
        name: 'PART 13 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'code', meaning: 'n. 密码; 法规', example: 'break a code\ncivil code' },
          { word: 'light', meaning: 'n. 光, 光线\nadj. 亮的, 轻的, 浅色的\nv. 点燃', example: 'All plants need light and water.\nlight blue eyes\nlight a candle' },
          { word: 'danger', meaning: 'n. 危险', example: 'in danger of\nSmoking is a serious danger to health.' },
          { word: 'call', meaning: 'v. 称呼, 打电话', example: 'I\'ll call again later.\nWe call her Alice.' },
          { word: 'change', meaning: 'v. 改变; 互换\nn. 变化', example: 'The change of seasons.' },
          { word: 'press', meaning: 'v. 压, 推, 按\nn. 新闻工作者; 出版社', example: 'press a key\npress conference' },
          { word: 'pressure', meaning: 'n. 压力', example: 'air pressure\nwater pressure\nunder pressure' },
          { word: 'depress', meaning: 'v. 使沮丧; 使萧条', example: 'Bad weather always depresses me.' },
          { word: 'impress', meaning: 'v. 给...留下深刻印象', example: 'His words impressed her.' },
          { word: 'acquire', meaning: 'v. 获得; 收购', example: 'She has acquired a good knowledge of English.' }
        ]
      },
      {
        name: 'PART 14 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'output', meaning: 'n. 产量, 输出', example: 'data output\neconomic output' },
          { word: 'invite', meaning: 'v. 邀请', example: 'invite sb. to do sth.\nWho did you invite to the party?' },
          { word: 'organize', meaning: 'v. 组织; 安排', example: 'organize a meeting/party/trip' },
          { word: 'confuse', meaning: 'v. 混淆; 使困惑', example: 'People often confuse me and my twin sister.' },
          { word: 'contribute', meaning: 'v. 贡献; 捐助; 导致', example: 'contribute to...\nEach of us can contribute to the world.' },
          { word: 'lie', meaning: 'n. 谎言\nv. 说谎; 躺; 坐落在', example: 'tell a lie\nDon\'t lie to me!\nThere is a cat lying on the ground.\nThe town lies on the coast.' },
          { word: 'rule', meaning: 'n. 规则\nv. 支配; 控制; 判决', example: 'follow/obey/observe the rules\nAt that time John ruled England.' },
          { word: 'expect', meaning: 'v. 期待', example: 'Don\'t expect me to believe you.' },
          { word: 'challenge', meaning: 'n. 挑战', example: 'an exciting/interesting challenge' },
          { word: 'design', meaning: 'n. 设计; 构思\nv. 设计; 构思', example: 'web design\ndesign for...' }
        ]
      },
      {
        name: 'PART 15 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'prison', meaning: 'n. 监狱', example: 'in prison\nescape from prison' },
          { word: 'upset', meaning: 'v. 弄翻; 打乱; 使...心烦意乱\nadj. 难过的; 沮丧的', example: 'He upset a bottle of water.\nYou look pretty upset.' },
          { word: 'handle', meaning: 'v. 处理, 应付', example: 'handle the problem' },
          { word: 'silent', meaning: 'adj. 沉默的; 寂静的', example: 'keep silent\na silent film' },
          { word: 'abroad', meaning: 'adv. 在国外', example: 'go abroad\nwork abroad' },
          { word: 'subject', meaning: 'n. 主题; 科目; 话题\nadj. 易遭受...的; 受...支配的', example: 'English is my favorite subject.\nbe subject to\nFlights are subject to delay because of the fog.' },
          { word: 'allow', meaning: 'v. 允许; 准许', example: 'allow sb. to do sth.\nHe won\'t allow himself to fail.' },
          { word: 'promise', meaning: 'v. 许诺; 承诺; 保证\nn. 诺言; 许诺; 承诺', example: 'promise sth. to sb.\npromise sb. sth.\nShe kept her promise to visit them.' },
          { word: 'express', meaning: 'v. 表达\nn. 快递', example: 'Words cannot express my sadness.\nexpress company' },
          { word: 'suffer', meaning: 'v. 受苦; 遭受(困难等)', example: 'suffer hunger\nsuffer from' }
        ]
      },
      {
        name: 'PART 16 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'remain', meaning: 'v. 保持, 仍然', example: 'remain silent\nIt remains to be seen.' },
          { word: 'young', meaning: 'adj. 幼小的; 年轻的', example: 'young babies\nyoung people' },
          { word: 'adult', meaning: 'n. 成年人', example: 'a childish adult\nadulthood' },
          { word: 'similar', meaning: 'adj. 相似的', example: 'We have very similar interests.' },
          { word: 'construct', meaning: 'v. 建造; 构建, 构想', example: 'CCB\nChina Construction Bank' },
          { word: 'perfect', meaning: 'adj. 完美的', example: 'Practice makes perfect.' },
          { word: 'infect', meaning: 'v. 传染; 感染', example: 'people infected with COVID-19' },
          { word: 'fiction', meaning: 'n. 小说; 虚构', example: 'science fiction' },
          { word: 'artificial', meaning: 'adj. 人造的; 人工的', example: 'artificial heart' },
          { word: 'submit', meaning: 'v. 提交; 顺从; 屈服', example: 'submit the form\nsubmit to threats' }
        ]
      },
      {
        name: 'PART 17 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'patient', meaning: 'adj. 有耐心的\nn. 病人', example: 'We have to be patient.\na cancer patient' },
          { word: 'shock', meaning: 'n. 震惊; 令人震惊的事\nv. 使...震惊', example: 'It was a great shock to him.\nThe news shocked me.' },
          { word: 'adopt', meaning: 'v. 采纳; 收养; 领养', example: 'I would like to adopt his plan.\nMy husband wants to adopt a child.' },
          { word: 'praise', meaning: 'n. 赞扬; 称赞\nv. 赞美; 表扬', example: 'She praised him for his good performance.' },
          { word: 'infer', meaning: 'v. 推断', example: 'What can we infer from the last paragraph?' },
          { word: 'differ', meaning: 'v. 不同于', example: 'My views differ from those of my parents.' },
          { word: 'photo', meaning: 'n. 照片', example: 'He wants to take some photos.' },
          { word: 'experiment', meaning: 'n. 实验\nv. 做实验', example: 'do an experiment\nexperiment on animals' },
          { word: 'advise', meaning: 'v. 建议', example: 'advice\nsuggest' },
          { word: 'error', meaning: 'n. 错误, 误差', example: 'He made an error.' }
        ]
      },
      {
        name: 'PART 18 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'sight', meaning: 'n. 视野; 景观', example: 'in sight\nout of sight' },
          { word: 'globe', meaning: 'n. 地球,世界; 地球仪; 球体', example: 'tourists from every corner of the globe\nglobal' },
          { word: 'system', meaning: 'n. 系统; 制度; 体系', example: 'educational system\nlegal system' },
          { word: 'tailor', meaning: 'n. 裁缝\nv. 剪裁, 使适合', example: 'The tailor made a new suit for me.\ntailor the program' },
          { word: 'magic', meaning: 'n. 魔法\nadj. 有魔力的, 不可思议的', example: 'Do you believe in magic?\nIt was a magic moment.' },
          { word: 'technology', meaning: 'n. 技术', example: 'IT\ninformation technology' },
          { word: 'final', meaning: 'adj. 最终的; 决定性的', example: 'final exam\nfinal decision\nfinally' },
          { word: 'fee', meaning: 'n. 费用', example: 'college fee\ncharge a fee' },
          { word: 'actual', meaning: 'adj. 实际的', example: 'actual income\nactual value' },
          { word: 'edit', meaning: 'v. 编辑', example: 'the edited version\neditor' }
        ]
      },
      {
        name: 'PART 19 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'center', meaning: 'n. 中心', example: 'in the center of...\ncity center' },
          { word: 'importance', meaning: 'n. 重要性', example: 'be of importance\nattach great importance to' },
          { word: 'surface', meaning: 'n. 表面', example: 'on the surface\nIt seems like a good idea on the surface.' },
          { word: 'cancel', meaning: 'v. 取消, 终止; 废除, 注销', example: 'All flights have been cancelled because of bad weather.' },
          { word: 'private', meaning: 'adj. 私有的', example: 'private property\nprivate companies\nprivacy' },
          { word: 'mislead', meaning: 'v. 误导', example: 'He was misled by her words.' },
          { word: 'finally', meaning: 'adv. 最终; 决定性地', example: 'They finally lost sight of land.' },
          { word: 'usual', meaning: 'adj. 通常的; 平常的', example: 'as usual\nusual practice' },
          { word: 'loss', meaning: 'n. 损失; 减少; 亏损', example: 'a sense of loss\nloss of life\nat a loss' },
          { word: 'dislike', meaning: 'v. 不喜欢', example: 'Why do old people dislike new music?' }
        ]
      },
      {
        name: 'PART 20 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'broad', meaning: 'adj. 广泛的; 宽的', example: 'The agreement won broad support.' },
          { word: 'campus', meaning: 'n. (大学)校园', example: 'The campus of Harvard University is very beautiful.' },
          { word: 'affect', meaning: 'v. 影响', example: 'This article will affect my thinking.' },
          { word: 'effect', meaning: 'n. 影响; 效果; 作用', example: 'side effect\nin effect' },
          { word: 'directly', meaning: 'adv. 直接地; 立即', example: 'Please answer my question directly.' },
          { word: 'balance', meaning: 'n. 平衡; 天平\nv. 使(在某物上)保持平衡', example: 'keep a balance between work and relaxation\nkeep ecology in balance\nShe tries to balance home life and career.' },
          { word: 'permit', meaning: 'v. 许可; 允许\nn. 许可证', example: 'We do not permit smoking in the room.\nDo you need a permit to work here?' },
          { word: 'conclude', meaning: 'v. 得出结论', example: 'What do you conclude from that?' },
          { word: 'include', meaning: 'v. 包含, 包括', example: 'The hotel room charge includes breakfast.' },
          { word: 'exclude', meaning: 'v. 不包括; 拒(某人)于(某地、活动)之外', example: 'She is excluded by her classmates.' }
        ]
      },
      {
        name: 'PART 21 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'replace', meaning: 'v. 代替', example: 'Will robots replace humans in the workplace?' },
          { word: 'total', meaning: 'adj. 总计的; 总的\nn. 总共', example: 'Total losses were $800.\nThere are 500 students in total.' },
          { word: 'survive', meaning: 'v. 幸存', example: 'survive the crisis\nIn the crash, only two people survived.' },
          { word: 'landscape', meaning: 'n. 风景', example: 'natural landscape\ncultural landscape' },
          { word: 'port', meaning: 'n. 港口; 港口城市', example: 'Rotterdam is a major port.' },
          { word: 'era', meaning: 'n. 时代; 年代', example: 'in an information era' },
          { word: 'grateful', meaning: 'adj. 感激的', example: 'I am deeply grateful to my parents.' },
          { word: 'current', meaning: 'adj. 目前的; 当前的', example: 'the current economic situation\nits current leader' },
          { word: 'apply', meaning: 'v. 申请; 应用', example: 'I want to apply for this job.' },
          { word: 'graph', meaning: 'n. 图表', example: 'bar graph\nline graph' }
        ]
      },
      {
        name: 'PART 22 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'honor', meaning: 'n. 荣耀; 荣誉; 荣幸', example: 'This is a great honor for me.' },
          { word: 'average', meaning: 'adj. 普通的; 平均的', example: 'average people\nat an average speed of 100 miles per hour' },
          { word: 'attract', meaning: 'v. 吸引', example: 'attract attention\nattract buyers/customers' },
          { word: 'geology', meaning: 'n. 地质学', example: 'the development of geology' },
          { word: 'disappoint', meaning: 'v. 使...失望', example: 'The author is disappointed at the present situation.\nPeople feel disappointed at the realities.' },
          { word: 'describe', meaning: 'v. 描述', example: 'His manner can be described as being polite.' },
          { word: 'ladder', meaning: 'n. 梯子; 阶梯, 途径', example: 'climb the social ladder\nthe ladder of success' },
          { word: 'purchase', meaning: 'n. 购买\nv. 购买, 采购', example: 'online purchase\nMore than 60,000 people have purchased the PTKs.' },
          { word: 'simply', meaning: 'adv. 仅仅; 简直', example: 'It simply didn\'t foresee what would happen next.' },
          { word: 'origin', meaning: 'n. 起源', example: 'the origin of the universe' }
        ]
      },
      {
        name: 'PART 23 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'forth', meaning: 'adv. 向前, 向外', example: 'back and forth' },
          { word: 'struggle', meaning: 'n. 斗争; 奋斗\nv. 努力; 斗争', example: 'a struggle for independence\nstruggle against cancer' },
          { word: 'privacy', meaning: 'n. 隐私', example: 'digital privacy\nprivacy protection' },
          { word: 'deprive', meaning: 'v. 剥夺', example: 'They are deprived of their independence.' },
          { word: 'postpone', meaning: 'v. 延期; 延迟', example: 'The meeting has been postponed to Friday.' },
          { word: 'suitable', meaning: 'adj. 合适的', example: 'a suitable place for a picnic' },
          { word: 'chapter', meaning: 'n. 章, 回', example: 'in the next/last chapter' },
          { word: 'visual', meaning: 'adj. 视觉的', example: 'a visual impact' },
          { word: 'privilege', meaning: 'n. 特权', example: 'the privileges granted by the Queen' },
          { word: 'legal', meaning: 'adj. 法律的; 合法的', example: 'the legal system' }
        ]
      },
      {
        name: 'PART 24 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'sell', meaning: 'v. 卖; 出售', example: 'sell product\nsell DNA tests' },
          { word: 'arrival', meaning: 'n. 到来; 到达者', example: 'All students are friendly with new arrivals.' },
          { word: 'stream', meaning: 'n. 溪流; 一连串', example: 'a large stream of words' },
          { word: 'sudden', meaning: 'adj. 突然的, 意外的\nn. 突然发生', example: 'all of a sudden' },
          { word: 'sharp', meaning: 'adj. 锋利的; 急剧的', example: 'a sharp knife\na sharp pain' },
          { word: 'astonish', meaning: 'v. 使十分惊讶', example: 'The news astonished everyone.' },
          { word: 'courage', meaning: 'n. 勇气; 勇敢', example: 'lose courage' },
          { word: 'athlete', meaning: 'n. 运动员', example: 'Athletes need a good sense of balance.' },
          { word: 'balloon', meaning: 'n. 气球', example: 'Many children like balloons.' },
          { word: 'bamboo', meaning: 'n. 竹子', example: 'His chair is made of bamboo.' }
        ]
      },
      {
        name: 'PART 25 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'hunt', meaning: 'v. 寻找; 狩猎', example: 'She is still hunting for a new job.\nThe dog was trained to hunt.' },
          { word: 'crowd', meaning: 'n. 人群\nv. 挤满, 塞满', example: 'a crowd of people\nPeople crowd into the street to see the super star.' },
          { word: 'nerve', meaning: 'n. 神经; 勇气', example: 'get on one\'s nerves\nhave the nerve to do sth.\nlose one\'s nerve' },
          { word: 'support', meaning: 'n. 支持; 鼓励\nv. 支持; 鼓励', example: 'People in general will support us.' },
          { word: 'serious', meaning: 'adj. 严重的, 重要的', example: 'The government still faces very serious difficulties.' },
          { word: 'passage', meaning: 'n. 段落, (法律方面的) 通过', example: 'Read the following passage and answer the questions below.\nFinally, we got the passage of the new law.' },
          { word: 'tear', meaning: 'n. 眼泪\nv. 撕碎', example: 'Her eyes filled with tears.\nShe tore up the letter.' },
          { word: 'add', meaning: 'v. 加, 增加, 补充', example: 'add sth to sth\n"And don\'t be late," she added.' },
          { word: 'dig', meaning: 'v. 挖', example: 'dig a hole\ndig out\ndig into' },
          { word: 'satisfy', meaning: 'v. 满足, 使满意', example: 'The newspaper cannot satisfy the readers.' }
        ]
      },
      {
        name: 'PART 26 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'policy', meaning: 'n. 政策, 方针', example: 'public policy\npolicymaker' },
          { word: 'realize', meaning: 'v. 意识到, 了解; 实现', example: 'He realized his mistake.\nrealize one\'s dream' },
          { word: 'bite', meaning: 'v. 咬\nn. 咬', example: 'Does your dog bite?\nHe took another bite of apple.' },
          { word: 'thought', meaning: 'n. 思考, 想法', example: 'have second thoughts\nI have a thought.' },
          { word: 'cite', meaning: 'v. 引用', example: 'cite a poem\ncite an example' },
          { word: 'widely', meaning: 'adv. 广泛地', example: 'The song is becoming widely popular.' },
          { word: 'traditional', meaning: 'adj. 传统的', example: 'traditional dress' },
          { word: 'certain', meaning: 'adj. 确信的, 肯定的', example: 'Are you certain about this?' },
          { word: 'erase', meaning: 'v. 擦掉', example: 'He had erased the wrong word.' },
          { word: 'file', meaning: 'n. 文件\nv. 归档', example: 'download/copy a file\nPlease file the letters.' }
        ]
      },
      {
        name: 'PART 27 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'innovation', meaning: 'n. 创新', example: 'technological innovation' },
          { word: 'quantity', meaning: 'n. 量, 数量', example: 'a large/small quantity of sth.\nhuge/vast quantities of food' },
          { word: 'equal', meaning: 'adj. 相等的', example: 'All men are created equal.' },
          { word: 'crisis', meaning: 'n. 危机', example: 'a political/financial crisis' },
          { word: 'boom', meaning: 'n. 繁荣', example: 'an economic boom\nbaby boom' },
          { word: 'rise', meaning: 'n. 增加\nv. 上升', example: 'the rise in oil prices\nThe sun rises in the east.' },
          { word: 'decline', meaning: 'v. 下降; 衰退\nn. 下降; 衰退', example: 'a rapid/sharp/gradual decline' },
          { word: 'core', meaning: 'n. 核; 中心\nadj. 核心的; 主要的', example: 'the earth\'s core\nWe need to concentrate on our core business.' },
          { word: 'profit', meaning: 'n. 利润; 好处', example: 'make handsome profits\nbring huge profits' },
          { word: 'response', meaning: 'n. 响应; 反应; 回答', example: 'make no response\nin response to' }
        ]
      },
      {
        name: 'PART 28 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'blame', meaning: 'v. 责备; 归咎于\nn. 责备; 过失', example: 'I don\'t blame you.\nHe put all the blame on me.' },
          { word: 'region', meaning: 'n. 地区', example: 'small regions' },
          { word: 'soil', meaning: 'n. 土壤', example: 'rich/poor soil' },
          { word: 'bubble', meaning: 'n. 气泡, 泡沫', example: 'bubbles in the job market' },
          { word: 'school', meaning: 'n. 学校; 学院; 学派', example: 'go to school\nin school\nbusiness school' },
          { word: 'scholar', meaning: 'n. 学者', example: 'The library attracts thousands of scholars.' },
          { word: 'argue', meaning: 'v. 争论; 论证', example: 'sb. argue that...' },
          { word: 'agree', meaning: 'v. 同意', example: 'agree on\nagree to do' },
          { word: 'fund', meaning: 'n. 基金; 资金\nv. 为...提供资金', example: 'government funds\nThey do not fund research.' },
          { word: 'line', meaning: 'n. 线条', example: 'a straight line\nline graph' }
        ]
      },
      {
        name: 'PART 29 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'industry', meaning: 'n. 工业; 行业', example: 'the banking industry' },
          { word: 'description', meaning: 'n. 描述; 描绘', example: 'a guideline for job description' },
          { word: 'benefit', meaning: 'n. 益处; 救济金\nv. 获益', example: 'It has brought much benefit to the banking industry.\nbenefit from\nIt will benefit other Asian countries.' },
          { word: 'defect', meaning: 'n. 缺点, 缺陷', example: 'a hearing defect' },
          { word: 'enhance', meaning: 'v. 提升, 提高', example: 'enhance his sense of responsibility' },
          { word: 'collect', meaning: 'v. 收集; 采集; 收藏', example: 'collect stamps\ncollection' },
          { word: 'admit', meaning: 'v. 承认', example: 'He admitted his mistake.' },
          { word: 'parallel', meaning: 'adj. 平行的', example: 'parallel lines' },
          { word: 'believe', meaning: 'v. 相信', example: 'Sagan believes in ghosts.' },
          { word: 'communicate', meaning: 'v. 交流; 沟通', example: 'Scientists should communicate more with the public.' }
        ]
      },
      {
        name: 'PART 30 · 基础唤醒词汇',
        description: '基础唤醒词汇 10 词',
        words: [
          { word: 'figure', meaning: 'n. 人物; 人士; 数字\nv. 弄懂', example: 'a political figure\nWrite the figure \'7\' on the board.\nI can\'t figure out how to do this.' },
          { word: 'long', meaning: 'adj. 长的; 长期的\nv. 渴望', example: 'She had long dark hair.\nlong for sth.' },
          { word: 'race', meaning: 'n. 种族; 比赛\nv. 和...比赛', example: 'The Chinese belong to the yellow race.\nwalking race\nrace to do sth.' },
          { word: 'deepen', meaning: 'v. 加深', example: 'deepen understanding' },
          { word: 'symbol', meaning: 'n. 符号; 象征', example: 'A heart shape is a symbol of love.' },
          { word: 'account', meaning: 'n. 账户; 账号\nv. 解释', example: 'I don\'t have a bank account.\naccount for' },
          { word: 'achieve', meaning: 'v. 实现; 达到', example: 'achieve one\'s goal\nachieve the desired result' },
          { word: 'separate', meaning: 'v. 分开\nadj. 分开的', example: 'separate sth. from sth.\nseparate bedrooms' },
          { word: 'select', meaning: 'v. 挑选; 选择', example: 'He was selected for the team.' },
          { word: 'assist', meaning: 'v. 帮助', example: 'We\'ll do all we can to assist you.' }
        ]
      }
    ];

    const insertWordStmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
    );

    let addedLists = 0;
    let addedWords = 0;
    for (const part of parts) {
      const existingList = await db.prepare(
        'SELECT id FROM word_lists WHERE name = ? AND word_book_id = ? LIMIT 1'
      ).get(part.name, bookId);
      
      let listId;
      if (existingList) {
        listId = existingList.id;
        console.log(`种子数据: 词表 "${part.name}" 已存在(ID:${listId})，检查缺失单词...`);

        const existingWords = await db.prepare(
          'SELECT word FROM words WHERE word_list_id = ?'
        ).all(listId);
        const existingWordSet = new Set(existingWords.map(r => r.word));

        const missing = part.words.filter(w => !existingWordSet.has(w.word));
        if (missing.length === 0) {
          console.log(`  单词完整，无需补充`);
          continue;
        }

        // 计算当前最大 sort_order
        const maxOrderRow = await db.prepare(
          'SELECT COALESCE(MAX(sort_order), 0) as mo FROM words WHERE word_list_id = ?'
        ).get(listId);
        let nextOrder = Number(maxOrderRow.mo || 0);

        for (const w of missing) {
          nextOrder++;
          await insertWordStmt.run(listId, w.word, w.meaning, w.example || '', nextOrder);
          console.log(`  + 补充单词: ${w.word}`);
          addedWords++;
        }

        // 更新词表描述
        await db.prepare('UPDATE word_lists SET description = ? WHERE id = ?').run(part.description, listId);
      } else {
        const listInfo = await db.prepare(
          'INSERT INTO word_lists (name, description, word_book_id, teacher_id, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).run(part.name, part.description, bookId, teacher.id, 0);
        listId = listInfo.lastInsertRowid;
        console.log(`种子数据: 创建词表 "${part.name}"`);

        for (let i = 0; i < part.words.length; i++) {
          const w = part.words[i];
          await insertWordStmt.run(listId, w.word, w.meaning, w.example || '', i + 1);
        }
        console.log(`  插入 ${part.words.length} 个单词`);
        addedLists++;
        addedWords += part.words.length;
      }
    }
    console.log(`种子数据: 「${BOOK_NAME}」导入完成，新增 ${addedLists} 词表，补充 ${addedWords} 单词`);
  } catch (e) {
    console.error('种子数据导入出错:', e.message);
  }
}
runSeedData();

const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 60000;
const MAX_LOGIN_ATTEMPTS = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  let record = loginAttempts.get(ip);
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    record = { windowStart: now, count: 0 };
    loginAttempts.set(ip, record);
  }
  record.count++;
  if (record.count > MAX_LOGIN_ATTEMPTS) {
    return false;
  }
  return true;
}

const RANK_LEVELS = [
  { name: '传奇', icon: '🌟', color: '#dc2626', level: 9, minDays: 366, minWords: 20000 },
  { name: '宗师', icon: '👑', color: '#7c3aed', level: 8, minDays: 201, minWords: 12000 },
  { name: '大师', icon: '🏆', color: '#ea580c', level: 7, minDays: 101, minWords: 7000 },
  { name: '钻石', icon: '💠', color: '#2563eb', level: 6, minDays: 61, minWords: 4000 },
  { name: '铂金', icon: '💎', color: '#0891b2', level: 5, minDays: 31, minWords: 2000 },
  { name: '黄金', icon: '🥇', color: '#d97706', level: 4, minDays: 15, minWords: 1000 },
  { name: '白银', icon: '🥈', color: '#6b7280', level: 3, minDays: 8, minWords: 500 },
  { name: '青铜', icon: '🥉', color: '#92400e', level: 2, minDays: 4, minWords: 200 },
  { name: '初学者', icon: '🌱', color: '#65a30d', level: 1, minDays: 0, minWords: 0 },
];

function getRank(days, words) {
  for (const r of RANK_LEVELS) {
    if (days >= r.minDays || words >= r.minWords) return r;
  }
  return RANK_LEVELS[RANK_LEVELS.length - 1];
}

function getNextRank(days, words) {
  for (let i = RANK_LEVELS.length - 2; i >= 0; i--) {
    const r = RANK_LEVELS[i];
    if (days < r.minDays && words < r.minWords) return r;
  }
  return null;
}

function calcStreak(dates) {
  if (!dates || dates.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const dateSet = new Set(dates.map(d => typeof d === 'string' ? d : d.checkin_date));
  if (!dateSet.has(todayStr) && !dateSet.has(yesterdayStr)) return 0;
  let streak = 0;
  let cursor = new Date(today);
  if (!dateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
  while (true) {
    const cursorStr = cursor.toISOString().split('T')[0];
    if (dateSet.has(cursorStr)) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
}

function cleanMeaning(s) {
  s = s.trim().toLowerCase();
  s = s.replace(/\(.*?\)/g, '').trim();
  s = s.replace(/^[a-z]+\.\s*/, '').trim();
  s = s.replace(/^[（(][^）)]*[）)]\s*/, '').trim();
  return s;
}

const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
const fs = require('fs');

function getTaskWordListIds(task) {
  if (task.word_list_ids) {
    try {
      const ids = JSON.parse(task.word_list_ids);
      if (Array.isArray(ids) && ids.length > 0) return ids.map(Number);
    } catch (e) {}
  }
  if (task.word_list_id) return [Number(task.word_list_id)];
  return [];
}

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }
  if (typeof username !== 'string' || username.length > 50 || username.length < 2) {
    return res.status(400).json({ error: '用户名格式不正确' });
  }
  if (typeof password !== 'string' || password.length > 100) {
    return res.status(400).json({ error: '密码格式不正确' });
  }
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: '登录尝试过于频繁，请1分钟后再试' });
  }
  const user = await db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }
  loginAttempts.delete(ip);
  const token = signToken(user);
  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, avatar: user.avatar }
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码必填' });
  }
  if (typeof username !== 'string' || username.length > 50 || username.length < 2) {
    return res.status(400).json({ error: '用户名长度需在2-50之间' });
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: '密码长度需在6-100之间' });
  }
  const userRole = 'student';
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, userRole);
  const user = { id: info.lastInsertRowid, username, role: userRole };
  res.json({ token: signToken(user), user });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const students = await db.prepare(
    "SELECT id, username, created_at FROM users WHERE role = 'student' ORDER BY id"
  ).all();
  res.json({ students });
});

app.get('/api/users', authMiddleware, requireRole('teacher'), async (req, res) => {
  let users;
  try {
    users = await db.prepare(
      'SELECT id, username, role, created_at, rank_bonus_days, rank_bonus_words FROM users ORDER BY role, username'
    ).all();
  } catch (e) {
    console.warn('获取用户列表（含奖励字段）失败，退化为基础查询:', e.message);
    users = await db.prepare(
      'SELECT id, username, role, created_at FROM users ORDER BY role, username'
    ).all();
  }
  const checkinRows = await db.prepare(
    'SELECT student_id, COUNT(*) as cnt FROM checkins GROUP BY student_id'
  ).all();
  const wordsRows = await db.prepare(
    'SELECT student_id, COALESCE(SUM(words_studied), 0) as w FROM study_sessions GROUP BY student_id'
  ).all();
  const checkinMap = {}, wordsMap = {};
  for (const r of checkinRows) checkinMap[r.student_id] = Number(r.cnt) || 0;
  for (const r of wordsRows) wordsMap[r.student_id] = Number(r.w) || 0;
  const enriched = users.map(u => {
    if (u.role !== 'student') return u;
    return {
      ...u,
      total_checkins: checkinMap[u.id] || 0,
      total_words: wordsMap[u.id] || 0,
    };
  });
  res.json({ users: enriched });
});

app.post('/api/users', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: '参数错误' });
  }
  const exists = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已存在' });
  const hash = bcrypt.hashSync(password, 10);
  const info = await db.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)'
  ).run(username, hash, role);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/users/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: '不能删除当前登录账号' });
  }
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  if (target.role === 'teacher') {
    const hasLists = await db.prepare('SELECT 1 FROM word_lists WHERE teacher_id = ? LIMIT 1').get(targetId);
    const hasTasks = await db.prepare('SELECT 1 FROM tasks WHERE teacher_id = ? LIMIT 1').get(targetId);
    if (hasLists || hasTasks) {
      return res.status(400).json({ error: '该教师有关联的词表或任务，请先处理' });
    }
  }
  const tsIds = await db.prepare('SELECT id FROM task_students WHERE student_id = ?').all(targetId);
  for (const ts of tsIds) {
    await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
    await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  }
  await db.prepare('DELETE FROM task_students WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM favorites WHERE user_id = ?').run(targetId);
  await db.prepare('DELETE FROM comments WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM checkins WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM translation_records WHERE student_id = ?').run(targetId);
  const selfTestIds = await db.prepare('SELECT id FROM self_tests WHERE student_id = ?').all(targetId);
  for (const st of selfTestIds) {
    await db.prepare('DELETE FROM self_test_records WHERE self_test_id = ?').run(st.id);
  }
  await db.prepare('DELETE FROM self_tests WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM student_tags WHERE student_id = ?').run(targetId);
  await db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
  res.json({ ok: true });
});

app.put('/api/users/:id/password', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { password } = req.body;
  if (!password || typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return res.status(400).json({ error: '密码长度需在6-100之间' });
  }
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '请通过设置页面修改自己的密码' });
  }
  const hash = bcrypt.hashSync(password, 10);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

app.get('/api/users/:id/rank-info', authMiddleware, requireRole('teacher'), async (req, res) => {
  const userId = Number(req.params.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role !== 'student') return res.status(400).json({ error: '仅学生有等级信息' });

  const bonusDays = Number(user.rank_bonus_days) || 0;
  const bonusWords = Number(user.rank_bonus_words) || 0;

  const totalCheckinsRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM checkins WHERE student_id = ?'
  ).get(userId);
  const totalCheckins = Number(totalCheckinsRow.cnt) || 0;

  const totalWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(userId);
  const totalWords = Number(totalWordsRow.w) || 0;

  const checkinRows = await db.prepare(
    'SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC'
  ).all(userId);

  const streak = calcStreak(checkinRows);
  const effectiveDays = streak + bonusDays;
  const effectiveWords = totalWords + bonusWords;
  const rank = getRank(effectiveDays, effectiveWords);
  const nextRank = getNextRank(effectiveDays, effectiveWords);

  res.json({
    user: { id: user.id, username: user.username },
    streak_days: streak,
    total_checkins: totalCheckins,
    total_words: totalWords,
    rank_bonus_days: bonusDays,
    rank_bonus_words: bonusWords,
    effective_days: effectiveDays,
    effective_words: effectiveWords,
    rank,
    next_rank: nextRank,
  });
});

app.put('/api/users/:id/rank-bonus', authMiddleware, requireRole('teacher'), async (req, res) => {
  const userId = Number(req.params.id);
  const { rank_bonus_days, rank_bonus_words } = req.body;
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role !== 'student') return res.status(400).json({ error: '仅学生可设置等级奖励' });
  const days = Math.max(0, Math.min(9999, Number(rank_bonus_days) || 0));
  const words = Math.max(0, Math.min(999999, Number(rank_bonus_words) || 0));
  await db.prepare(
    'UPDATE users SET rank_bonus_days = ?, rank_bonus_words = ? WHERE id = ?'
  ).run(days, words, userId);
  res.json({ ok: true, rank_bonus_days: days, rank_bonus_words: words });
});

app.get('/api/users/:id/study-detail', authMiddleware, requireRole('teacher'), async (req, res) => {
  const userId = Number(req.params.id);
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  if (user.role !== 'student') return res.status(400).json({ error: '仅学生有学习详情' });

  const bonusDays = Number(user.rank_bonus_days) || 0;
  const bonusWords = Number(user.rank_bonus_words) || 0;

  const totalTasksRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ?'
  ).get(userId);
  const testedTasksRow = await db.prepare(
    "SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ? AND status = 'tested'"
  ).get(userId);
  const avgScoreRow = await db.prepare(
    'SELECT AVG(test_score) as avg FROM task_students WHERE student_id = ? AND test_score IS NOT NULL'
  ).get(userId);
  const studyDaysRow = await db.prepare(
    "SELECT COUNT(DISTINCT DATE(last_studied_at)) as cnt FROM task_students WHERE student_id = ? AND last_studied_at IS NOT NULL"
  ).get(userId);
  const totalWordsRow = await db.prepare(
    `SELECT COUNT(DISTINCT sr.word_id) as cnt FROM study_records sr
     INNER JOIN task_students ts ON ts.id = sr.task_student_id
     WHERE ts.student_id = ?`
  ).get(userId);
  const wrongCountRow = await db.prepare(
    `SELECT COUNT(DISTINCT tr.word_id) as cnt FROM test_records tr
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     WHERE ts.student_id = ? AND tr.is_correct = 0`
  ).get(userId);

  const totalSessionWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(userId);
  const totalDurationRow = await db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as s FROM study_sessions WHERE student_id = ?'
  ).get(userId);

  const checkinRows = await db.prepare(
    'SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC'
  ).all(userId);

  const streak = calcStreak(checkinRows);
  const totalSessionWords = Number(totalSessionWordsRow.w) || 0;
  const effectiveDays = streak + bonusDays;
  const effectiveWords = totalSessionWords + bonusWords;
  const rank = getRank(effectiveDays, effectiveWords);

  const recentTasks = await db.prepare(
    `SELECT ts.*, t.name as task_name
     FROM task_students ts
     INNER JOIN tasks t ON t.id = ts.task_id
     WHERE ts.student_id = ?
     ORDER BY COALESCE(ts.last_studied_at, ts.created_at) DESC
     LIMIT 10`
  ).all(userId);

  const recentCheckins = await db.prepare(
    'SELECT * FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC LIMIT 14'
  ).all(userId);

  const recentSelfTests = await db.prepare(
    `SELECT st.*, COUNT(str.id) as total,
      SUM(CASE WHEN str.is_correct = 1 THEN 1 ELSE 0 END) as correct
     FROM self_tests st
     LEFT JOIN self_test_records str ON str.self_test_id = st.id
     WHERE st.student_id = ?
     GROUP BY st.id
     ORDER BY st.created_at DESC
     LIMIT 10`
  ).all(userId);

  res.json({
    user: { id: user.id, username: user.username, created_at: user.created_at },
    stats: {
      totalTasks: Number(totalTasksRow.cnt) || 0,
      testedTasks: Number(testedTasksRow.cnt) || 0,
      avgScore: Math.round(Number(avgScoreRow.avg) || 0),
      studyDays: Number(studyDaysRow.cnt) || 0,
      totalWords: Number(totalWordsRow.cnt) || 0,
      wrongCount: Number(wrongCountRow.cnt) || 0,
      totalSessionWords,
      totalDuration: Number(totalDurationRow.s) || 0,
      checkinDays: checkinRows.length,
      streakDays: streak,
      rank_bonus_days: bonusDays,
      rank_bonus_words: bonusWords,
    },
    rank,
    recentTasks: recentTasks.map(t => ({
      ...t,
      study_progress: Number(t.study_progress) || 0,
      test_score: t.test_score != null ? Number(t.test_score) : null,
    })),
    recentCheckins,
    recentSelfTests: recentSelfTests.map(t => ({
      ...t,
      total: Number(t.total) || 0,
      correct: Number(t.correct) || 0,
      accuracy: t.total > 0 ? Math.round(Number(t.correct) / Number(t.total) * 100) : 0,
    })),
  });
});

app.get('/api/word-books', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT wb.*, 
        (SELECT COUNT(*) FROM word_lists wl WHERE wl.word_book_id = wb.id) as list_count,
        (SELECT COUNT(*) FROM words w 
         INNER JOIN word_lists wl ON wl.id = w.word_list_id 
         WHERE wl.word_book_id = wb.id) as word_count
       FROM word_books wb 
       WHERE wb.teacher_id = ? 
       ORDER BY wb.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT DISTINCT wb.*, 
        (SELECT COUNT(*) FROM word_lists wl WHERE wl.word_book_id = wb.id) as list_count,
        (SELECT COUNT(*) FROM words w 
         INNER JOIN word_lists wl ON wl.id = w.word_list_id 
         WHERE wl.word_book_id = wb.id) as word_count
       FROM word_books wb
       WHERE (
         ${IS_PUBLIC}
         OR wb.id IN (
           SELECT DISTINCT wl2.word_book_id FROM word_lists wl2
           INNER JOIN tasks t ON t.word_list_id = wl2.id
           INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
         )
         OR wb.teacher_id = ?
       )
       ORDER BY wb.created_at DESC`
    ).all(req.user.id, req.user.id);
  }
  res.json({ wordBooks: rows });
});

app.post('/api/word-books', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, cover_color, cover_image, is_public } = req.body;
  if (!name) return res.status(400).json({ error: '请输入单词书名称' });
  const publicFlag = is_public === undefined ? (isPG ? true : 1) : (is_public ? (isPG ? true : 1) : (isPG ? false : 0));
  const info = await db.prepare(
    'INSERT INTO word_books (name, description, cover_color, cover_image, is_public, teacher_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(name, description || '', cover_color || '#6366f1', cover_image || null, publicFlag, req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/word-books/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, cover_color, cover_image, is_public } = req.body;
  const publicFlag = is_public === undefined ? (isPG ? true : 1) : (is_public ? (isPG ? true : 1) : (isPG ? false : 0));
  await db.prepare(
    'UPDATE word_books SET name = ?, description = ?, cover_color = ?, cover_image = ?, is_public = ? WHERE id = ? AND teacher_id = ?'
  ).run(name, description || '', cover_color || '#6366f1', cover_image || null, publicFlag, req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/word-books/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const wb = await db.prepare('SELECT * FROM word_books WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!wb) return res.status(404).json({ error: '单词书不存在或无权限' });
  const hasLists = await db.prepare('SELECT 1 FROM word_lists WHERE word_book_id = ? LIMIT 1').get(req.params.id);
  if (hasLists) return res.status(400).json({ error: '该单词书下还有词表，请先删除词表' });
  await db.prepare('DELETE FROM word_books WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/word-lists', authMiddleware, async (req, res) => {
  const { word_book_id } = req.query;
  let rows;
  let baseSQL = 'SELECT wl.*, (SELECT COUNT(*) FROM words w WHERE w.word_list_id = wl.id) as word_count FROM word_lists wl';
  let whereSQL = '';
  let params = [];

  if (req.user.role === 'teacher') {
    whereSQL = ' WHERE wl.teacher_id = ?';
    params.push(req.user.id);
  } else {
    baseSQL += ' LEFT JOIN word_books wb ON wb.id = wl.word_book_id';
    whereSQL = ` WHERE (
      wl.word_book_id IS NULL
      OR ${IS_PUBLIC}
      OR EXISTS (
        SELECT 1 FROM tasks t
        INNER JOIN task_students ts ON ts.task_id = t.id
        WHERE t.word_list_id = wl.id AND ts.student_id = ?
      )
      OR wl.teacher_id = ?
    )`;
    params.push(req.user.id, req.user.id);
  }

  if (word_book_id) {
    whereSQL += ' AND wl.word_book_id = ?';
    params.push(word_book_id);
  }

  const finalSQL = baseSQL + whereSQL + ' ORDER BY wl.sort_order IS NULL, wl.sort_order ASC, wl.name ASC, wl.created_at DESC';
  rows = await db.prepare(finalSQL).all(...params);
  res.json({ wordLists: rows });
});

app.post('/api/word-lists', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, words, word_book_id } = req.body;
  if (!name) return res.status(400).json({ error: '请输入词表名称' });
  const info = await db.prepare(
    'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', word_book_id || null, req.user.id);
  const listId = info.lastInsertRowid;
  if (words && words.length) {
    const stmt = db.prepare(
      'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.word && w.meaning) await stmt.run(listId, w.word, w.meaning, w.example || '', i + 1);
    }
  }
  res.json({ id: listId });
});

app.put('/api/word-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, word_book_id, sort_order } = req.body;
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  
  const finalName = name !== undefined ? name : list.name;
  const finalDesc = description !== undefined ? description : list.description;
  const finalBookId = word_book_id !== undefined ? (word_book_id || null) : list.word_book_id;
  
  if (sort_order !== undefined) {
    await db.prepare(
      'UPDATE word_lists SET name = ?, description = ?, word_book_id = ?, sort_order = ? WHERE id = ? AND teacher_id = ?'
    ).run(finalName, finalDesc || '', finalBookId, sort_order, req.params.id, req.user.id);
  } else {
    await db.prepare(
      'UPDATE word_lists SET name = ?, description = ?, word_book_id = ? WHERE id = ? AND teacher_id = ?'
    ).run(finalName, finalDesc || '', finalBookId, req.params.id, req.user.id);
  }
  res.json({ ok: true });
});

app.delete('/api/word-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  const hasTasks = await db.prepare('SELECT 1 FROM tasks WHERE word_list_id = ? LIMIT 1').get(req.params.id);
  if (hasTasks) return res.status(400).json({ error: '该词表有关联的任务，请先删除任务' });
  const wordIds = await db.prepare('SELECT id FROM words WHERE word_list_id = ?').all(req.params.id);
  for (const w of wordIds) {
    await db.prepare('DELETE FROM favorites WHERE word_id = ?').run(w.id);
  }
  await db.prepare('DELETE FROM words WHERE word_list_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM word_lists WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/words', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '词表不存在' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_lists wl
       LEFT JOIN word_books wb ON wb.id = wl.word_book_id
       WHERE wl.id = ? AND (
         wl.word_book_id IS NULL
         OR wl.teacher_id = ?
         OR ${IS_PUBLIC}
         OR EXISTS (
           SELECT 1 FROM tasks t
           INNER JOIN task_students ts ON ts.task_id = t.id
           WHERE t.word_list_id = wl.id AND ts.student_id = ?
         )
       )`
    ).get(req.params.id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const words = await db.prepare(
    'SELECT * FROM words WHERE word_list_id = ? ORDER BY sort_order, id'
  ).all(req.params.id);
  res.json({ words });
});

app.post('/api/word-lists/:id/words', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example } = req.body;
  if (!word || !meaning) return res.status(400).json({ error: '单词和释义必填' });
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM words WHERE word_list_id = ?').get(req.params.id);
  const nextOrder = (maxRow?.m || 0) + 1;
  const info = await db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, word, meaning, example || '', nextOrder);
  res.json({ id: info.lastInsertRowid });
});

app.post('/api/word-lists/:id/words/insert', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example, position, reference_word_id } = req.body;
  if (!word || !meaning) return res.status(400).json({ error: '单词和释义必填' });
  if (!['before', 'after', 'end'].includes(position)) {
    return res.status(400).json({ error: '无效的插入位置' });
  }
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });

  const allWords = await db.prepare('SELECT id, sort_order FROM words WHERE word_list_id = ? ORDER BY sort_order, id').all(req.params.id);
  let insertOrder;

  if (position === 'end' || allWords.length === 0) {
    const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM words WHERE word_list_id = ?').get(req.params.id);
    insertOrder = (maxRow?.m || 0) + 1;
  } else {
    const refWord = allWords.find(w => w.id === Number(reference_word_id));
    if (!refWord) return res.status(404).json({ error: '参考单词不存在' });
    insertOrder = position === 'before' ? refWord.sort_order : refWord.sort_order + 1;
    for (const w of allWords) {
      if (w.sort_order >= insertOrder) {
        await db.prepare('UPDATE words SET sort_order = sort_order + 1 WHERE id = ?').run(w.id);
      }
    }
  }

  const info = await db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(req.params.id, word, meaning, example || '', insertOrder);
  res.json({ id: info.lastInsertRowid, sort_order: insertOrder });
});

app.put('/api/words/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { word, meaning, example } = req.body;
  const w = await db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE w.id = ? AND wl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: '单词不存在或无权限' });
  await db.prepare(
    'UPDATE words SET word = ?, meaning = ?, example = ? WHERE id = ?'
  ).run(word, meaning, example || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/words/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const w = await db.prepare(
    `SELECT w.* FROM words w
     INNER JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE w.id = ? AND wl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!w) return res.status(404).json({ error: '单词不存在或无权限' });
  await db.prepare('DELETE FROM words WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT t.*,
        (SELECT COUNT(DISTINCT student_id) FROM task_students ts WHERE ts.task_id = t.id) as student_count
       FROM tasks t
       WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT t.*, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at
       FROM tasks t
       INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       ORDER BY t.created_at DESC`
    ).all(req.user.id);
  }

  const wlNameCache = {};
  const getWlName = async (id) => {
    if (wlNameCache[id]) return wlNameCache[id];
    const wl = await db.prepare('SELECT name FROM word_lists WHERE id = ?').get(id);
    const name = wl ? wl.name : '未知词表';
    wlNameCache[id] = name;
    return name;
  };

  const tasksWithNames = [];
  for (const t of rows) {
    const listIds = getTaskWordListIds(t);
    const names = [];
    let totalWords = 0;
    for (const lid of listIds) {
      const name = await getWlName(lid);
      names.push(name);
      const wc = await db.prepare('SELECT COUNT(*) as cnt FROM words WHERE word_list_id = ?').get(lid);
      totalWords += Number(wc.cnt) || 0;
    }
    const wordListName = names.length > 1 ? `${names.join('、')}` : (names[0] || '未知词表');

    if (req.user.role === 'teacher') {
      const progressStats = await db.prepare(
        `SELECT 
          COUNT(*) as total_students,
          SUM(CASE WHEN test_score IS NOT NULL OR status = 'tested' THEN 1 ELSE 0 END) as completed_count,
          SUM(CASE WHEN status = 'studying' AND test_score IS NULL THEN 1 ELSE 0 END) as studying_count,
          SUM(CASE WHEN status = 'pending' AND test_score IS NULL THEN 1 ELSE 0 END) as pending_count,
          AVG(CASE WHEN test_score IS NOT NULL OR status = 'tested' THEN 100 ELSE COALESCE(study_progress, 0) END) as avg_progress,
          AVG(CASE WHEN test_score IS NOT NULL THEN test_score END) as avg_score
         FROM task_students WHERE task_id = ?`
      ).get(t.id);
      
      t.total_students = progressStats.total_students || 0;
      t.completed_count = progressStats.completed_count || 0;
      t.studying_count = progressStats.studying_count || 0;
      t.pending_count = progressStats.pending_count || 0;
      t.avg_progress = Math.round(Number(progressStats.avg_progress) || 0);
      t.avg_score = progressStats.avg_score !== null && progressStats.avg_score !== undefined ? Math.round(Number(progressStats.avg_score)) : null;

      const studentNames = await db.prepare(
        `SELECT u.username FROM task_students ts 
         INNER JOIN users u ON u.id = ts.student_id 
         WHERE ts.task_id = ? 
         ORDER BY u.username LIMIT 8`
      ).all(t.id);
      t.student_names = studentNames.map(s => s.username);
      t.show_student_names = t.total_students <= 8;
      
      const now = new Date();
      if (t.deadline) {
        const deadline = new Date(t.deadline);
        if (t.completed_count >= t.total_students && t.total_students > 0) {
          t.task_status = 'completed';
        } else if (deadline < now) {
          t.task_status = 'expired';
        } else {
          t.task_status = 'active';
        }
      } else {
        t.task_status = t.completed_count >= t.total_students && t.total_students > 0 ? 'completed' : 'active';
      }
    }

    tasksWithNames.push({
      ...t,
      word_list_name: wordListName,
      word_list_count: listIds.length,
      total_words: totalWords,
    });
  }

  res.json({ tasks: tasksWithNames });
});

app.post('/api/tasks', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, word_list_id, word_list_ids, deadline, test_words_count, test_mode, student_ids, sentence_list_id } = req.body;
  if (!name) return res.status(400).json({ error: '请输入任务名称' });

  let listIds = [];
  if (word_list_ids && Array.isArray(word_list_ids) && word_list_ids.length > 0) {
    listIds = word_list_ids.map(Number);
  } else if (word_list_id) {
    listIds = [Number(word_list_id)];
  }
  if (listIds.length === 0) return res.status(400).json({ error: '请至少选择一个词表' });

  for (const lid of listIds) {
    const wl = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(lid, req.user.id);
    if (!wl) return res.status(403).json({ error: `词表 ID ${lid} 不存在或无权限` });
  }
  if (sentence_list_id) {
    const sl = await db.prepare('SELECT * FROM sentence_lists WHERE id = ? AND teacher_id = ?').get(sentence_list_id, req.user.id);
    if (!sl) return res.status(403).json({ error: '句子列表不存在或无权限' });
  }

  const wordListIdsJson = JSON.stringify(listIds);
  const primaryListId = listIds[0];

  const info = await db.prepare(
    'INSERT INTO tasks (name, word_list_id, word_list_ids, teacher_id, deadline, test_words_count, test_mode, sentence_list_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(name, primaryListId, wordListIdsJson, req.user.id, deadline || null, test_words_count || 10, test_mode || 'mixed', sentence_list_id || null);
  const taskId = info.lastInsertRowid;
  if (student_ids && student_ids.length) {
    const stmt = db.prepare(
      'INSERT OR IGNORE INTO task_students (task_id, student_id) VALUES (?, ?)'
    );
    const notifStmt = db.prepare(
      'INSERT INTO notifications (student_id, task_id, content) VALUES (?, ?, ?)'
    );
    const notifContent = `📚 你有新任务「${name}」，请尽快完成`;
    for (const sid of student_ids) {
      await stmt.run(taskId, sid);
      try { await notifStmt.run(sid, taskId, notifContent); } catch (e) {}
    }
  }
  res.json({ id: taskId });
});

app.delete('/api/tasks/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在或无权限' });
  const tsIds = await db.prepare('SELECT id FROM task_students WHERE task_id = ?').all(req.params.id);
  for (const ts of tsIds) {
    await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
    await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  }
  await db.prepare('DELETE FROM task_students WHERE task_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM comments WHERE task_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM tasks WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// ============ 通知 API ============

// 获取当前学生的通知列表
app.get('/api/notifications', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: '仅学生可查看通知' });
  const rows = await db.prepare(
    `SELECT n.id, n.task_id, n.content, n.is_read, n.created_at,
            t.name as task_name
     FROM notifications n
     LEFT JOIN tasks t ON t.id = n.task_id
     WHERE n.student_id = ?
     ORDER BY n.created_at DESC
     LIMIT 50`
  ).all(req.user.id);
  res.json({ notifications: rows });
});

// 获取未读通知数
app.get('/api/notifications/unread-count', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: '仅学生可查看通知' });
  const row = await db.prepare(
    'SELECT COUNT(*) as cnt FROM notifications WHERE student_id = ? AND is_read = 0'
  ).get(req.user.id);
  res.json({ count: row.cnt });
});

// 标记单条通知为已读
app.post('/api/notifications/:id/read', authMiddleware, async (req, res) => {
  await db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?'
  ).run(req.params.id, req.user.id);
  res.json({ ok: true });
});

// 全部标记已读
app.post('/api/notifications/read-all', authMiddleware, async (req, res) => {
  await db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE student_id = ?'
  ).run(req.user.id);
  res.json({ ok: true });
});


app.get('/api/tasks/:id/progress', authMiddleware, requireRole('teacher'), async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在或无权限' });

  const listIds = getTaskWordListIds(task);
  const placeholders = listIds.map(() => '?').join(',');
  const totalWordsCount = listIds.length > 0
    ? (await db.prepare(`SELECT COUNT(*) as cnt FROM words WHERE word_list_id IN (${placeholders})`).all(...listIds))[0].cnt
    : 0;

  const rows = await db.prepare(
    `SELECT ts.*, u.username, ${totalWordsCount} as total_words
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);

  const words = listIds.length > 0
    ? await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY word_list_id, sort_order, id`
      ).all(...listIds)
    : [];

  res.json({ progress: rows, words });
});

app.get('/api/tasks/:id/study', authMiddleware, async (req, res) => {
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });

  const listIds = getTaskWordListIds(task);
  const placeholders = listIds.map(() => '?').join(',');
  const words = listIds.length > 0
    ? await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY word_list_id, sort_order, id`
      ).all(...listIds)
    : [];

  const studied = await db.prepare(
    'SELECT word_id, is_known FROM study_records WHERE task_student_id = ?'
  ).all(ts.id);
  const studiedMap = {};
  for (const s of studied) studiedMap[s.word_id] = s.is_known;
  await db.prepare(
    "UPDATE task_students SET status = CASE WHEN status = 'pending' THEN 'studying' ELSE status END, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(ts.id);
  res.json({ taskStudentId: ts.id, words, studiedMap });
});

app.post('/api/study-records', authMiddleware, async (req, res) => {
  const { task_student_id, word_id, is_known } = req.body;
  if (!task_student_id || !word_id) return res.status(400).json({ error: '参数错误' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  await db.prepare(
    `INSERT INTO study_records (task_student_id, word_id, is_known) VALUES (?, ?, ?)
     ON CONFLICT(task_student_id, word_id) DO UPDATE SET is_known = excluded.is_known, studied_at = CURRENT_TIMESTAMP`
  ).run(task_student_id, word_id, is_known ? 1 : 0);

  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  const listIds = task ? getTaskWordListIds(task) : [];
  const studiedRow = await db.prepare(
    'SELECT COUNT(*) as cnt FROM study_records sr WHERE sr.task_student_id = ?'
  ).get(ts.id);
  const studied = Number(studiedRow.cnt) || 0;

  let total = 0;
  if (listIds.length > 0) {
    const placeholders = listIds.map(() => '?').join(',');
    const totalRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM words WHERE word_list_id IN (${placeholders})`
    ).all(...listIds);
    total = Number(totalRow[0].cnt) || 0;
  }

  const pct = total > 0 ? Math.min(100, (studied / total) * 100) : 0;
  await db.prepare('UPDATE task_students SET study_progress = ?, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(pct, task_student_id);
  res.json({ ok: true, progress: pct });
});

app.get('/api/tasks/:id/test-words', authMiddleware, async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: '任务不存在' });
  const ts = await db.prepare(
    'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未分配此任务' });

  const listIds = getTaskWordListIds(task);
  const limit = task.test_words_count || 10;
  let allWords = [];

  if (listIds.length > 0) {
    const placeholders = listIds.map(() => '?').join(',');
    const totalCountRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM words WHERE word_list_id IN (${placeholders})`
    ).all(...listIds);
    const totalCount = Number(totalCountRow[0].cnt) || 0;

    if (totalCount <= limit) {
      allWords = await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY RANDOM()`
      ).all(...listIds);
    } else {
      allWords = await db.prepare(
        `SELECT * FROM words WHERE word_list_id IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`
      ).all(...listIds, limit);
    }
  }

  const mode = task.test_mode || 'en_to_zh';
  const words = allWords.map((w, i) => {
    let qType = 'en_to_zh';
    if (mode === 'zh_to_en') qType = 'zh_to_en';
    else if (mode === 'mixed') qType = i % 2 === 0 ? 'en_to_zh' : 'zh_to_en';
    return { ...w, question_type: qType };
  });
  res.json({ taskStudentId: ts.id, words, testMode: mode });
});

app.post('/api/tests/submit', authMiddleware, async (req, res) => {
  const { task_student_id, answers } = req.body;
  if (!task_student_id || !answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'student' && ts.student_id !== req.user.id) {
    return res.status(403).json({ error: '无权限' });
  }
  let correct = 0;
  const insertTr = db.prepare(
    'INSERT INTO test_records (task_student_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    const word = await db.prepare('SELECT * FROM words WHERE id = ?').get(a.word_id);
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    let isCorrect = false;
    const userAns = (a.user_answer || '').trim().toLowerCase();
    if (userAns.length === 0) {
      isCorrect = false;
    } else {
      const normUserAns = normalizeForCompare(userAns);
      if (qType === 'zh_to_en') {
        const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
        isCorrect = validWords.some(w => {
          const nw = normalizeForCompare(w);
          return nw === normUserAns || normUserAns.includes(nw) || nw.includes(normUserAns);
        });
      } else {
        const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
        const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
        isCorrect = validMeanings.some(m => {
          const nm = normalizeForCompare(m);
          return nm === normUserAns || normUserAns.includes(nm) || nm.includes(normUserAns);
        });
      }
    }
    if (isCorrect) correct++;
    await insertTr.run(task_student_id, a.word_id, a.user_answer || '', isCorrect ? 1 : 0, qType);
  }
  const score = (correct / answers.length) * 100;
  await db.prepare(
    "UPDATE task_students SET status = 'tested', test_score = ?, study_progress = 100, last_studied_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(score, task_student_id);
  res.json({ score, correct, total: answers.length });
});

app.get('/api/tasks/:id/test-result', authMiddleware, async (req, res) => {
  let ts;
  if (req.user.role === 'teacher') {
    ts = await db.prepare(
      `SELECT ts.* FROM task_students ts
       INNER JOIN tasks t ON t.id = ts.task_id
       WHERE ts.task_id = ? AND t.teacher_id = ?`
    ).get(req.params.id, req.user.id);
  } else {
    ts = await db.prepare(
      'SELECT * FROM task_students WHERE task_id = ? AND student_id = ?'
    ).get(req.params.id, req.user.id);
  }
  if (!ts) return res.status(404).json({ error: '未找到' });
  const records = await db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(ts.id);
  res.json({ score: ts.test_score, records });
});

app.put('/api/me/password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: '参数错误' });
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
    return res.status(400).json({ error: '新密码长度需在6-100之间' });
  }
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10), req.user.id
  );
  res.json({ ok: true });
});

app.put('/api/me/avatar', authMiddleware, async (req, res) => {
  const { avatar } = req.body;
  if (avatar === undefined) return res.status(400).json({ error: '参数错误' });
  await db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
  res.json({ ok: true });
});

app.get('/api/favorites', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT f.*, w.word, w.meaning, w.example, w.word_list_id, wl.name as word_list_name
     FROM favorites f
     INNER JOIN words w ON w.id = f.word_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     WHERE f.user_id = ? ORDER BY f.created_at DESC`
  ).all(req.user.id);
  res.json({ favorites: rows });
});

app.post('/api/favorites', authMiddleware, async (req, res) => {
  const { word_id } = req.body;
  if (!word_id) return res.status(400).json({ error: '参数错误' });
  await db.prepare('INSERT OR IGNORE INTO favorites (user_id, word_id) VALUES (?, ?)').run(req.user.id, word_id);
  res.json({ ok: true });
});

app.delete('/api/favorites/:wordId', authMiddleware, async (req, res) => {
  await db.prepare('DELETE FROM favorites WHERE user_id = ? AND word_id = ?').run(req.user.id, req.params.wordId);
  res.json({ ok: true });
});

app.get('/api/wrong-book', authMiddleware, async (req, res) => {
  const { sort = 'error_count' } = req.query;
  const orderBy = sort === 'recent'
    ? 'MAX(all_rec.tested_at) DESC'
    : sort === 'word'
    ? 'w.word ASC'
    : 'SUM(CASE WHEN all_rec.is_correct = 0 THEN 1 ELSE 0 END) DESC, MAX(all_rec.tested_at) DESC';
  const rows = await db.prepare(
    `SELECT w.*, wl.name as word_list_name,
       SUM(CASE WHEN all_rec.is_correct = 0 THEN 1 ELSE 0 END) as error_count,
       SUM(CASE WHEN all_rec.is_correct = 1 THEN 1 ELSE 0 END) as correct_count,
       MAX(all_rec.tested_at) as last_tested_at
     FROM (
       SELECT tr.word_id, tr.is_correct, tr.tested_at
       FROM test_records tr
       INNER JOIN task_students ts ON ts.id = tr.task_student_id
       WHERE ts.student_id = ?
       UNION ALL
       SELECT str.word_id, str.is_correct, str.created_at as tested_at
       FROM self_test_records str
       INNER JOIN self_tests st ON st.id = str.self_test_id
       WHERE st.student_id = ?
     ) all_rec
     INNER JOIN words w ON w.id = all_rec.word_id
     LEFT JOIN word_lists wl ON wl.id = w.word_list_id
     GROUP BY w.id, w.word, w.meaning, w.example, w.created_at, w.word_list_id, wl.name
     HAVING SUM(CASE WHEN all_rec.is_correct = 0 THEN 1 ELSE 0 END) > 0
     ORDER BY ${orderBy}`
  ).all(req.user.id, req.user.id);
  const fixedRows = rows.map(r => ({
    ...r,
    error_count: Number(r.error_count) || 0,
    correct_count: Number(r.correct_count) || 0,
  }));
  res.json({ wrongWords: fixedRows });
});

app.get('/api/stats/me', authMiddleware, async (req, res) => {
  const totalTasks = (await db.prepare(
    'SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ?'
  ).get(req.user.id)).cnt;
  const testedTasks = (await db.prepare(
    "SELECT COUNT(*) as cnt FROM task_students WHERE student_id = ? AND status = 'tested'"
  ).get(req.user.id)).cnt;
  const avgScore = (await db.prepare(
    'SELECT AVG(test_score) as avg FROM task_students WHERE student_id = ? AND test_score IS NOT NULL'
  ).get(req.user.id)).avg || 0;
  const studyDays = (await db.prepare(
    "SELECT COUNT(DISTINCT DATE(last_studied_at)) as cnt FROM task_students WHERE student_id = ? AND last_studied_at IS NOT NULL"
  ).get(req.user.id)).cnt;
  const totalWords = (await db.prepare(
    `SELECT COUNT(DISTINCT sr.word_id) as cnt FROM study_records sr
     INNER JOIN task_students ts ON ts.id = sr.task_student_id
     WHERE ts.student_id = ?`
  ).get(req.user.id)).cnt;
  const wrongCount = (await db.prepare(
    `SELECT COUNT(DISTINCT tr.word_id) as cnt FROM test_records tr
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     WHERE ts.student_id = ? AND tr.is_correct = 0`
  ).get(req.user.id)).cnt;
  res.json({
    totalTasks: Number(totalTasks) || 0,
    testedTasks: Number(testedTasks) || 0,
    avgScore: Math.round(Number(avgScore) || 0),
    studyDays: Number(studyDays) || 0,
    totalWords: Number(totalWords) || 0,
    wrongCount: Number(wrongCount) || 0,
  });
});

app.get('/api/study-stats', authMiddleware, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const uid = req.user.id;

  const userRow = await db.prepare(
    'SELECT rank_bonus_days, rank_bonus_words FROM users WHERE id = ?'
  ).get(uid);
  const bonusDays = Number(userRow?.rank_bonus_days) || 0;
  const bonusWords = Number(userRow?.rank_bonus_words) || 0;

  const todaySession = await db.prepare(
    'SELECT * FROM study_sessions WHERE student_id = ? AND session_date = ?'
  ).get(uid, today);

  const totalDurationRow = await db.prepare(
    'SELECT COALESCE(SUM(duration_seconds), 0) as s FROM study_sessions WHERE student_id = ?'
  ).get(uid);

  const totalWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(uid);

  const checkinRows = await db.prepare(
    'SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC'
  ).all(uid);

  let streak = 0;
  const dates = checkinRows.map(r => r.checkin_date);
  const dateSet = new Set(dates);
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const todayStr = cursor.toISOString().slice(0, 10);
  const yesterday = new Date(cursor);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (dateSet.has(todayStr) || dateSet.has(yesterdayStr)) {
    if (!dateSet.has(todayStr)) cursor.setDate(cursor.getDate() - 1);
    while (true) {
      const d = cursor.toISOString().slice(0, 10);
      if (dateSet.has(d)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else break;
    }
  }

  res.json({
    todayDuration: Number(todaySession?.duration_seconds) || 0,
    totalDuration: Number(totalDurationRow.s) || 0,
    todayWords: Number(todaySession?.words_studied) || 0,
    totalWords: Number(totalWordsRow.w) || 0,
    checkinDays: checkinRows.length,
    streakDays: streak,
    rank_bonus_days: bonusDays,
    rank_bonus_words: bonusWords,
  });
});

app.post('/api/study-sessions/track', authMiddleware, async (req, res) => {
  let { duration_seconds = 0, words_studied = 0 } = req.body;
  duration_seconds = Math.min(Math.max(Number(duration_seconds) || 0, 0), 86400);
  words_studied = Math.min(Math.max(Number(words_studied) || 0, 0), 10000);
  const today = new Date().toISOString().slice(0, 10);
  const uid = req.user.id;

  const exists = await db.prepare(
    'SELECT * FROM study_sessions WHERE student_id = ? AND session_date = ?'
  ).get(uid, today);

  if (exists) {
    await db.prepare(
      `UPDATE study_sessions SET duration_seconds = duration_seconds + ?,
        words_studied = words_studied + ? WHERE id = ?`
    ).run(duration_seconds, words_studied, exists.id);
  } else {
    await db.prepare(
      'INSERT INTO study_sessions (student_id, session_date, duration_seconds, words_studied) VALUES (?, ?, ?, ?)'
    ).run(uid, today, duration_seconds, words_studied);
  }
  res.json({ ok: true });
});

app.get('/api/leaderboard', authMiddleware, async (req, res) => {
  const nullsLast = db.isPG ? 'NULLS LAST' : '';
  const rows = await db.prepare(
    `SELECT u.id, u.username,
      COUNT(DISTINCT ts.id) as tasks,
      AVG(CASE WHEN ts.test_score IS NOT NULL THEN ts.test_score END) as avg_score,
      COUNT(DISTINCT DATE(ts.last_studied_at)) as days
     FROM users u
     LEFT JOIN task_students ts ON ts.student_id = u.id
     WHERE u.role = 'student'
     GROUP BY u.id
     ORDER BY avg_score DESC ${nullsLast}, days DESC, tasks DESC
     LIMIT 20`
  ).all();
  const fixedRows = rows.map(r => ({
    ...r,
    tasks: Number(r.tasks) || 0,
    days: Number(r.days) || 0,
    avg_score: Number(r.avg_score) || 0,
  }));
  res.json({ leaderboard: fixedRows });
});

app.post('/api/users/batch', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { users } = req.body;
  if (!users || !Array.isArray(users)) return res.status(400).json({ error: '参数错误' });
  if (users.length > 1000) return res.status(400).json({ error: '单次最多创建 1000 个用户' });
  let added = 0, skipped = 0;
  await db.transaction(async (txDb) => {
    const stmt = txDb.prepare(
      'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
    );
    for (const u of users) {
      if (!u.username || !u.password) { skipped++; continue; }
      if (typeof u.username !== 'string' || u.username.length < 2 || u.username.length > 50) { skipped++; continue; }
      if (typeof u.password !== 'string' || u.password.length < 6 || u.password.length > 100) { skipped++; continue; }
      if (u.role && !['teacher', 'student'].includes(u.role)) { skipped++; continue; }
      const exists = await txDb.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
      if (exists) { skipped++; continue; }
      await stmt.run(u.username.trim(), bcrypt.hashSync(u.password, 10), u.role || 'student');
      added++;
    }
  });
  res.json({ added, skipped });
});

app.get('/api/tasks/:id/export', authMiddleware, requireRole('teacher'), async (req, res) => {
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: '任务不存在或无权限' });
  const rows = await db.prepare(
    `SELECT u.username, ts.status, ts.study_progress, ts.test_score, ts.last_studied_at
     FROM task_students ts
     INNER JOIN users u ON u.id = ts.student_id
     WHERE ts.task_id = ?
     ORDER BY u.username`
  ).all(req.params.id);
  const csv = [
    ['用户名', '状态', '学习进度%', '测试分数', '最后学习时间'].join(','),
    ...rows.map(r => [
      r.username,
      { pending: '未开始', studying: '学习中', tested: '已测试' }[r.status] || r.status,
      r.study_progress || 0,
      r.test_score ?? '',
      r.last_studied_at || ''
    ].join(','))
  ].join('\n');
  const safeName = (task?.name || '成绩').replace(/[<>"\\\r\n\t;]/g, '').slice(0, 50);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.csv"`);
  res.send('\ufeff' + csv);
});

app.post('/api/task-students/:id/reset', authMiddleware, requireRole('teacher'), async (req, res) => {
  const ts = await db.prepare(
    `SELECT ts.* FROM task_students ts
     INNER JOIN tasks t ON t.id = ts.task_id
     WHERE ts.id = ? AND t.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!ts) return res.status(404).json({ error: '未找到或无权限' });
  await db.prepare('DELETE FROM study_records WHERE task_student_id = ?').run(ts.id);
  await db.prepare('DELETE FROM test_records WHERE task_student_id = ?').run(ts.id);
  await db.prepare(
    "UPDATE task_students SET status = 'pending', study_progress = 0, test_score = NULL, last_studied_at = NULL WHERE id = ?"
  ).run(ts.id);
  res.json({ ok: true });
});

app.get('/api/word-lists/:id/export', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '未找到' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) {
      return res.status(403).json({ error: '无权限' });
    }
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_lists wl
       LEFT JOIN word_books wb ON wb.id = wl.word_book_id
       WHERE wl.id = ? AND (
         wl.word_book_id IS NULL
         OR wl.teacher_id = ?
         OR ${IS_PUBLIC}
         OR EXISTS (
           SELECT 1 FROM tasks t
           INNER JOIN task_students ts ON ts.task_id = t.id
           WHERE t.word_list_id = wl.id AND ts.student_id = ?
         )
       )`
    ).get(req.params.id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const words = await db.prepare('SELECT word, meaning, example FROM words WHERE word_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, words });
});

app.post('/api/word-lists/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, words, word_book_id } = req.body;
  if (!name || !words || !Array.isArray(words)) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO word_lists (name, description, word_book_id, teacher_id) VALUES (?, ?, ?, ?)'
  ).run(name, description || '', word_book_id || null, req.user.id);
  const listId = info.lastInsertRowid;
  const stmt = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  let count = 0;
  const seen = new Set();
  for (const w of words) {
    if (!w.word || !w.meaning) continue;
    const key = w.word.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    count++;
    await stmt.run(listId, w.word.trim(), w.meaning.trim(), w.example || '', count);
  }
  res.json({ id: listId, imported: count, skipped: words.length - count });
});

app.post('/api/word-lists/:id/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { words } = req.body;
  if (!words || !Array.isArray(words)) return res.status(400).json({ error: '参数错误' });
  const list = await db.prepare('SELECT * FROM word_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '词表不存在或无权限' });
  const existing = await db.prepare('SELECT word FROM words WHERE word_list_id = ?').all(req.params.id);
  const existingSet = new Set(existing.map(w => w.word.trim().toLowerCase()));
  const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM words WHERE word_list_id = ?').get(req.params.id);
  let sortIdx = maxRow?.m || 0;
  const stmt = db.prepare(
    'INSERT INTO words (word_list_id, word, meaning, example, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  let count = 0;
  const seen = new Set();
  for (const w of words) {
    if (!w.word || !w.meaning) continue;
    const key = w.word.trim().toLowerCase();
    if (existingSet.has(key) || seen.has(key)) continue;
    seen.add(key);
    sortIdx++;
    count++;
    await stmt.run(req.params.id, w.word.trim(), w.meaning.trim(), w.example || '', sortIdx);
  }
  res.json({ id: req.params.id, imported: count, skipped: words.length - count });
});

app.get('/api/comments', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      `SELECT c.*, u.username as student_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.student_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.teacher_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT c.*, u.username as teacher_name, t.name as task_name
       FROM comments c
       INNER JOIN users u ON u.id = c.teacher_id
       LEFT JOIN tasks t ON t.id = c.task_id
       WHERE c.student_id = ? ORDER BY c.created_at DESC`
    ).all(req.user.id);
  }
  res.json({ comments: rows });
});

app.post('/api/comments', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { student_id, task_id, content } = req.body;
  if (!student_id || !content) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare(
    'INSERT INTO comments (teacher_id, student_id, task_id, content) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, student_id, task_id || null, content);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/comments/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  await db.prepare('DELETE FROM comments WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/settings', authMiddleware, async (req, res) => {
  let s;
  try {
    s = await db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  } catch (e) {
    console.warn('获取设置失败，使用默认值:', e.message);
    s = null;
  }
  if (!s) s = { theme: 'light', voice: 'default' };
  if (!s.voice) s.voice = 'default';
  res.json({ settings: s });
});

app.put('/api/settings', authMiddleware, async (req, res) => {
  const { theme, voice } = req.body;
  let existing;
  try {
    existing = await db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  } catch (e) { existing = null; }
  if (existing) {
    try {
      await db.prepare(
        'UPDATE settings SET theme = ?, voice = ? WHERE user_id = ?'
      ).run(theme || existing.theme || 'light', voice !== undefined ? voice : existing.voice || 'default', req.user.id);
    } catch (e) {
      await db.prepare('UPDATE settings SET theme = ? WHERE user_id = ?').run(theme || existing.theme || 'light', req.user.id);
    }
  } else {
    try {
      await db.prepare(
        `INSERT INTO settings (user_id, theme, voice) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme, voice = excluded.voice`
      ).run(req.user.id, theme || 'light', voice || 'default');
    } catch (e) {
      await db.prepare(`INSERT INTO settings (user_id, theme) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme`).run(req.user.id, theme || 'light');
    }
  }
  res.json({ ok: true });
});

app.get('/api/sentence-lists', authMiddleware, async (req, res) => {
  let rows;
  if (req.user.role === 'teacher') {
    rows = await db.prepare(
      'SELECT * FROM sentence_lists WHERE teacher_id = ? ORDER BY created_at DESC'
    ).all(req.user.id);
  } else {
    rows = await db.prepare(
      `SELECT DISTINCT sl.* FROM sentence_lists sl
       LEFT JOIN tasks t ON t.sentence_list_id = sl.id
       LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       WHERE sl.teacher_id = ? OR ts.id IS NOT NULL
       ORDER BY sl.created_at DESC`
    ).all(req.user.id, req.user.id);
  }
  res.json({ sentenceLists: rows });
});

app.post('/api/sentence-lists', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '名称必填' });
  const info = await db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description } = req.body;
  await db.prepare('UPDATE sentence_lists SET name = ?, description = ? WHERE id = ? AND teacher_id = ?').run(name, description || '', req.params.id, req.user.id);
  res.json({ ok: true });
});

app.delete('/api/sentence-lists/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!list) return res.status(404).json({ error: '句子列表不存在或无权限' });
  const hasTasks = await db.prepare('SELECT 1 FROM tasks WHERE sentence_list_id = ? LIMIT 1').get(req.params.id);
  if (hasTasks) return res.status(400).json({ error: '该句子列表有关联的任务，请先删除任务' });
  await db.prepare('DELETE FROM sentences WHERE sentence_list_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM sentence_lists WHERE id = ? AND teacher_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/sentences', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '句子列表不存在' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM sentence_lists sl
       LEFT JOIN tasks t ON t.sentence_list_id = sl.id
       LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       WHERE sl.id = ? AND (sl.teacher_id = ? OR ts.id IS NOT NULL)`
    ).get(req.user.id, req.params.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const rows = await db.prepare('SELECT * FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ sentences: rows });
});

app.post('/api/sentence-lists/:id/sentences', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary } = req.body;
  if (!sentence_en || !sentence_zh) return res.status(400).json({ error: '英文和中文都必填' });
  const info = await db.prepare(
    'INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(req.params.id, sentence_en, sentence_zh, analysis || '', vocabulary || '', grammar || '', structure || '', correction || '', summary || '');
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/sentences/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary } = req.body;
  const s = await db.prepare(
    `SELECT s.* FROM sentences s
     INNER JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE s.id = ? AND sl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: '句子不存在或无权限' });
  await db.prepare('UPDATE sentences SET sentence_en = ?, sentence_zh = ?, analysis = ?, vocabulary = ?, grammar = ?, structure = ?, correction = ?, summary = ? WHERE id = ?').run(sentence_en, sentence_zh, analysis || '', vocabulary || '', grammar || '', structure || '', correction || '', summary || '', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/sentences/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const s = await db.prepare(
    `SELECT s.* FROM sentences s
     INNER JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE s.id = ? AND sl.teacher_id = ?`
  ).get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: '句子不存在或无权限' });
  await db.prepare('DELETE FROM sentences WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/sentence-lists/:id/export', authMiddleware, async (req, res) => {
  const list = await db.prepare('SELECT * FROM sentence_lists WHERE id = ?').get(req.params.id);
  if (!list) return res.status(404).json({ error: '不存在' });
  if (req.user.role === 'teacher') {
    if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  } else {
    const canAccess = await db.prepare(
      `SELECT 1 FROM sentence_lists sl
       LEFT JOIN tasks t ON t.sentence_list_id = sl.id
       LEFT JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
       WHERE sl.id = ? AND (sl.teacher_id = ? OR ts.id IS NOT NULL)`
    ).get(req.user.id, req.params.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限' });
  }
  const sentences = await db.prepare('SELECT sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary FROM sentences WHERE sentence_list_id = ? ORDER BY id').all(req.params.id);
  res.json({ name: list.name, description: list.description, sentences });
});

app.post('/api/sentence-lists/import', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, description, sentences } = req.body;
  if (!name || !Array.isArray(sentences)) return res.status(400).json({ error: '参数错误' });
  const info = await db.prepare('INSERT INTO sentence_lists (name, description, teacher_id) VALUES (?, ?, ?)').run(name, description || '', req.user.id);
  const insert = db.prepare('INSERT INTO sentences (sentence_list_id, sentence_en, sentence_zh, analysis, vocabulary, grammar, structure, correction, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  let count = 0;
  for (const s of sentences) {
    if (s.sentence_en && s.sentence_zh) {
      await insert.run(info.lastInsertRowid, s.sentence_en, s.sentence_zh, s.analysis || '', s.vocabulary || '', s.grammar || '', s.structure || '', s.correction || '', s.summary || '');
      count++;
    }
  }
  res.json({ id: info.lastInsertRowid, imported: count });
});

app.post('/api/translation/submit', authMiddleware, async (req, res) => {
  const { sentence_id, user_translation, is_correct } = req.body;
  if (!sentence_id) return res.status(400).json({ error: '参数错误' });
  await db.prepare(
    'INSERT INTO translation_records (student_id, sentence_id, user_translation, is_correct) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, sentence_id, user_translation || '', is_correct ? 1 : 0);
  res.json({ ok: true });
});

app.get('/api/translation/records', authMiddleware, async (req, res) => {
  const rows = await db.prepare(
    `SELECT tr.*, s.sentence_en, s.sentence_zh, s.analysis, sl.name as list_name
     FROM translation_records tr
     INNER JOIN sentences s ON s.id = tr.sentence_id
     LEFT JOIN sentence_lists sl ON sl.id = s.sentence_list_id
     WHERE tr.student_id = ? ORDER BY tr.translated_at DESC LIMIT 200`
  ).all(req.user.id);
  res.json({ records: rows });
});

app.get('/api/task-students/:id/test-records', authMiddleware, requireRole('teacher'), async (req, res) => {
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(req.params.id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  if (task && task.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  const records = await db.prepare(
    `SELECT tr.*, w.word, w.meaning, w.example, u.username as student_name
     FROM test_records tr
     INNER JOIN words w ON w.id = tr.word_id
     INNER JOIN task_students ts ON ts.id = tr.task_student_id
     INNER JOIN users u ON u.id = ts.student_id
     WHERE tr.task_student_id = ? ORDER BY tr.id`
  ).all(req.params.id);
  res.json({ taskStudent: ts, records });
});

app.put('/api/test-records/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { is_correct } = req.body;
  const rec = await db.prepare('SELECT * FROM test_records WHERE id = ?').get(req.params.id);
  if (!rec) return res.status(404).json({ error: '未找到' });
  const ts = await db.prepare('SELECT * FROM task_students WHERE id = ?').get(rec.task_student_id);
  if (!ts) return res.status(404).json({ error: '未找到' });
  const task = await db.prepare('SELECT * FROM tasks WHERE id = ?').get(ts.task_id);
  if (task && task.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare('UPDATE test_records SET is_correct = ? WHERE id = ?').run(is_correct ? 1 : 0, req.params.id);
  const stats = await db.prepare(
    'SELECT COUNT(*) as total, SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct FROM test_records WHERE task_student_id = ?'
  ).get(ts.id);
  const score = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
  await db.prepare('UPDATE task_students SET test_score = ? WHERE id = ?').run(score, ts.id);
  res.json({ ok: true, score });
});

app.get('/api/checkins/status', authMiddleware, requireRole('student'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const studentId = req.user.id;

  let bonusDays = 0, bonusWords = 0;
  try {
    const userRow = await db.prepare(
      'SELECT rank_bonus_days, rank_bonus_words FROM users WHERE id = ?'
    ).get(studentId);
    bonusDays = Number(userRow?.rank_bonus_days) || 0;
    bonusWords = Number(userRow?.rank_bonus_words) || 0;
  } catch (e) {
    console.warn('获取等级奖励字段失败，使用默认值 0:', e.message);
  }

  const todayCheckin = await db.prepare(
    "SELECT * FROM checkins WHERE student_id = ? AND checkin_date = ?"
  ).get(studentId, today);

  const totalCheckins = await db.prepare(
    "SELECT COUNT(*) as cnt FROM checkins WHERE student_id = ?"
  ).get(studentId);

  let canCheckin = false;
  let checkinReason = '';
  let todayTest = null;

  const recentTasks = await db.prepare(
    `SELECT ts.*, t.name as task_name
       FROM task_students ts
       LEFT JOIN tasks t ON t.id = ts.task_id
       WHERE ts.student_id = ? AND ts.status = 'tested'
       ORDER BY ts.last_studied_at DESC LIMIT 20`
  ).all(studentId);

  const todayTaskTests = recentTasks.filter(ts => {
    if (!ts.last_studied_at) return false;
    const testDate = new Date(ts.last_studied_at).toISOString().split('T')[0];
    return testDate === today;
  });

  const recentSelfTests = await db.prepare(
    `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
       FROM self_tests st
       LEFT JOIN word_books wb ON wb.id = st.word_book_id
       LEFT JOIN word_lists wl ON wl.id = st.word_list_id
       WHERE st.student_id = ?
       ORDER BY st.created_at DESC LIMIT 20`
  ).all(studentId);

  const todaySelfTests = recentSelfTests.filter(st => {
    if (!st.created_at) return false;
    const testDate = new Date(st.created_at).toISOString().split('T')[0];
    return testDate === today;
  });

  const allTodayScores = [
    ...todayTaskTests.map(t => ({ score: t.test_score || 0, name: t.task_name || '任务测试', type: 'task' })),
    ...todaySelfTests.map(t => ({ score: t.score || 0, name: t.word_book_name || t.word_list_name || '自测', type: 'self' })),
  ];

  if (allTodayScores.length > 0) {
    const bestScore = Math.max(...allTodayScores.map(t => t.score));
    const bestTest = allTodayScores.find(t => t.score === bestScore);
    todayTest = { score: bestScore, name: bestTest.name, type: bestTest.type };
    if (bestScore >= 70) {
      canCheckin = !todayCheckin;
      checkinReason = canCheckin ? `今日最佳成绩 ${Math.round(bestScore)}%（${bestTest.name}），可以打卡！` : '今日已打卡';
    } else {
      checkinReason = `今日最高正确率仅 ${Math.round(bestScore)}%，需达到 70% 才能打卡`;
    }
  } else {
    checkinReason = '今日还没有完成测试，完成测试且正确率 ≥ 70% 即可打卡（任务测试或自测均可）';
  }

  const allCheckins = await db.prepare(
    "SELECT checkin_date FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC"
  ).all(studentId);

  const totalWordsRow = await db.prepare(
    'SELECT COALESCE(SUM(words_studied), 0) as w FROM study_sessions WHERE student_id = ?'
  ).get(studentId);
  const totalWords = Number(totalWordsRow.w) || 0;

  const streak = calcStreak(allCheckins);
  const total = totalCheckins.cnt || 0;

  const effectiveStreak = streak + bonusDays;
  const effectiveTotal = total + bonusDays;
  const effectiveWords = totalWords + bonusWords;

  const rank = getRank(effectiveStreak, effectiveWords);
  const rankByTotal = getRank(effectiveTotal, effectiveWords);
  const nextRank = getNextRank(effectiveStreak, effectiveWords);

  res.json({
    checked_in: !!todayCheckin,
    can_checkin: canCheckin,
    checkin_reason: checkinReason,
    today_test: todayTest,
    total_checkins: total,
    today_checkin: todayCheckin,
    streak: streak,
    total_words: totalWords,
    rank_bonus_days: bonusDays,
    rank_bonus_words: bonusWords,
    rank: rank,
    rank_total: rankByTotal,
    next_rank: nextRank,
  });
});

app.post('/api/checkins', authMiddleware, requireRole('student'), async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const studentId = req.user.id;

  const todayCheckin = await db.prepare(
    "SELECT * FROM checkins WHERE student_id = ? AND checkin_date = ?"
  ).get(studentId, today);

  if (todayCheckin) {
    return res.status(400).json({ error: '今日已打卡' });
  }

  const taskTests = await db.prepare(
    `SELECT ts.* FROM task_students ts
       WHERE ts.student_id = ? AND ts.status = 'tested'`
  ).all(studentId);

  const todayValidTasks = taskTests.filter(ts => {
    if (!ts.last_studied_at) return false;
    const testDate = new Date(ts.last_studied_at).toISOString().split('T')[0];
    return testDate === today && (ts.test_score || 0) >= 70;
  });

  const selfTests = await db.prepare(
    `SELECT * FROM self_tests WHERE student_id = ?`
  ).all(studentId);

  const todayValidSelf = selfTests.filter(st => {
    if (!st.created_at) return false;
    const testDate = new Date(st.created_at).toISOString().split('T')[0];
    return testDate === today && (st.score || 0) >= 70;
  });

  const allValid = [
    ...todayValidTasks.map(t => ({ id: t.id, score: t.test_score || 0, type: 'task' })),
    ...todayValidSelf.map(t => ({ id: t.id, score: t.score || 0, type: 'self' })),
  ];

  if (allValid.length === 0) {
    return res.status(400).json({ error: '今日没有符合条件的测试记录（需正确率 ≥ 70%，任务测试或自测均可）' });
  }

  const bestTest = allValid.reduce((a, b) => a.score > b.score ? a : b);

  const info = await db.prepare(
    `INSERT INTO checkins (student_id, checkin_date, task_student_id, test_score)
       VALUES (?, ?, ?, ?)`
  ).run(studentId, today, bestTest.type === 'task' ? bestTest.id : null, bestTest.score);

  res.json({ ok: true, id: info.lastInsertRowid, test_score: bestTest.score });
});

app.get('/api/checkins', authMiddleware, requireRole('student'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT * FROM checkins WHERE student_id = ? ORDER BY checkin_date DESC LIMIT 30`
  ).all(req.user.id);
  res.json({ checkins: rows });
});

app.get('/api/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM student_tags st WHERE st.tag_id = t.id) as student_count
       FROM tags t WHERE t.teacher_id = ? ORDER BY t.created_at DESC`
  ).all(req.user.id);
  res.json({ tags: rows });
});

app.post('/api/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: '请输入标签名称' });
  const info = await db.prepare(
    'INSERT INTO tags (name, color, teacher_id) VALUES (?, ?, ?)'
  ).run(name.trim(), color || '#6366f1', req.user.id);
  res.json({ id: info.lastInsertRowid, ok: true });
});

app.put('/api/tags/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { name, color } = req.body;
  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: '标签不存在' });
  if (tag.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare(
    'UPDATE tags SET name = ?, color = ? WHERE id = ?'
  ).run(name || tag.name, color || tag.color, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tags/:id', authMiddleware, requireRole('teacher'), async (req, res) => {
  const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(req.params.id);
  if (!tag) return res.status(404).json({ error: '标签不存在' });
  if (tag.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  await db.prepare('DELETE FROM student_tags WHERE tag_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/students/:id/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT t.* FROM tags t
         INNER JOIN student_tags st ON st.tag_id = t.id
         WHERE st.student_id = $1 AND t.teacher_id = $2`
      : `SELECT t.* FROM tags t
         INNER JOIN student_tags st ON st.tag_id = t.id
         WHERE st.student_id = ? AND t.teacher_id = ?`
  ).all(req.params.id, req.user.id);
  res.json({ tags: rows });
});

app.post('/api/students/:id/tags', authMiddleware, requireRole('teacher'), async (req, res) => {
  const { tag_ids } = req.body;
  const studentId = req.params.id;
  await db.prepare('DELETE FROM student_tags WHERE student_id = ?').run(studentId);
  if (tag_ids && tag_ids.length > 0) {
    const insert = db.prepare(
      isPG
        ? 'INSERT INTO student_tags (student_id, tag_id) VALUES ($1, $2)'
        : 'INSERT INTO student_tags (student_id, tag_id) VALUES (?, ?)'
    );
    for (const tagId of tag_ids) {
      const tag = await db.prepare('SELECT * FROM tags WHERE id = ?').get(tagId);
      if (tag && tag.teacher_id === req.user.id) {
        try { await insert.run(studentId, tagId); } catch (e) {}
      }
    }
  }
  res.json({ ok: true });
});

app.get('/api/tags/:id/students', authMiddleware, requireRole('teacher'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT u.* FROM users u
         INNER JOIN student_tags st ON st.student_id = u.id
         WHERE st.tag_id = $1`
      : `SELECT u.* FROM users u
         INNER JOIN student_tags st ON st.student_id = u.id
         WHERE st.tag_id = ?`
  ).all(req.params.id);
  res.json({ students: rows });
});

app.get('/api/checkins/all', authMiddleware, requireRole('teacher'), async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const rows = await db.prepare(
    isPG
      ? `SELECT c.*, u.username
         FROM checkins c
         LEFT JOIN users u ON u.id = c.student_id
         WHERE c.checkin_date = $1
         ORDER BY c.created_at DESC`
      : `SELECT c.*, u.username
         FROM checkins c
         LEFT JOIN users u ON u.id = c.student_id
         WHERE c.checkin_date = ?
         ORDER BY c.created_at DESC`
  ).all(date);
  const allStudents = await db.prepare("SELECT id, username FROM users WHERE role = 'student'").all();
  res.json({ checkins: rows, all_students: allStudents, date });
});

app.get('/api/self-tests/words', authMiddleware, requireRole('student'), async (req, res) => {
  const { word_book_id, word_list_id, count = 20, mode = 'fill_blank', lang_mode = 'mixed' } = req.query;
  let words = [];
  if (word_list_id) {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_lists wl
       LEFT JOIN word_books wb ON wb.id = wl.word_book_id
       WHERE wl.id = ? AND (
         wl.word_book_id IS NULL
         OR wl.teacher_id = ?
         OR ${IS_PUBLIC}
         OR EXISTS (
           SELECT 1 FROM tasks t
           INNER JOIN task_students ts ON ts.task_id = t.id
           WHERE t.word_list_id = wl.id AND ts.student_id = ?
         )
       )`
    ).get(word_list_id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限访问该词表' });
    words = await db.prepare('SELECT * FROM words WHERE word_list_id = ? ORDER BY RANDOM() LIMIT ?').all(word_list_id, Math.min(Number(count), 100));
  } else if (word_book_id) {
    const canAccess = await db.prepare(
      `SELECT 1 FROM word_books wb
       WHERE wb.id = ? AND (
         ${IS_PUBLIC} OR wb.teacher_id = ? OR
         EXISTS (
           SELECT 1 FROM word_lists wl2
           INNER JOIN tasks t ON t.word_list_id = wl2.id
           INNER JOIN task_students ts ON ts.task_id = t.id AND ts.student_id = ?
           WHERE wl2.word_book_id = wb.id
         )
       )`
    ).get(word_book_id, req.user.id, req.user.id);
    if (!canAccess) return res.status(403).json({ error: '无权限访问该单词书' });
    words = await db.prepare(
      `SELECT w.* FROM words w
       INNER JOIN word_lists wl ON wl.id = w.word_list_id
       WHERE wl.word_book_id = ?
       ORDER BY RANDOM() LIMIT ?`
    ).all(word_book_id, Math.min(Number(count), 100));
  }

  const allWords = await db.prepare(`
    SELECT w.* FROM words w
    INNER JOIN word_lists wl ON wl.id = w.word_list_id
    WHERE wl.id IN (
      SELECT wl2.id FROM word_lists wl2
      LEFT JOIN word_books wb ON wb.id = wl2.word_book_id
      WHERE wl2.teacher_id = ? OR ${IS_PUBLIC}
    )
    ORDER BY RANDOM() LIMIT 200
  `).all(req.user.id);

  const getLangMode = () => {
    if (lang_mode === 'en_to_zh') return 'en_to_zh';
    if (lang_mode === 'zh_to_en') return 'zh_to_en';
    return Math.random() > 0.5 ? 'en_to_zh' : 'zh_to_en';
  };

  const makeChoiceOptions = (correctWord, allWordsList, direction) => {
    const shuffled = [...allWordsList].sort(() => Math.random() - 0.5).filter(w => w.id !== correctWord.id);
    const distractors = shuffled.slice(0, 3);
    const correctOption = direction === 'en_to_zh' ? correctWord.meaning : correctWord.word;
    const options = [
      correctOption,
      ...distractors.map(w => direction === 'en_to_zh' ? w.meaning : w.word)
    ].map((text, idx) => ({ label: String.fromCharCode(65 + idx), text }));
    return options.sort(() => Math.random() - 0.5);
  };

  const makeListeningOptions = (correctWord, allWordsList) => {
    const shuffled = [...allWordsList].sort(() => Math.random() - 0.5).filter(w => w.id !== correctWord.id);
    const distractors = shuffled.slice(0, 3);
    const options = [
      { word: correctWord.word, meaning: correctWord.meaning, is_correct: true },
      ...distractors.map(w => ({ word: w.word, meaning: w.meaning, is_correct: false }))
    ].sort(() => Math.random() - 0.5);
    return options;
  };

  const questionTypes = ['fill_blank', 'choice', 'spelling', 'listening', 'mixed'];
  const validMode = questionTypes.includes(mode) ? mode : 'fill_blank';

  const questions = words.map(w => {
    let qType = validMode;
    if (qType === 'mixed') {
      const coreTypes = ['fill_blank', 'choice', 'spelling', 'listening'];
      qType = coreTypes[Math.floor(Math.random() * coreTypes.length)];
    }
    const lMode = getLangMode();
    const base = {
      word_id: w.id,
      word: w.word,
      meaning: w.meaning,
      question_type: qType,
      lang_mode: lMode,
    };

    if (qType === 'fill_blank') {
      return { ...base, question_type: lMode };
    } else if (qType === 'choice') {
      return {
        ...base,
        options: makeChoiceOptions(w, allWords, lMode),
      };
    } else if (qType === 'spelling') {
      const firstLetter = w.word.charAt(0);
      const blankHint = firstLetter + '_'.repeat(Math.max(0, w.word.length - 1));
      return {
        ...base,
        lang_mode: 'zh_to_en',
        hint: blankHint,
      };
    } else if (qType === 'listening') {
      return {
        ...base,
        lang_mode: 'en_to_zh',
        options: makeListeningOptions(w, allWords),
      };
    }
    return base;
  });
  res.json({ questions, total: questions.length });
});

app.post('/api/self-tests/submit', authMiddleware, requireRole('student'), async (req, res) => {
  const { word_book_id, word_list_id, answers } = req.body;
  if (!answers || !answers.length) return res.status(400).json({ error: '参数错误' });
  if (answers.length > 200) return res.status(400).json({ error: '单次最多 200 题' });
  let correct = 0;
  const wordIds = [...new Set(answers.map(a => a.word_id).filter(Boolean))];
  const placeholders = wordIds.map(() => '?').join(',');
  const words = await db.prepare(
    `SELECT * FROM words WHERE id IN (${placeholders})`
  ).all(...wordIds);
  const wordMap = {};
  for (const w of words) wordMap[w.id] = w;
  for (const a of answers) {
    a.is_correct = false;
    const word = wordMap[a.word_id];
    if (!word) continue;
    const qType = a.question_type || 'en_to_zh';
    const userAns = (a.user_answer || '').trim().toLowerCase();
    if (userAns.length === 0) {
      a.is_correct = false;
    } else if (qType === 'choice' || qType === 'listening') {
      const correctAns = (qType === 'listening' ? word.word : (a.lang_mode === 'zh_to_en' ? word.word : word.meaning)).trim().toLowerCase();
      a.is_correct = normalizeForCompare(userAns) === normalizeForCompare(correctAns);
    } else if (qType === 'spelling' || qType === 'zh_to_en') {
      const validWords = word.word.split(/[;,，；、\/\|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const normUserAns = normalizeForCompare(userAns);
      if (validWords.some(w => {
        const nw = normalizeForCompare(w);
        return nw === normUserAns || normUserAns.includes(nw) || nw.includes(normUserAns);
      })) a.is_correct = true;
    } else {
      const normUserAns = normalizeForCompare(userAns);
      const rawMeanings = word.meaning.split(/[;,，；、\/\|]/).map(s => s.trim()).filter(Boolean);
      const validMeanings = rawMeanings.map(cleanMeaning).filter(Boolean);
      if (validMeanings.some(m => {
        const nm = normalizeForCompare(m);
        return nm === normUserAns || normUserAns.includes(nm) || nm.includes(normUserAns);
      })) a.is_correct = true;
    }
    if (a.is_correct) correct++;
  }
  const score = (correct / answers.length) * 100;
  const info = await db.prepare(
    isPG
      ? 'INSERT INTO self_tests (student_id, word_book_id, word_list_id, total_words, correct_count, score) VALUES ($1, $2, $3, $4, $5, $6)'
      : 'INSERT INTO self_tests (student_id, word_book_id, word_list_id, total_words, correct_count, score) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, word_book_id || null, word_list_id || null, answers.length, correct, score);
  const selfTestId = info.lastInsertRowid;
  const insertRec = db.prepare(
    isPG
      ? 'INSERT INTO self_test_records (self_test_id, word_id, user_answer, is_correct, question_type) VALUES ($1, $2, $3, $4, $5)'
      : 'INSERT INTO self_test_records (self_test_id, word_id, user_answer, is_correct, question_type) VALUES (?, ?, ?, ?, ?)'
  );
  for (const a of answers) {
    await insertRec.run(selfTestId, a.word_id, a.user_answer || '', a.is_correct ? 1 : 0, a.question_type || 'en_to_zh');
  }
  res.json({ self_test_id: selfTestId, score, correct, total: answers.length, answers });
});

app.get('/api/self-tests', authMiddleware, requireRole('student'), async (req, res) => {
  const rows = await db.prepare(
    isPG
      ? `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = $1
         ORDER BY st.created_at DESC LIMIT 50`
      : `SELECT st.*, wb.name as word_book_name, wl.name as word_list_name
         FROM self_tests st
         LEFT JOIN word_books wb ON wb.id = st.word_book_id
         LEFT JOIN word_lists wl ON wl.id = st.word_list_id
         WHERE st.student_id = ?
         ORDER BY st.created_at DESC LIMIT 50`
  ).all(req.user.id);
  res.json({ self_tests: rows });
});

function loadVersionInfo() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    let buildTime = '开发模式';
    try {
      const info = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'build-info.json'), 'utf8'));
      buildTime = info.buildTime || buildTime;
    } catch (e) {}
    return {
      version: pkg.version || '1.0.0',
      buildTime,
      environment: isPG ? '生产环境' : '开发环境',
    };
  } catch (e) {
    return { version: '1.0.0', buildTime: '未知', environment: '开发环境' };
  }
}

app.get('/api/version', (req, res) => {
  res.json(loadVersionInfo());
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('未捕获错误:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: '服务器内部错误' });
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
});

const PORT = process.env.PORT || 3001;

(async () => {
  try {
    const r1 = await db.prepare(
      "UPDATE task_students SET status = 'tested', study_progress = 100 WHERE test_score IS NOT NULL AND status != 'tested'"
    ).run();
    if (r1.changes > 0) {
      console.log(`[数据修复] 修复了 ${r1.changes} 条有分数但状态不正确的记录`);
    }

    const r2 = await db.prepare(
      "UPDATE task_students SET study_progress = 100 WHERE status = 'tested' AND study_progress < 100"
    ).run();
    if (r2.changes > 0) {
      console.log(`[数据修复] 更新了 ${r2.changes} 条已测试但进度未更新的记录`);
    }

    const r3 = await db.prepare(
      "UPDATE task_students SET status = 'tested', study_progress = 100 WHERE test_score IS NOT NULL"
    ).run();
    if (r3.changes > 0) {
      console.log(`[数据修复] 共修复 ${r3.changes} 条有分数的记录状态`);
    }

    if (r1.changes === 0 && r2.changes === 0 && r3.changes === 0) {
      console.log('[数据修复] 数据状态正常，无需修复');
    }
  } catch (e) {
    console.error('[数据修复] 进度修复失败:', e.message);
  }
})();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务运行在 http://0.0.0.0:${PORT}`);
});
