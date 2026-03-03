(function () {
  const PROCESSED_ATTR = 'data-translation-processed';
  const TRANSLATION_ATTR = 'data-chinese-translation';
  let isEnabled = true;
  let drawerElement = null;
  let currentWord = '';
  let currentWordData = null;
  let isWordSaved = false;

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

  function createDrawer() {
    if (drawerElement) return drawerElement;

    const div = document.createElement('div');
    div.id = 'll-drawer';
    div.className = 'll-drawer';
    div.innerHTML = `
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
      <div class="ll-drawer-tabs">
        <div class="ll-drawer-tab ll-tab-active" data-tab="dict">
          <span>词</span>
          <span>典</span>
        </div>
        <div class="ll-drawer-tab" data-tab="vocab">
          <span>我</span>
          <span>的</span>
          <span>生</span>
          <span>词</span>
        </div>
        <div class="ll-drawer-about" id="ll-drawer-about">
          <i class="fas fa-info-circle"></i>
        </div>
      </div>
      <div class="ll-drawer-content">
        <div class="ll-dict-content" id="ll-dict-content">
          <div class="ll-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span>查询中...</span>
          </div>
        </div>
        <div class="ll-vocab-content" id="ll-vocab-content" style="display: none;">
          <div class="ll-vocab-list" id="ll-vocab-list"></div>
        </div>
        <div class="ll-about-content" id="ll-about-content" style="display: none;">
          <div class="ll-about-inner">
            <h3>关于 ListenLeap 翻译助手</h3>
            <p>一款为英语学习者打造的Chrome扩展插件</p>
            <div class="ll-about-section">
              <h4>使用的API服务</h4>
              <ul>
                <li><strong>词典API:</strong> Free Dictionary API (dictionaryapi.dev)</li>
                <li><strong>翻译API:</strong> Google Translate (translate.googleapis.com)</li>
                <li><strong>发音API:</strong> 有道词典 (dict.youdao.com)</li>
              </ul>
            </div>
            <div class="ll-about-section">
              <h4>感谢</h4>
              <p>感谢以下开源项目和API服务：</p>
              <ul>
                <li>Free Dictionary API - 提供免费的英语词典数据</li>
                <li>Google Translate - 提供免费翻译服务</li>
                <li>有道词典 - 提供清晰的英文发音</li>
                <li>Font Awesome - 提供优质图标</li>
              </ul>
            </div>
            <div class="ll-about-version">版本 1.0</div>
          </div>
        </div>
      </div>
      <div class="ll-drawer-close" id="ll-drawer-close">
        <i class="fas fa-times"></i>
      </div>
    `;

    document.body.appendChild(div);

    div.querySelector('#ll-drawer-close').addEventListener('click', closeDrawer);

    div.querySelectorAll('.ll-drawer-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    div.querySelector('#ll-drawer-about').addEventListener('click', () => {
      switchTab('about');
    });

    document.addEventListener('click', (e) => {
      if (drawerElement && !drawerElement.contains(e.target)) {
        const bTag = e.target.closest('.paragraph b');
        if (!bTag) {
          closeDrawer();
        }
      }
    });

    return div;
  }

  function switchTab(tabName) {
    const drawer = document.getElementById('ll-drawer');
    if (!drawer) return;

    // 确保Drawer是打开的
    drawer.classList.add('ll-drawer-open');

    drawer.querySelectorAll('.ll-drawer-tab').forEach(tab => {
      tab.classList.remove('ll-tab-active');
    });
    if (tabName !== 'about') {
      drawer.querySelector(`[data-tab="${tabName}"]`).classList.add('ll-tab-active');
    }

    // 隐藏所有内容
    drawer.querySelector('.ll-dict-content').style.display = 'none';
    drawer.querySelector('.ll-vocab-content').style.display = 'none';
    drawer.querySelector('.ll-about-content').style.display = 'none';

    if (tabName === 'dict') {
      drawer.querySelector('.ll-dict-content').style.display = 'block';
    } else if (tabName === 'vocab') {
      drawer.querySelector('.ll-vocab-content').style.display = 'block';
      loadVocabulary();
    } else if (tabName === 'about') {
      drawer.querySelector('.ll-about-content').style.display = 'block';
    }
  }

  let isPlayingAll = false;
  let playAllIndex = 0;
  let vocabData = [];

  async function loadVocabulary() {
    const listEl = document.getElementById('ll-vocab-list');
    if (!listEl) return;

    const response = await chrome.runtime.sendMessage({ action: 'getVocabulary' });
    vocabData = response.vocabulary || [];

    if (vocabData.length === 0) {
      listEl.innerHTML = '<div class="ll-vocab-empty">暂无生词</div>';
      return;
    }

    const vocabControls = `
      <div class="ll-vocab-controls" onclick="event.stopPropagation()">
        <label class="ll-vocab-chinese-label">
          <input type="checkbox" id="ll-play-chinese" onclick="event.stopPropagation()">
          <span>朗读中文</span>
        </label>
        <button class="ll-vocab-play-all" id="ll-play-all">
          <i class="fas fa-play"></i>
          <span>循环播放</span>
        </button>
      </div>
    `;

    listEl.innerHTML = vocabControls + '<div class="ll-vocab-items">' + vocabData.map((item, index) => `
      <div class="ll-vocab-item" draggable="true" data-index="${index}" data-word="${item.word}">
        <div class="ll-vocab-drag-handle">
          <i class="fas fa-grip-lines"></i>
        </div>
        <div class="ll-vocab-index">${index + 1}</div>
        <div class="ll-vocab-main">
          <div class="ll-vocab-word-row">
            <span class="ll-vocab-word">${item.word}</span>
            <span class="ll-vocab-phonetic">${item.phonetic || ''}</span>
            <i class="fas fa-volume-up ll-vocab-audio" data-audio="${item.audio || ''}" data-chinese="${item.wordChinese || item.chineseDef || ''}"></i>
          </div>
          <div class="ll-vocab-def">${item.wordChinese || item.chineseDef || ''}</div>
        </div>
        <i class="fas fa-trash-alt ll-vocab-delete" data-word="${item.word}"></i>
      </div>
    `).join('') + '</div>';

    setupVocabControls();
    setupVocabDragDrop();
  }

  function setupVocabControls() {
    // 阻止控制栏的点击事件冒泡
    const controls = document.querySelector('.ll-vocab-controls');
    if (controls) {
      controls.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    const playAllBtn = document.getElementById('ll-play-all');
    if (playAllBtn) {
      playAllBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        togglePlayAll(e);
      });
    }

    // 生词本喇叭点击事件
    const audioBtns = document.querySelectorAll('.ll-vocab-audio');
    audioBtns.forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (this.classList.contains('playing')) return;

        this.classList.add('playing');

        const audioUrl = this.dataset.audio;
        const audio = new Audio(audioUrl);

        audio.onended = () => {
          this.classList.remove('playing');
        };

        audio.onerror = () => {
          this.classList.remove('playing');
        };

        audio.play().catch(() => {
          this.classList.remove('playing');
        });
      });
    });

    // 生词本项目点击事件
    const vocabItems = document.querySelectorAll('.ll-vocab-item');
    vocabItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('ll-vocab-delete')) {
          const word = e.target.dataset.word;
          await chrome.runtime.sendMessage({ action: 'removeFromVocabulary', word: word });
          loadVocabulary();
        } else if (e.target.closest('.ll-vocab-drag-handle')) {
          // 拖动手柄，不做处理
        } else {
          const word = item.dataset.word;
          currentWord = word;
          await lookupAndShowWord(word);
        }
      });
    });
  }

  async function togglePlayAll(e) {
    if (e) e.stopPropagation();

    const playAllBtn = document.getElementById('ll-play-all');
    const chineseCheckbox = document.getElementById('ll-play-chinese');
    const playChinese = chineseCheckbox ? chineseCheckbox.checked : false;

    if (isPlayingAll) {
      isPlayingAll = false;
      playAllBtn.classList.remove('playing');
      playAllBtn.innerHTML = '<i class="fas fa-play"></i><span>循环播放</span>';
      return;
    }

    if (vocabData.length === 0) return;

    isPlayingAll = true;
    playAllBtn.classList.add('playing');
    playAllBtn.innerHTML = '<i class="fas fa-stop"></i><span>停止播放</span>';

    playAllIndex = 0;
    await playNextWord(playChinese);
  }

  async function playNextWord(playChinese) {
    if (!isPlayingAll || playAllIndex >= vocabData.length) {
      playAllIndex = 0;
      if (isPlayingAll) {
        await playNextWord(playChinese);
      }
      return;
    }

    const item = vocabData[playAllIndex];
    const currentItemEl = document.querySelector(`.ll-vocab-item[data-index="${playAllIndex}"]`);

    if (currentItemEl) {
      currentItemEl.classList.add('playing');
    }

    // 播放英文发音
    if (item.audio) {
      await new Promise((resolve) => {
        const audio = new Audio(item.audio);
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
    }

    // 播放中文发音
    if (playChinese) {
      const chineseText = item.wordChinese || item.chineseDef || '';
      if (chineseText) {
        await new Promise((resolve) => {
          const utterance = new SpeechSynthesisUtterance(chineseText);
          utterance.lang = 'zh-CN';
          utterance.rate = 0.9;
          utterance.onend = resolve;
          utterance.onerror = resolve;
          speechSynthesis.speak(utterance);
        });
      }
    }

    if (currentItemEl) {
      currentItemEl.classList.remove('playing');
    }

    playAllIndex++;

    if (isPlayingAll) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await playNextWord(playChinese);
    }
  }

  function setupVocabDragDrop() {
    const items = document.querySelectorAll('.ll-vocab-item');
    let draggedItem = null;

    items.forEach(item => {
      item.addEventListener('dragstart', function (e) {
        draggedItem = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', function () {
        this.classList.remove('dragging');
        draggedItem = null;
      });

      item.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('dragenter', function () {
        if (this !== draggedItem) {
          this.classList.add('drag-over');
        }
      });

      item.addEventListener('dragleave', function () {
        this.classList.remove('drag-over');
      });

      item.addEventListener('drop', async function (e) {
        e.preventDefault();
        this.classList.remove('drag-over');

        if (draggedItem && this !== draggedItem) {
          const fromIndex = parseInt(draggedItem.dataset.index);
          const toIndex = parseInt(this.dataset.index);

          // 交换位置
          const [movedItem] = vocabData.splice(fromIndex, 1);
          vocabData.splice(toIndex, 0, movedItem);

          // 保存新顺序
          await chrome.runtime.sendMessage({
            action: 'updateVocabularyOrder',
            vocabulary: vocabData
          });

          // 重新渲染
          loadVocabulary();
        }
      });
    });
  }

  async function lookupAndShowWord(word) {
    const contentEl = document.getElementById('ll-dict-content');
    if (!contentEl) return;

    contentEl.innerHTML = `
      <div class="ll-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>查询中...</span>
      </div>
    `;

    switchTab('dict');

    const response = await chrome.runtime.sendMessage({ action: 'lookupWord', word: word });
    const result = response.result;

    if (!result) {
      contentEl.innerHTML = `
        <div class="ll-error">
          <i class="fas fa-exclamation-circle"></i>
          <span>未找到该单词</span>
        </div>
      `;
      isWordSaved = false;
      return;
    }

    currentWordData = result;

    const checkResponse = await chrome.runtime.sendMessage({ action: 'checkInVocabulary', word: word });
    isWordSaved = checkResponse.exists;

    renderDictionaryContent(result);
  }

  function renderDictionaryContent(data) {
    const contentEl = document.getElementById('ll-dict-content');
    if (!contentEl) return;

    let meaningsHtml = '';
    data.meanings.forEach((meaning, mIdx) => {
      let defsHtml = '';
      meaning.definitions.forEach((def, idx) => {
        const defId = `def-${mIdx}-${idx}`;

        defsHtml += `
          <div class="ll-definition">
            <div class="ll-def-row">
              <span class="ll-def-num">${idx + 1}.</span>
              <span class="ll-def-pos">${meaning.partOfSpeech}</span>
              <span class="ll-def-text">${def.definition}</span>
            </div>
            <div class="ll-def-chinese" id="${defId}-chinese" style="display: none;"></div>
            ${def.example ? `
              <div class="ll-example">
                <div class="ll-example-en" id="${defId}-example">"${def.example}"</div>
                <div class="ll-example-zh" id="${defId}-example-zh" style="display: none;"></div>
              </div>
            ` : ''}
          </div>
        `;
      });
      meaningsHtml += defsHtml;
    });

    const audioBtn = data.audio ? `<i class="fas fa-volume-up ll-audio-btn" id="ll-audio-play"></i>` : '';

    contentEl.innerHTML = `
      <div class="ll-word-header">
        <div class="ll-word-main">
          <span class="ll-word">${data.word}</span>
          <i class="far fa-heart ll-save-btn ${isWordSaved ? 'll-saved' : ''}" id="ll-save-btn"></i>
        </div>
        <div class="ll-word-english" id="ll-word-english">${data.word}</div>
        <div class="ll-word-chinese" id="ll-word-chinese" style="display: none;">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <div class="ll-phonetic">
          ${data.phonetic || ''} ${audioBtn}
        </div>
      </div>
      <div class="ll-meanings">
        ${meaningsHtml}
      </div>
    `;

    loadChineseTranslation(data);

    const saveBtn = document.getElementById('ll-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (isWordSaved) {
          await chrome.runtime.sendMessage({ action: 'removeFromVocabulary', word: data.word });
          isWordSaved = false;
          saveBtn.classList.remove('ll-saved');
        } else {
          // 先翻译获取中文翻译
          const translateResponse = await chrome.runtime.sendMessage({
            action: 'translate',
            text: data.word
          });

          const wordDataWithChinese = {
            ...data,
            wordChinese: translateResponse.translation || '',
            chineseDef: translateResponse.translation || ''
          };

          await chrome.runtime.sendMessage({ action: 'addToVocabulary', wordData: wordDataWithChinese });
          isWordSaved = true;
          saveBtn.classList.add('ll-saved');
        }
      });
    }

    const audioPlayBtn = document.getElementById('ll-audio-play');
    if (audioPlayBtn && data.audio) {
      audioPlayBtn.addEventListener('click', function () {
        if (this.classList.contains('playing')) return;

        this.classList.add('playing');
        this.classList.add('fa-pulse');

        const audio = new Audio(data.audio);

        audio.onended = () => {
          this.classList.remove('playing', 'fa-pulse');
        };

        audio.onerror = () => {
          this.classList.remove('playing', 'fa-pulse');
        };

        audio.play().catch(err => {
          console.error('播放失败:', err);
          this.classList.remove('playing', 'fa-pulse');
        });
      });
    }
  }

  async function loadChineseTranslation(data) {
    // 添加延迟，让用户先看到英文内容
    await new Promise(resolve => setTimeout(resolve, 500));

    // 加载单词中文翻译
    const englishEl = document.getElementById('ll-word-english');
    const chineseEl = document.getElementById('ll-word-chinese');

    if (englishEl && chineseEl) {
      englishEl.style.display = 'none';
      chineseEl.style.display = 'block';

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'translate',
          text: data.word
        });
        if (response && response.translation && response.translation !== '翻译失败') {
          chineseEl.innerHTML = response.translation;
        } else {
          chineseEl.innerHTML = '';
        }
      } catch (error) {
        chineseEl.innerHTML = '';
      }
    }

    // 加载释义和例句的中文翻译（逐个异步加载）
    for (const meaning of data.meanings) {
      for (const def of meaning.definitions) {
        const mIdx = data.meanings.indexOf(meaning);
        const idx = meaning.definitions.indexOf(def);
        const defId = `def-${mIdx}-${idx}`;

        // 加载释义中文
        try {
          const defResponse = await chrome.runtime.sendMessage({
            action: 'translate',
            text: def.definition
          });
          if (defResponse && defResponse.translation && defResponse.translation !== '翻译失败') {
            const chineseDefEl = document.getElementById(`${defId}-chinese`);
            if (chineseDefEl) {
              chineseDefEl.textContent = defResponse.translation;
              chineseDefEl.style.display = 'block';
            }
          }
        } catch (error) { }

        // 添加延迟，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));

        // 加载例句中文
        if (def.example) {
          try {
            const exampleResponse = await chrome.runtime.sendMessage({
              action: 'translate',
              text: def.example
            });
            if (exampleResponse && exampleResponse.translation && exampleResponse.translation !== '翻译失败') {
              const exampleZhEl = document.getElementById(`${defId}-example-zh`);
              if (exampleZhEl) {
                exampleZhEl.textContent = exampleResponse.translation;
                exampleZhEl.style.display = 'block';
              }
            }
          } catch (error) { }

          // 添加延迟
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
  }

  function openDrawer() {
    if (!drawerElement) {
      drawerElement = createDrawer();
    }
    drawerElement.classList.add('ll-drawer-open');
  }

  function closeDrawer() {
    if (drawerElement) {
      drawerElement.classList.remove('ll-drawer-open');
    }
  }

  function setupWordClickListener() {
    document.addEventListener('click', async (e) => {
      const target = e.target;
      const bTag = target.closest('b');
      const paragraph = target.closest('.paragraph');

      console.log('[ListenLeap] 点击目标:', target.tagName, target.className);

      if (bTag && paragraph) {
        let word = bTag.textContent.trim();
        word = word.replace(/[^a-zA-Z]/g, '');

        console.log('[ListenLeap] 点击单词:', word);

        if (word && word.length >= 2) {
          currentWord = word;
          openDrawer();
          await lookupAndShowWord(word);
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
