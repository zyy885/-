let cachedVoices = [];
const audioCache = {};           // cacheKey -> audioUrl
const audioElCache = {};         // audioUrl -> Audio element (preloaded)
const audioFailedCache = {};
const dictCache = {};
const translationCache = {};
let currentAudio = null;

const TTS_ENGINES = {
  YOUDAO: 'youdao',
  BAIDU_STANDARD: 'baidu_standard',
  BING: 'bing',
  XFYUN: 'xfyun',
  DICTIONARY: 'dictionary',
  BROWSER: 'browser',
  GOOGLE: 'google'
};

const ACCENTS = {
  US: 'en-US',
  GB: 'en-GB'
};

const YOUDAO_VOICES = [
  { id: 'female', name: 'Lily · 美式女声', tag: '美式' },
  { id: 'male', name: 'Daniel · 美式男声', tag: '美式' },
  { id: 'female_GB', name: 'Ava · 英式女声', tag: '英式' },
  { id: 'male_GB', name: 'Oliver · 英式男声', tag: '英式' }
];

const BAIDU_STANDARD_VOICES = [
  { id: 0, name: '度小美 · 新国标女声', tag: '国标' },
  { id: 1, name: '度小宇 · 新国标男声', tag: '国标' }
];

// 微软必应神经发音：Azure Neural TTS 同款模型，最适合长篇朗诵
const BING_VOICES = [
  { id: 'en-US-AriaNeural', name: 'Aria · 美式知性女声', tag: '推荐·朗诵' },
  { id: 'en-US-JennyNeural', name: 'Jenny · 美式阳光女声', tag: '推荐·日常' },
  { id: 'en-US-GuyNeural', name: 'Guy · 美式磁性男声', tag: '推荐·朗诵' },
  { id: 'en-US-DavisNeural', name: 'Davis · 美式沉稳男声', tag: '新闻' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia · 英式优雅女声', tag: '英式' },
  { id: 'en-GB-RyanNeural', name: 'Ryan · 英式磁性男声', tag: '英式' }
];

const XFYUN_VOICES = [
  { id: 0, name: '讯飞 · 美式女声', tag: '美式' },
  { id: 1, name: '讯飞 · 美式男声', tag: '美式' },
  { id: 2, name: '讯飞 · 英式女声', tag: '英式' },
  { id: 3, name: '讯飞 · 英式男声', tag: '英式' }
];

function loadVoices() {
  if (typeof speechSynthesis !== 'undefined') {
    cachedVoices = speechSynthesis.getVoices();
    if (cachedVoices.length === 0) {
      speechSynthesis.onvoiceschanged = () => {
        cachedVoices = speechSynthesis.getVoices();
      };
    }
  }
}

loadVoices();
if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.onvoiceschanged = loadVoices;
}

function stopAll() {
  try {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  } catch (e) {}
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
}

function getEngine() {
  return localStorage.getItem('vocab_tts_engine') || TTS_ENGINES.YOUDAO;
}

function getAccent() {
  return localStorage.getItem('vocab_tts_accent') || ACCENTS.US;
}

function getRate() {
  return parseFloat(localStorage.getItem('vocab_tts_rate')) || 0.9;
}

function getVoiceId() {
  return localStorage.getItem('vocab_tts_voice') || 'default';
}

function buildYoudaoTtsUrl(text, accent, voiceId) {
  let type;
  if (voiceId === 'female_GB') type = 1;
  else if (voiceId === 'male_GB') type = 1;
  else type = accent === ACCENTS.GB ? 1 : 2;
  
  let voice;
  if (voiceId === 'female_GB' || voiceId === 'male_GB') {
    voice = voiceId;
  } else {
    voice = voiceId || (accent === ACCENTS.GB ? 'male' : 'female');
  }
  
  return `https://tts.youdao.com/tts?lang=en&img=false&audio=true&text=${encodeURIComponent(text)}&type=${type}&voice=${voice}`;
}

function buildYoudaoDictUrl(text, accent) {
  const type = accent === ACCENTS.GB ? 1 : 2;
  return `https://dict.youdao.com/dictvoice?type=${type}&audio=${encodeURIComponent(text)}`;
}

