(function () {
  const ListenLeap = window.ListenLeap || {};

  let drawerElement = null;
  let currentWord = '';
  let currentWordData = null;
  let isWordSaved = false;

  ListenLeap.Drawer = {
    getElement() {
      return drawerElement;
    },

    getCurrentWord() {
      return currentWord;
    },

    getCurrentWordData() {
      return currentWordData;
    },

    setWordSaved(saved) {
      isWordSaved = saved;
    },

    isWordSaved() {
      return isWordSaved;
    },

    open() {
      if (!drawerElement) {
        drawerElement = ListenLeap.Drawer.create();
      }
      drawerElement.classList.add('ll-drawer-open');
    },

    close() {
      if (drawerElement) {
        drawerElement.classList.remove('ll-drawer-open');
      }
    },

    switchTab(tabName) {
      const drawer = document.getElementById('ll-drawer');
      if (!drawer) return;

      if (ListenLeap.VocabManager) {
        ListenLeap.VocabManager.stopPlayAll();
      }

      drawer.classList.add('ll-drawer-open');

      drawer.querySelectorAll('.ll-drawer-tab').forEach(tab => {
        tab.classList.remove('ll-tab-active');
      });
      if (tabName !== 'about') {
        drawer.querySelector(`[data-tab="${tabName}"]`)?.classList.add('ll-tab-active');
      }

      drawer.querySelector('.ll-dict-content').style.display = 'none';
      drawer.querySelector('.ll-vocab-content').style.display = 'none';
      drawer.querySelector('.ll-about-content').style.display = 'none';

      if (tabName === 'dict') {
        drawer.querySelector('.ll-dict-content').style.display = 'block';
      } else if (tabName === 'vocab') {
        drawer.querySelector('.ll-vocab-content').style.display = 'block';
        if (ListenLeap.VocabManager) {
          ListenLeap.VocabManager.load();
        }
      } else if (tabName === 'about') {
        drawer.querySelector('.ll-about-content').style.display = 'block';
      }
    },

    create() {
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

      div.querySelector('#ll-drawer-close').addEventListener('click', () => ListenLeap.Drawer.close());

      div.querySelectorAll('.ll-drawer-tab').forEach(tab => {
        tab.addEventListener('click', () => ListenLeap.Drawer.switchTab(tab.dataset.tab));
      });

      div.querySelector('#ll-drawer-about').addEventListener('click', () => {
        ListenLeap.Drawer.switchTab('about');
      });

      document.addEventListener('click', (e) => {
        if (ListenLeap.VocabManager) {
          const backgroundPlayEnabled = localStorage.getItem('ll_background_play') === 'true';
          if (!backgroundPlayEnabled) {
            ListenLeap.VocabManager.stopPlayAll();
          }
        }

        if (drawerElement && !drawerElement.contains(e.target)) {
          const bTag = e.target.closest('.paragraph b');
          if (!bTag) {
            ListenLeap.Drawer.close();
          }
        }
      });

      drawerElement = div;
      return div;
    },

    async lookupWord(word, retryCount = 0) {
      const contentEl = document.getElementById('ll-dict-content');
      if (!contentEl) return;

      const maxRetries = 2;

      contentEl.innerHTML = `
        <div class="ll-loading">
          <i class="fas fa-spinner fa-spin"></i>
          <span>查询中...</span>
        </div>
      `;

      ListenLeap.Drawer.switchTab('dict');

      let response;
      try {
        response = await chrome.runtime.sendMessage({ action: 'lookupWord', word: word });
      } catch (e) {
        console.error('lookupWord error:', e);
        response = { result: null, error: 'network_error' };
      }

      if (response && response.error === 'network_error' && retryCount < maxRetries) {
        setTimeout(() => ListenLeap.Drawer.lookupWord(word, retryCount + 1), 1000);
        return;
      }

      if (!response || !response.result) {
        const isNetworkError = response && response.error === 'network_error';
        contentEl.innerHTML = `
          <div class="ll-error">
            <i class="fas fa-${isNetworkError ? 'wifi' : 'exclamation-circle'}"></i>
            <span>${isNetworkError ? '网络连接失败' : '未找到该单词'}</span>
            ${isNetworkError ? `<button class="ll-retry-btn" data-retry-word="${word}">重新查询</button>` : ''}
          </div>
        `;

        if (isNetworkError) {
          const retryBtn = contentEl.querySelector('.ll-retry-btn');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => ListenLeap.Drawer.lookupWord(retryBtn.dataset.retryWord));
          }
        }
        isWordSaved = false;
        return;
      }

      currentWordData = response.result;
      currentWord = word;

      try {
        const checkResponse = await chrome.runtime.sendMessage({ action: 'checkInVocabulary', word: word });
        isWordSaved = checkResponse.exists;
      } catch (e) {
        isWordSaved = false;
      }

      ListenLeap.Drawer.renderContent(response.result);
    },

    renderContent(data) {
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

      ListenLeap.Drawer.loadChineseTranslation(data);

      const saveBtn = document.getElementById('ll-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          if (isWordSaved) {
            await chrome.runtime.sendMessage({ action: 'removeFromVocabulary', word: data.word });
            isWordSaved = false;
            saveBtn.classList.remove('ll-saved');
          } else {
            const translateResponse = await chrome.runtime.sendMessage({
              action: 'translate',
              text: data.word
            });

            const wordDataWithChinese = {
              ...data,
              wordChinese: (translateResponse.translation && !translateResponse.error) ? translateResponse.translation : '',
              chineseDef: (translateResponse.translation && !translateResponse.error) ? translateResponse.translation : ''
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
    },

    async loadChineseTranslation(data, retryCount = 0) {
      const maxRetries = 2;
      await new Promise(resolve => setTimeout(resolve, 500));

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

          if (response && response.translation && response.translation !== '' && !response.error) {
            chineseEl.innerHTML = response.translation;
            chineseEl.classList.add('ll-fade-in');
          } else if (response && response.error === 'network_error' && retryCount < maxRetries) {
            setTimeout(() => ListenLeap.Drawer.loadChineseTranslation(data, retryCount + 1), 1000);
          } else {
            chineseEl.innerHTML = '';
          }
        } catch (error) {
          chineseEl.innerHTML = '';
        }
      }

      for (const meaning of data.meanings) {
        for (const def of meaning.definitions) {
          const mIdx = data.meanings.indexOf(meaning);
          const idx = meaning.definitions.indexOf(def);
          const defId = `def-${mIdx}-${idx}`;

          try {
            const defResponse = await chrome.runtime.sendMessage({
              action: 'translate',
              text: def.definition
            });
            if (defResponse && defResponse.translation && defResponse.translation !== '' && !defResponse.error) {
              const chineseDefEl = document.getElementById(`${defId}-chinese`);
              if (chineseDefEl) {
                chineseDefEl.textContent = defResponse.translation;
                chineseDefEl.style.display = 'block';
                chineseDefEl.classList.add('ll-fade-in');
              }
            }
          } catch (error) { }

          await new Promise(resolve => setTimeout(resolve, 300));

          if (def.example) {
            try {
              const exampleResponse = await chrome.runtime.sendMessage({
                action: 'translate',
                text: def.example
              });
              if (exampleResponse && exampleResponse.translation && exampleResponse.translation !== '' && !exampleResponse.error) {
                const exampleZhEl = document.getElementById(`${defId}-example-zh`);
                if (exampleZhEl) {
                  exampleZhEl.textContent = exampleResponse.translation;
                  exampleZhEl.style.display = 'block';
                  exampleZhEl.classList.add('ll-fade-in');
                }
              }
            } catch (error) { }

            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }
      }
    }
  };

  window.ListenLeap = ListenLeap;
})();
