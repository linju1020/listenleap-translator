(function () {
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

      if (response && response.translation && response.translation !== '' && response.translation !== '翻译失败' && !response.error) {
        let translationDiv = paragraphElement.parentElement.querySelector('.chinese-translation');

        if (!translationDiv) {
          translationDiv = document.createElement('div');
          translationDiv.className = 'chinese-translation';
          paragraphElement.parentElement.appendChild(translationDiv);
        }

        translationDiv.textContent = response.translation;
        translationDiv.classList.add('ll-fade-in');
        paragraphElement.setAttribute(TRANSLATION_ATTR, response.translation);
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
  }

  function processParagraphs(paragraphs) {
    if (!isEnabled) return;

    paragraphs.forEach(paragraph => {
      if (!paragraph.hasAttribute(PROCESSED_ATTR)) {
        paragraph.setAttribute(PROCESSED_ATTR, 'true');
        translateParagraph(paragraph);
      }
    });
  }

  function processAllParagraphs() {
    const paragraphs = document.querySelectorAll('.paragraph_li .paragraph');
    processParagraphs(paragraphs);
  }

  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      const newParagraphs = [];

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList && node.classList.contains('paragraph')) {
              newParagraphs.push(node);
            } else {
              const paragraphs = node.querySelectorAll('.paragraph');
              paragraphs.forEach(p => newParagraphs.push(p));
            }
          }
        });
      });

      if (newParagraphs.length > 0) {
        processParagraphs(newParagraphs);
      }
    });

    const container = document.querySelector('.paragraph_li')?.parentElement || document.body;
    observer.observe(container, {
      childList: true,
      subtree: true
    });
  }

  function setupWordClickListener() {
    document.addEventListener('click', async (e) => {
      const target = e.target;
      const bTag = target.closest('b');
      const paragraph = target.closest('.paragraph');

      if (bTag && paragraph) {
        let word = bTag.textContent.trim();
        word = word.replace(/[^a-zA-Z]/g, '');

        if (word && word.length >= 2) {
          if (ListenLeap && ListenLeap.Drawer) {
            ListenLeap.Drawer.open();
            await ListenLeap.Drawer.lookupWord(word);
          }
        }
      }
    }, { capture: true });
  }

  function init() {
    setTimeout(() => {
      processAllParagraphs();
      setupMutationObserver();
      setupWordClickListener();
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