function buildBaiduStandardTtsUrl(text, accent, voiceId) {
  const per = voiceId && voiceId !== 'default' ? parseInt(voiceId) : 0;
  const lan = accent === ACCENTS.GB ? 'en-GB' : 'en-US';
  return `https://tts.baidu.com/text2audio?lan=${lan}&per=${per}&text=${encodeURIComponent(text)}&spd=${Math.round((getRate() - 0.5) * 10)}&pit=5&vol=9&form=mp3`;
}

function buildXfyunTtsUrl(text, accent, voiceId) {
  const type = voiceId && voiceId !== 'default' ? parseInt(voiceId) : (accent === ACCENTS.GB ? 2 : 0);
  return `https://tts-api.xfyun.cn/v2/tts?text=${encodeURIComponent(text)}&voice_type=${type}&speed=${getRate()}`;
}

function buildGoogleTtsUrl(text, accent) {
  const tl = accent === ACCENTS.GB ? 'en-GB' : 'en';
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text)}`;
}

/**
 * 微软必应神经发音（Edge/微软 Azure Neural TTS 同源）
 * 最适合长篇英文朗诵：抑扬顿挫自然、接近真人
 * 通过公开的 Translator Edge 接口调用，无需密钥
 */
function buildBingTtsUrl(text, accent, voiceId) {
  const rate = getRate();
  // 默认语音选择：和 accent 匹配，用户在设置中选了 voiceId 就用用户的
  let voice;
  if (voiceId && voiceId !== 'default') {
    voice = voiceId;
  } else if (accent === ACCENTS.GB) {
    voice = 'en-GB-SoniaNeural';
  } else {
    voice = 'en-US-AriaNeural'; // 默认 Aria 知性女声，最适合朗诵
  }
  const lang = voice.startsWith('en-GB') ? 'en-GB' : 'en-US';
  // 输出 mp3，语速走 standard SSML prosody rate
  const ratePct = Math.round((rate - 1) * 100);
  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${voice}'><prosody rate='${ratePct > 0 ? '+' : ''}${ratePct}%'>${text.replace(/[<>&'"]/g, ' ')}</prosody></voice></speak>`;
  return `https://speech.platform.bing.com/consume/synthesize?output=audio-24khz-48kbitrate-mono-mp3&text=${encodeURIComponent(ssml)}`;
}

async function fetchDictionaryData(word) {
  const key = word.toLowerCase();
  if (dictCache[key]) return dictCache[key];
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word), {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      dictCache[key] = { audio: null, example: null };
      return dictCache[key];
    }
    const data = await res.json();
    let audioUrl = null;
    let exampleText = null;
    if (Array.isArray(data) && data.length > 0) {
      const phonetics = data[0].phonetics || [];
      for (const p of phonetics) {
        if (p.audio && p.audio.length > 0) {
          audioUrl = p.audio;
          break;
        }
      }
      const meanings = data[0].meanings || [];
      for (const m of meanings) {
        const defs = m.definitions || [];
        for (const d of defs) {
          if (d.example && d.example.trim()) {
            exampleText = d.example;
            break;
          }
        }
        if (exampleText) break;
      }
    }
    dictCache[key] = { audio: audioUrl, example: exampleText };
    return dictCache[key];
  } catch (e) {
    dictCache[key] = { audio: null, example: null };
    return dictCache[key];
  }
}

async function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    stopAll();
    // 优先使用已预加载的 Audio 元素（已完成缓冲）
    let audio = audioElCache[url];
    if (!audio || audio.readyState < 2) {
      audio = new Audio(url);
      audioElCache[url] = audio;
    }
    currentAudio = audio;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        currentAudio = null;
      }
    };

    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = () => { cleanup(); reject(new Error('Audio load/play failed')); };

    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Audio load timeout'));
      }
    }, 8000);

    try {
      audio.currentTime = 0;
    } catch (e) {}

    const p = audio.play();
    if (p && p.then) {
      p.then(() => { clearTimeout(timeout); }).catch((e) => {
        clearTimeout(timeout); cleanup(); reject(e);
      });
    }
  });
}

/**
 * 预加载音频（不播放，仅缓冲到内存），用于点击时零延迟播放
 */
export function preloadAudioUrl(url) {
  if (!url || audioElCache[url] || audioFailedCache[url]) return;
  try {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = url;
    audioElCache[url] = audio;
    // 静默加载，不播放
    audio.load();
  } catch (e) {}
}

