let cachedVoices = [];
const audioCache = {};
const dictCache = {};
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
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
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
    isPlaying = true;
    const audio = new Audio(url);
    currentAudio = audio;
    audio.onended = () => {
      isPlaying = false;
      currentAudio = null;
      resolve();
    };
    audio.onerror = (e) => {
      isPlaying = false;
      currentAudio = null;
      reject(e);
    };
    audio.play().catch(reject);
  });
}

function speakWithTTS(text, lang) {
  lang = lang || 'en-US';
  try {
    if (typeof speechSynthesis === 'undefined') return;
    stopAll();
    isPlaying = true;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.9;
    const savedVoice = localStorage.getItem('vocab_voice') || 'default';
    if (savedVoice !== 'default') {
      const v = cachedVoices.find(function(v) { return v.name === savedVoice; });
      if (v) u.voice = v;
    }
    u.onend = function() { isPlaying = false; };
    u.onerror = function() { isPlaying = false; };
    speechSynthesis.speak(u);
  } catch (e) {
    isPlaying = false;
  }
}

export async function speak(text, lang) {
  if (isPlaying) {
    stopAll();
    return;
  }
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

    const dictData = await fetchDictionaryData(word);
    if (dictData.audio) {
      audioCache[word] = dictData.audio;
      try {
        await playAudioUrl(dictData.audio);
        return;
      } catch (e) {}
    }

    speakWithTTS(text, lang);
  } catch (e) {
    speakWithTTS(text, lang);
  }
}

export async function speakSentence(text, lang) {
  if (isPlaying) {
    stopAll();
    return;
  }
  speakWithTTS(text, lang);
}

export async function getExampleFromDictionary(word) {
  const data = await fetchDictionaryData(word);
  return data.example;
}

export function getVoices() {
  return cachedVoices;
}

export { stopAll };
