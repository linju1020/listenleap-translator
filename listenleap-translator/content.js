(function () {
  const PROCESSED_ATTR = 'data-translation-processed';
  const TRANSLATION_ATTR = 'data-chinese-translation';
  const EXPORT_BUTTON_ATTR = 'data-export-btn-added';
  let isEnabled = true;

  const AUTHOR_SELECTOR = '.introduce_item.introduce_author';
  const TITLE_SELECTOR = '.introduce_title';
  const PARAGRAPH_SELECTOR = '.paragraph_li .paragraph';

  function getArticleTitle() {
    const titleEl = document.querySelector(TITLE_SELECTOR);
    return titleEl ? titleEl.textContent.trim() : 'article';
  }

  function getParagraphsData() {
    const paragraphs = document.querySelectorAll(PARAGRAPH_SELECTOR);
    const data = [];
    
    paragraphs.forEach(p => {
      const english = p.textContent.trim().replace(/\s+/g, ' ').trim();
      const parent = p.parentElement;
      const chineseEl = parent ? parent.querySelector('.chinese-translation') : null;
      const chinese = chineseEl ? chineseEl.textContent.trim() : '';
      
      if (english && english.length > 1) {
        data.push({ english, chinese });
      }
    });
    
    return data;
  }

  async function copyToClipboard() {
    const btn = document.querySelector('.ll-export-pdf-btn');
    if (btn) {
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 复制中...';
      btn.disabled = true;
    }

    try {
      const title = getArticleTitle();
      const paragraphs = getParagraphsData();
      
      if (paragraphs.length === 0) {
        const btn = document.querySelector('.ll-export-pdf-btn');
        if (btn) {
          btn.innerHTML = '<i class="fas fa-copy"></i> 一键复制';
          btn.disabled = false;
        }
        alert('未找到文章段落');
        return;
      }

      let content = title + '\n\n';
      
      for (const para of paragraphs) {
        content += para.english + '\n';
        if (para.chinese) {
          content += para.chinese + '\n';
        }
        content += '\n';
      }

      await navigator.clipboard.writeText(content);
      
      const btn = document.querySelector('.ll-export-pdf-btn');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> 已复制!';
        btn.disabled = false;
        setTimeout(() => {
          if (btn) {
            btn.innerHTML = '<i class="fas fa-copy"></i> 一键复制';
          }
        }, 2000);
      }
      
    } catch (error) {
      console.error('Copy to clipboard error:', error);
      alert('复制失败，请重试');
      
      const btn = document.querySelector('.ll-export-pdf-btn');
      if (btn) {
        btn.innerHTML = '<i class="fas fa-copy"></i> 一键复制';
        btn.disabled = false;
      }
    }
  }

  function ensureFontAwesome() {
    if (!document.querySelector('link[href*="font-awesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  function createExportButton() {
    const authorEl = document.querySelector(AUTHOR_SELECTOR);
    if (!authorEl || authorEl.hasAttribute(EXPORT_BUTTON_ATTR)) {
      return;
    }
    
    ensureFontAwesome();
    
    authorEl.setAttribute(EXPORT_BUTTON_ATTR, 'true');
    
    const btn = document.createElement('button');
    btn.className = 'll-export-pdf-btn';
    btn.innerHTML = '<i class="fas fa-copy"></i> 一键复制';
    btn.addEventListener('click', copyToClipboard);
    
    authorEl.parentElement.insertBefore(btn, authorEl.nextSibling);
  }

  function initExportFeature() {
    createExportButton();
    
    const observer = new MutationObserver(() => {
      createExportButton();
    });
    
    const container = document.querySelector('.paragraph_li')?.parentElement || document.body;
    observer.observe(container, {
      childList: true,
      subtree: true
    });
  }

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
      initExportFeature();
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
