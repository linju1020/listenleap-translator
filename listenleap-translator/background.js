const TRANSLATION_CACHE_KEY = 'translationCache';
const DICTIONARY_CACHE_KEY = 'dictionaryCache';
const REQUEST_DELAY = 300;
let lastRequestTime = 0;
let translationCache = {};
let dictionaryCache = {};
let cacheLoaded = false;

function loadCaches() {
  return new Promise((resolve) => {
    if (cacheLoaded) {
      resolve();
      return;
    }
    chrome.storage.local.get([TRANSLATION_CACHE_KEY, DICTIONARY_CACHE_KEY], (result) => {
      translationCache = result[TRANSLATION_CACHE_KEY] || {};
      dictionaryCache = result[DICTIONARY_CACHE_KEY] || {};
      cacheLoaded = true;
      console.log('[ListenLeap] 缓存已加载:', Object.keys(translationCache).length, '翻译,', Object.keys(dictionaryCache).length, '词典');
      resolve();
    });
  });
}

function saveTranslationCache(key, value) {
  translationCache[key] = value;
  chrome.storage.local.set({ [TRANSLATION_CACHE_KEY]: translationCache });
}

function saveDictionaryCache(key, value) {
  dictionaryCache[key] = value;
  chrome.storage.local.set({ [DICTIONARY_CACHE_KEY]: dictionaryCache });
}

chrome.runtime.onInstalled.addListener(() => {
  loadCaches();
});

chrome.runtime.onStartup.addListener(() => {
  loadCaches();
});

async function translateText(text) {
  if (!text || text.trim().length === 0) {
    return { translation: '', error: null };
  }

  if (!cacheLoaded) {
    await loadCaches();
  }

  const cacheKey = text.trim();
  if (translationCache.hasOwnProperty(cacheKey)) {
    return { translation: translationCache[cacheKey], fromCache: true, error: null };
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const encodedText = encodeURIComponent(text);

  const endpoints = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodedText}`,
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=zh-CN&q=${encodedText}`
  ];

  for (const url of endpoints) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      if (data && data[0] && data[0][0] && data[0][0][0]) {
        const translatedText = data[0][0][0];

        if (translatedText) {
          saveTranslationCache(cacheKey, translatedText);
          return { translation: translatedText, fromCache: false, error: null };
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      continue;
    }
  }

  return { translation: '', error: 'translation_failed' };
}

function getYoudaoTTSUrl(word) {
  return `http://dict.youdao.com/dictvoice?type=1&audio=${encodeURIComponent(word)}`;
}

function getGoogleTTSUrl(text, lang = 'en') {
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encodeURIComponent(text)}`;
}

async function lookupWord(word) {
  const cleanWord = word.trim().toLowerCase().replace(/[^a-zA-Z]/g, '');
  if (!cleanWord || cleanWord.length < 2) {
    return { result: null, error: null };
  }

  if (!cacheLoaded) {
    await loadCaches();
  }

  if (dictionaryCache.hasOwnProperty(cleanWord)) {
    return { result: dictionaryCache[cleanWord], fromCache: true, error: null };
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return { result: null, error: 'word_not_found' };
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { result: null, error: 'word_not_found' };
    }

    const entry = data[0];
    const youdaoTtsUrl = getYoudaoTTSUrl(cleanWord);

    const result = {
      word: entry.word,
      phonetic: entry.phonetic || (entry.phonetics?.find(p => p.text)?.text) || '',
      audio: youdaoTtsUrl,
      meanings: []
    };

    for (const meaning of entry.meanings || []) {
      const partOfSpeech = meaning.partOfSpeech;
      const definitions = meaning.definitions?.slice(0, 3).map(def => ({
        definition: def.definition,
        example: def.example || ''
      })) || [];

      if (definitions.length > 0) {
        result.meanings.push({
          partOfSpeech,
          definitions
        });
      }
    }

    saveDictionaryCache(cleanWord, result);
    return { result: result, fromCache: false, error: null };
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    return { result: null, error: 'network_error' };
  }
}

function getVocabulary() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['vocabulary'], (result) => {
      resolve(result.vocabulary || []);
    });
  });
}

function addToVocabulary(wordData) {
  return new Promise((resolve) => {
    getVocabulary().then(vocab => {
      const exists = vocab.some(item => item.word.toLowerCase() === wordData.word.toLowerCase());
      if (exists) {
        resolve({ success: false, message: '单词已存在' });
        return;
      }

      const entry = {
        word: wordData.word,
        wordChinese: wordData.wordChinese || '',
        phonetic: wordData.phonetic || '',
        partOfSpeech: wordData.meanings?.[0]?.partOfSpeech || '',
        definition: wordData.meanings?.[0]?.definitions?.[0]?.definition || '',
        chineseDef: wordData.meanings?.[0]?.definitions?.[0]?.chineseDefinition || '',
        example: wordData.meanings?.[0]?.definitions?.[0]?.example || '',
        audio: wordData.audio || '',
        dateAdded: new Date().toISOString()
      };

      vocab.unshift(entry);
      chrome.storage.local.set({ vocabulary: vocab }, () => {
        resolve({ success: true, message: '添加成功' });
      });
    });
  });
}

function removeFromVocabulary(word) {
  return new Promise((resolve) => {
    getVocabulary().then(vocab => {
      const filtered = vocab.filter(item => item.word.toLowerCase() !== word.toLowerCase());
      chrome.storage.local.set({ vocabulary: filtered }, () => {
        resolve({ success: true });
      });
    });
  });
}

function isWordInVocabulary(word) {
  return new Promise((resolve) => {
    getVocabulary().then(vocab => {
      const exists = vocab.some(item => item.word.toLowerCase() === word.toLowerCase());
      resolve(exists);
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateText(request.text).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'translateBatch') {
    Promise.all(request.texts.map(text => translateText(text)))
      .then(results => {
        const translations = results.map(r => r.translation);
        sendResponse({ translations: translations });
      });
    return true;
  }

  if (request.action === 'lookupWord') {
    lookupWord(request.word).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'getVocabulary') {
    getVocabulary().then(vocab => {
      sendResponse({ vocabulary: vocab });
    });
    return true;
  }

  if (request.action === 'addToVocabulary') {
    addToVocabulary(request.wordData).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'removeFromVocabulary') {
    removeFromVocabulary(request.word).then(result => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'checkInVocabulary') {
    isWordInVocabulary(request.word).then(exists => {
      sendResponse({ exists: exists });
    });
    return true;
  }

  if (request.action === 'updateVocabularyOrder') {
    chrome.storage.local.set({ vocabulary: request.vocabulary }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