/**
 * 预加载指定单词的所有候选音频源（在单词列表渲染时批量调用）
 * 优先级按实际播放顺序：清脆的真人/高质量发音先预加载
 */
export function preloadWordAudio(word) {
  if (!word) return;
  const w = word.trim().toLowerCase();
  if (!w) return;
  const accent = getAccent();
  let engine = getEngine();
  const voiceId = getVoiceId();

  // 历史遗留兜底：如果用户localStorage存了BROWSER（机械音），自动切回有道
  // 用户从未手动设置过不会触发，但如果之前版本设置过BROWSER会自动修正
  if (engine === TTS_ENGINES.BROWSER && !localStorage.getItem('vocab_tts_engine_manual')) {
    try {
      localStorage.setItem('vocab_tts_engine', TTS_ENGINES.YOUDAO);
      engine = TTS_ENGINES.YOUDAO;
    } catch (e) {}
  }

  // 复用 buildWordSources：确保预加载顺序和实际播放顺序完全一致
  const sources = buildWordSources(engine, word, w, accent, voiceId);
  const candidates = sources.map(s => s.url);

  // 有道词典真人发音 dictvoice 永远优先预加载（体积小、音质最清脆、成功率最高）
  // 即使引擎不是 YOUDAO，也先预加载 dictvoice 做回退兜底
  const dictUrl = buildYoudaoDictUrl(word, accent);
  if (!candidates.includes(dictUrl)) {
    candidates.unshift(dictUrl);
  } else {
    // 把 dictUrl 提到第一位
    const idx = candidates.indexOf(dictUrl);
    if (idx > 0) {
      candidates.splice(idx, 1);
      candidates.unshift(dictUrl);
    }
  }

  // 异步、非阻塞预加载，逐个发起避免同时并发太多
  setTimeout(() => {
    candidates.forEach((url, i) => {
      setTimeout(() => preloadAudioUrl(url), i * 20);
    });
  }, 0);
}

function speakWithTTS(text, lang, rate) {
  lang = lang || 'en-US';
  rate = rate || getRate();
  try {
    if (typeof speechSynthesis === 'undefined') return false;
    stopAll();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(v => v.name === savedVoice);
      if (v) u.voice = v;
    } else {
      const preferred = cachedVoices.find(v =>
        (getAccent() === ACCENTS.GB ? v.lang.startsWith('en-GB') : v.lang.startsWith('en-US'))
      );
      if (preferred) u.voice = preferred;
    }
    speechSynthesis.speak(u);
    return true;
  } catch (e) {
    return false;
  }
}

async function tryPlaySources(sources, cacheKey) {
  for (const source of sources) {
    let url = source.url;
    // DICTIONARY 引擎：先取 API 的真人录音URL（失败就回退到dictUrl）
    if (source.needDict) {
      try {
        const word = source.word || (cacheKey ? cacheKey.split('|')[0] : '');
        if (word) {
          const dictData = await fetchDictionaryData(word);
          if (dictData && dictData.audio && !audioFailedCache[dictData.audio]) {
            url = dictData.audio;
          }
        }
      } catch (e) {}
    }
    if (!audioFailedCache[url]) {
      try {
        await playAudioUrl(url);
        if (cacheKey) audioCache[cacheKey] = url;
        return true;
      } catch (e) {
        audioFailedCache[url] = true;
      }
    }
  }
  return false;
}

