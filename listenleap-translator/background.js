const TRANSLATION_CACHE = new Map();
const DICTIONARY_CACHE = new Map();
const REQUEST_DELAY = 300;
let lastRequestTime = 0;

async function translateText(text) {
  if (!text || text.trim().length === 0) {
    return '';
  }

  const cacheKey = text.trim();
  if (TRANSLATION_CACHE.has(cacheKey)) {
    return TRANSLATION_CACHE.get(cacheKey);
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
          TRANSLATION_CACHE.set(cacheKey, translatedText);
          return translatedText;
        }
      }
    } catch (error) {
      console.error('Translation error:', error);
      continue;
    }
  }

  return '翻译失败';
}

function getYoudaoTTSUrl(word) {
  return `http://dict.youdao.com/dictvoice?type=1&audio=${encodeURIComponent(word)}`;
}

async function lookupWord(word) {
  const cleanWord = word.trim().toLowerCase().replace(/[^a-zA-Z]/g, '');
  if (!cleanWord || cleanWord.length < 2) {
    return null;
  }

  if (DICTIONARY_CACHE.has(cleanWord)) {
    return DICTIONARY_CACHE.get(cleanWord);
  }

  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const entry = data[0];
    const youdaoTtsUrl = getYoudaoTTSUrl(cleanWord);

    // 先翻译单词本身获取简洁的中文翻译
    const wordChinese = await translateText(cleanWord);

    const result = {
      word: entry.word,
      phonetic: entry.phonetic || (entry.phonetics?.find(p => p.text)?.text) || '',
      audio: youdaoTtsUrl,
      wordChinese: wordChinese || '',
      meanings: []
    };

    for (const meaning of entry.meanings || []) {
      const partOfSpeech = meaning.partOfSpeech;
      const definitions = [];

      for (const def of meaning.definitions?.slice(0, 3) || []) {
        const defObj = {
          definition: def.definition,
          example: def.example || ''
        };

        if (def.definition) {
          defObj.chineseDefinition = await translateText(def.definition);
        }
        if (def.example) {
          defObj.chineseExample = await translateText(def.example);
        }

        definitions.push(defObj);
      }

      if (definitions.length > 0) {
        result.meanings.push({
          partOfSpeech,
          definitions
        });
      }
    }

    DICTIONARY_CACHE.set(cleanWord, result);
    return result;
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    return null;
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
    translateText(request.text).then(translation => {
      sendResponse({ translation: translation });
    });
    return true;
  }

  if (request.action === 'translateBatch') {
    Promise.all(request.texts.map(text => translateText(text)))
      .then(translations => {
        sendResponse({ translations: translations });
      });
    return true;
  }

  if (request.action === 'lookupWord') {
    lookupWord(request.word).then(result => {
      sendResponse({ result: result });
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
});
