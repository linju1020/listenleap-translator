const TRANSLATION_CACHE = new Map();
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
      
      if (data && data[0] && Array.isArray(data[0])) {
        let translatedText = '';
        for (const item of data[0]) {
          if (item[0]) {
            translatedText += item[0];
          }
        }
        
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
});