export async function speak(text, lang) {
  const accent = getAccent();
  const engine = getEngine();
  const rate = getRate();
  const voiceId = getVoiceId();
  lang = lang || accent;

  const word = text.trim().toLowerCase();
  if (!word) return;

  const cacheKey = word + '|' + accent + '|' + engine + '|' + voiceId;
  const cachedUrl = audioCache[cacheKey];

  // ========== 路径 A：用户明确选了浏览器内置 ==========
  if (engine === TTS_ENGINES.BROWSER) {
    stopAll();
    speakWithTTS(text, lang, rate);
    return;
  }

  // ========== 路径 B：已缓存 + Audio 元素已缓冲好 -> 直接秒播（0延迟+高音质）==========
  if (cachedUrl && !audioFailedCache[cachedUrl]) {
    const preloadedEl = audioElCache[cachedUrl];
    if (preloadedEl && preloadedEl.readyState >= 2) {
      stopAll();
      try {
        await playAudioUrl(cachedUrl);
        return;
      } catch (e) {
        audioFailedCache[cachedUrl] = true;
        delete audioCache[cacheKey];
        // 缓存播放失败 -> 继续走在线源
      }
    } else if (cachedUrl) {
      // 有URL未完全缓冲：立即开始播放（浏览器边下边播），不阻塞后续兜底
      stopAll();
      try {
        playAudioUrl(cachedUrl);
        return;
      } catch (e) {}
    }
  }

  // ========== 路径 C：无缓存 -> 按用户选择的引擎**直接播放在线源**（音质优先，不插机械音）==========
  stopAll();
  const sources = buildWordSources(engine, text, word, accent, voiceId);

  // 先静默把所有候选源预加载起来，加速失败回退
  setTimeout(() => {
    sources.forEach(s => preloadAudioUrl(s.url));
  }, 0);

  const playedOnline = await tryPlaySources(sources, cacheKey);
  if (playedOnline) return;

  // ========== 路径 D（最后兜底）：所有在线源全部失败，才用浏览器TTS ==========
  speakWithTTS(text, lang, rate);
}

/**
 * 构建单词发音的候选音频源（按优先级：用户选的引擎在前，同类清晰源兜底）
 */
function buildWordSources(engine, text, word, accent, voiceId) {
  const sources = [];
  const dictUrl = buildYoudaoDictUrl(text, accent);
  const baiduUrl = buildBaiduStandardTtsUrl(text, accent, voiceId);
  const youdaoTts = buildYoudaoTtsUrl(text, accent, voiceId);
  const googleTts = buildGoogleTtsUrl(text, accent);
  const bingTts = buildBingTtsUrl(text, accent, voiceId);

  if (engine === TTS_ENGINES.BING) {
    // 必应神经发音最自然
    sources.push({ url: bingTts });
    sources.push({ url: googleTts });
    sources.push({ url: baiduUrl });
    sources.push({ url: dictUrl });
  } else if (engine === TTS_ENGINES.YOUDAO) {
    // 有道词典真人发音最清脆，放在第一位
    sources.push({ url: dictUrl });
    sources.push({ url: youdaoTts });
    sources.push({ url: baiduUrl });
    sources.push({ url: bingTts });
    sources.push({ url: googleTts });
  } else if (engine === TTS_ENGINES.BAIDU_STANDARD) {
    sources.push({ url: baiduUrl });
    sources.push({ url: dictUrl });
    sources.push({ url: youdaoTts });
    sources.push({ url: bingTts });
    sources.push({ url: googleTts });
  } else if (engine === TTS_ENGINES.GOOGLE) {
    sources.push({ url: googleTts });
    sources.push({ url: bingTts });
    sources.push({ url: dictUrl });
    sources.push({ url: baiduUrl });
  } else if (engine === TTS_ENGINES.DICTIONARY) {
    // DictionaryAPI真人发音先尝试（可能没有）
    // 实际播放时尝试异步取，先放 dictUrl 保证声音清晰
    sources.push({ url: dictUrl, needDict: true, word });
    sources.push({ url: bingTts });
    sources.push({ url: baiduUrl });
    sources.push({ url: youdaoTts });
  } else if (engine === TTS_ENGINES.XFYUN) {
    sources.push({ url: buildXfyunTtsUrl(text, accent, voiceId) });
    sources.push({ url: bingTts });
    sources.push({ url: dictUrl });
    sources.push({ url: baiduUrl });
  } else {
    sources.push({ url: dictUrl });
    sources.push({ url: bingTts });
    sources.push({ url: baiduUrl });
    sources.push({ url: youdaoTts });
  }
  return sources;
}

