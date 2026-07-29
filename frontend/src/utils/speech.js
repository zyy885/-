let cachedVoices = [];
const audioCache = {};
const dictCache = {};
const translationCache = {};
let currentAudio = null;
let isPlaying = false;

function loadVoices() {
  if (typeof speechSynthesis !== 'undefined') {
    cachedVoices = speechSynthesis.getVoices();
    speechSynthesis.onvoiceschanged = () => {
      cachedVoices = speechSynthesis.getVoices();
    };
  }
}

loadVoices();

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
  isPlaying = false;
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

function preloadAudio(url) {
  if (!url || audioCache[url]) return;
  audioCache[url] = url;
  const a = new Audio(url);
  a.preload = 'auto';
  a.load();
}

async function playAudioUrl(url) {
  return new Promise((resolve, reject) => {
    stopAll();
    isPlaying = true;
    const audio = new Audio(url);
    currentAudio = audio;
    const done = () => {
      isPlaying = false;
      currentAudio = null;
    };
    audio.onended = () => { done(); resolve(); };
    audio.onerror = (e) => { done(); reject(e); };
    const p = audio.play();
    if (p && p.catch) p.catch((e) => { done(); reject(e); });
  });
}

function speakWithTTS(text, lang, rate) {
  lang = lang || 'en-US';
  rate = rate || 0.9;
  try {
    if (typeof speechSynthesis === 'undefined') return;
    stopAll();
    isPlaying = true;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(function(v) { return v.name === savedVoice; });
      if (v) u.voice = v;
    }
    const done = function() { isPlaying = false; };
    u.onend = done;
    u.onerror = done;
    speechSynthesis.speak(u);
  } catch (e) {
    isPlaying = false;
  }
}

export async function speak(text, lang) {
  stopAll();
  lang = lang || 'en-US';
  try {
    const word = text.trim().toLowerCase();
    if (!word) return;

    if (audioCache[word]) {
      try {
        await playAudioUrl(audioCache[word]);
        return;
      } catch (e) {}
    }

    if (dictCache[word] && dictCache[word].audio) {
      audioCache[word] = dictCache[word].audio;
      try {
        await playAudioUrl(dictCache[word].audio);
        return;
      } catch (e) {}
    }

    speakWithTTS(text, lang);

    fetchDictionaryData(word).then(data => {
      if (data.audio) {
        audioCache[word] = data.audio;
        preloadAudio(data.audio);
      }
    });
  } catch (e) {
    speakWithTTS(text, lang);
  }
}

export async function speakSentence(text, lang) {
  stopAll();
  speakWithTTS(text, lang, 0.75);
}

export async function getExampleFromDictionary(word) {
  const data = await fetchDictionaryData(word);
  return data.example;
}

export function getVoices() {
  return cachedVoices;
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

export { stopAll };
