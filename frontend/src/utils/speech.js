let cachedVoices = [];
const audioCache = {};
const audioFailedCache = {};
const dictCache = {};
const translationCache = {};
let currentAudio = null;

const TTS_ENGINES = {
  GOOGLE: 'google',
  YOUDAO: 'youdao',
  DICTIONARY: 'dictionary',
  BROWSER: 'browser'
};

const ACCENTS = {
  US: 'en-US',
  GB: 'en-GB'
};

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
  return localStorage.getItem('vocab_tts_engine') || TTS_ENGINES.GOOGLE;
}

function getAccent() {
  return localStorage.getItem('vocab_tts_accent') || ACCENTS.US;
}

function getRate() {
  return parseFloat(localStorage.getItem('vocab_tts_rate')) || 0.9;
}

function buildGoogleTtsUrl(text, accent) {
  const tl = accent === ACCENTS.GB ? 'en-GB' : 'en';
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text)}`;
}

function buildYoudaoTtsUrl(text, accent) {
  const type = accent === ACCENTS.GB ? 1 : 2;
  return `https://dict.youdao.com/dictvoice?type=${type}&audio=${encodeURIComponent(text)}`;
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
    const audio = new Audio(url);
    currentAudio = audio;
    let resolved = false;

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        currentAudio = null;
      }
    };

    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = (e) => { cleanup(); reject(new Error('Audio load/play failed: ' + url)); };

    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('Audio load timeout'));
      }
    }, 5000);

    const p = audio.play();
    if (p && p.then) {
      p.then(() => {
        clearTimeout(timeout);
      }).catch((e) => {
        clearTimeout(timeout);
        cleanup();
        reject(e);
      });
    }
  });
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
      const v = cachedVoices.find(function(v) { return v.name === savedVoice; });
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

async function tryPlaySource(url) {
  if (!url || audioFailedCache[url]) return false;
  try {
    await playAudioUrl(url);
    return true;
  } catch (e) {
    audioFailedCache[url] = true;
    return false;
  }
}

export async function speak(text, lang) {
  stopAll();
  const accent = getAccent();
  const engine = getEngine();
  const rate = getRate();
  lang = lang || accent;

  try {
    const word = text.trim().toLowerCase();
    if (!word) return;

    const cacheKey = word + '|' + accent + '|' + engine;
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

    if (engine === TTS_ENGINES.GOOGLE) {
      sources.push({
        url: buildGoogleTtsUrl(text, accent),
        cacheKey: cacheKey
      });
    } else if (engine === TTS_ENGINES.YOUDAO) {
      sources.push({
        url: buildYoudaoTtsUrl(text, accent),
        cacheKey: cacheKey
      });
    } else if (engine === TTS_ENGINES.DICTIONARY) {
      const dictData = await fetchDictionaryData(word);
      if (dictData.audio) {
        sources.push({ url: dictData.audio, cacheKey: cacheKey });
      }
    }

    sources.push({
      url: buildGoogleTtsUrl(text, accent),
      cacheKey: cacheKey + '|google'
    });
    sources.push({
      url: buildYoudaoTtsUrl(text, accent),
      cacheKey: cacheKey + '|youdao'
    });

    const dictData = await fetchDictionaryData(word);
    if (dictData.audio) {
      sources.push({ url: dictData.audio, cacheKey: cacheKey + '|dict' });
    }

    for (const source of sources) {
      if (!audioFailedCache[source.url]) {
        try {
          await playAudioUrl(source.url);
          audioCache[cacheKey] = source.url;
          return;
        } catch (e) {
          audioFailedCache[source.url] = true;
        }
      }
    }

    speakWithTTS(text, lang, rate);

  } catch (e) {
    speakWithTTS(text, lang, rate);
  }
}

export async function speakSentence(text, lang) {
  stopAll();
  const accent = getAccent();
  const engine = getEngine();
  const rate = Math.min(getRate(), 0.8);

  try {
    const cacheKey = 'sentence|' + text.trim().toLowerCase() + '|' + accent + '|' + engine;
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
    if (engine === TTS_ENGINES.GOOGLE || engine === TTS_ENGINES.DICTIONARY) {
      sources.push({ url: buildGoogleTtsUrl(text, accent), cacheKey });
    }
    sources.push({ url: buildYoudaoTtsUrl(text, accent), cacheKey });

    for (const source of sources) {
      if (!audioFailedCache[source.url]) {
        try {
          await playAudioUrl(source.url);
          audioCache[cacheKey] = source.url;
          return;
        } catch (e) {
          audioFailedCache[source.url] = true;
        }
      }
    }

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

export function getEngines() {
  return [
    { id: TTS_ENGINES.GOOGLE, name: 'Google 神经发音 (推荐)' },
    { id: TTS_ENGINES.YOUDAO, name: '有道词典发音' },
    { id: TTS_ENGINES.DICTIONARY, name: 'DictionaryAPI 真人发音' },
    { id: TTS_ENGINES.BROWSER, name: '浏览器内置发音' }
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
