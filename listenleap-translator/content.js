(function() {
  const PROCESSED_ATTR = 'data-translation-processed';
  const TRANSLATION_ATTR = 'data-chinese-translation';
  let isEnabled = true;

  async function translateParagraph(paragraphElement) {
    if (!isEnabled) return;
    
    const bTags = paragraphElement.querySelectorAll('b');
    if (bTags.length === 0) return;

    const text = Array.from(bTags).map(b => b.textContent.trim()).join(' ').replace(/\s+/g, ' ').trim();
    
    if (!text || text.length < 2) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: text
      });

      if (response && response.translation && response.translation !== '翻译失败') {
        let translationDiv = paragraphElement.parentElement.querySelector('.chinese-translation');
        
        if (!translationDiv) {
          translationDiv = document.createElement('div');
          translationDiv.className = 'chinese-translation';
          paragraphElement.parentElement.appendChild(translationDiv);
        }
        
        translationDiv.textContent = response.translation;
        paragraphElement.setAttribute(TRANSLATION_ATTR, response.translation);
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
  }

  function processAllParagraphs() {
    if (!isEnabled) return;

    const paragraphs = document.querySelectorAll('.paragraph_li .paragraph');
    
    paragraphs.forEach(paragraph => {
      if (!paragraph.hasAttribute(PROCESSED_ATTR)) {
        paragraph.setAttribute(PROCESSED_ATTR, 'true');
        translateParagraph(paragraph);
      }
    });
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      
      mutations.forEach(mutation => {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
        }
      });

      if (shouldProcess) {
        processAllParagraphs();
      }
    });

    const container = document.querySelector('.paragraph_li')?.parentElement || document.body;
    observer.observe(container, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    setTimeout(() => {
      processAllParagraphs();
      setupMutationObserver();
    }, 1000);
  }

  chrome.storage.local.get(['translationEnabled'], (result) => {
    isEnabled = result.translationEnabled !== false;
    
    if (isEnabled) {
      init();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (changes.translationEnabled) {
      isEnabled = changes.translationEnabled.newValue;
      
      if (isEnabled) {
        init();
      } else {
        const translations = document.querySelectorAll('.chinese-translation');
        translations.forEach(el => el.remove());
      }
    }
  });
})();