export async function speakSentence(text, lang) {
  stopAll();
  const accent = getAccent();
  const engine = getEngine();
  const rate = Math.min(getRate(), 0.85);
  const voiceId = getVoiceId();

  if (engine === TTS_ENGINES.BROWSER) {
    speakWithTTS(text, lang, rate);
    return;
  }

  try {
    const cacheKey = 'sentence|' + text.trim().toLowerCase() + '|' + accent + '|' + engine + '|' + voiceId;
    const cachedUrl = audioCache[cacheKey];
    if (cachedUrl && !audioFailedCache[cachedUrl]) {
      try {
        await playAudioUrl(cachedUrl);
        return;
      } catch (e) {
        audioFailedCache[cachedUrl] = true;
        delete audioCache[cacheKey];
      }
    }

    const sources = [];
    const bingTts = buildBingTtsUrl(text, accent, voiceId);
    const googleTts = buildGoogleTtsUrl(text, accent);
    const dictUrl = buildYoudaoDictUrl(text, accent);
    const baiduUrl = buildBaiduStandardTtsUrl(text, accent, voiceId);

    // 句子/朗诵场景：优先神经发音（必应→Google），真人清晰度反而不如神经模型的自然度
    if (engine === TTS_ENGINES.BING) {
      sources.push({ url: bingTts });
      sources.push({ url: googleTts });
      sources.push({ url: baiduUrl });
    } else if (engine === TTS_ENGINES.GOOGLE) {
      sources.push({ url: googleTts });
      sources.push({ url: bingTts });
      sources.push({ url: baiduUrl });
    } else if (engine === TTS_ENGINES.BAIDU_STANDARD) {
      sources.push({ url: baiduUrl });
      sources.push({ url: bingTts });
      sources.push({ url: googleTts });
    } else {
      // YOUDAO / DICTIONARY / XFYUN / 其他：句子时也尝试神经发音优先，朗诵体验更自然
      sources.push({ url: bingTts });
      sources.push({ url: googleTts });
      sources.push({ url: baiduUrl });
      sources.push({ url: dictUrl });
    }

    // 后台预加载全部候选源，加速回退
    setTimeout(() => {
      sources.forEach(s => preloadAudioUrl(s.url));
    }, 0);

    const success = await tryPlaySources(sources, cacheKey);
    if (success) return;

    speakWithTTS(text, lang, rate);
  } catch (e) {
    speakWithTTS(text, lang, rate);
  }
}

export async function getExampleFromDictionary(word) {
  const data = await fetchDictionaryData(word);
  return data.example;
}

export function getVoices() {
  return cachedVoices;
}

export function getEngineVoices(engine) {
  if (engine === TTS_ENGINES.YOUDAO) return YOUDAO_VOICES;
  if (engine === TTS_ENGINES.BAIDU_STANDARD) return BAIDU_STANDARD_VOICES;
  if (engine === TTS_ENGINES.BING) return BING_VOICES;
  if (engine === TTS_ENGINES.XFYUN) return XFYUN_VOICES;
  return [];
}

export function getEngines() {
  return [
    { id: TTS_ENGINES.YOUDAO, name: '✅ 有道词典发音', tag: '单词首选·清脆' },
    { id: TTS_ENGINES.BING, name: '🌟 微软必应神经发音', tag: '朗诵首选·最自然' },
    { id: TTS_ENGINES.BAIDU_STANDARD, name: '✅ 百度·新国标英语', tag: '国家标准·清晰' },
    { id: TTS_ENGINES.GOOGLE, name: 'Google 神经发音', tag: '国际主流·自然' },
    { id: TTS_ENGINES.XFYUN, name: '讯飞语音', tag: '清晰自然' },
    { id: TTS_ENGINES.DICTIONARY, name: 'DictionaryAPI 真人发音', tag: '真人录音' },
    { id: TTS_ENGINES.BROWSER, name: '浏览器内置语音（兜底）', tag: '可能为机械音' }
  ];
}

export function getAccents() {
  return [
    { id: ACCENTS.US, name: '美式英语 (en-US)' },
    { id: ACCENTS.GB, name: '英式英语 (en-GB)' }
  ];
}

export async function translateText(text, from, to) {
  const key = text.trim().toLowerCase() + '|' + from + '|' + to;
  if (translationCache[key]) return translationCache[key];
  try {
    const res = await fetch(
      'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=' + from + '|' + to
    );
    if (!res.ok) return null;
    const data = await res.json();
    const translated = data?.responseData?.translatedText || null;
    if (translated) {
      translationCache[key] = translated;
    }
    return translated;
  } catch (e) {
    return null;
  }
}

export { stopAll, TTS_ENGINES, ACCENTS };
