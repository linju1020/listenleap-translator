(function () {
  const ListenLeap = window.ListenLeap || {};

  let isPlayingAll = false;
  let playAllIndex = 0;
  let playCount = 0;
  const MAX_PLAY_COUNT = 50;
  let vocabData = [];

  ListenLeap.VocabManager = {
    async load() {
      const listEl = document.getElementById('ll-vocab-list');
      if (!listEl) return;

      try {
        const response = await chrome.runtime.sendMessage({ action: 'getVocabulary' });
        vocabData = response.vocabulary || [];
      } catch (e) {
        vocabData = [];
      }

      if (vocabData.length === 0) {
        listEl.innerHTML = '<div class="ll-vocab-empty">暂无生词</div>';
        return;
      }

      const backgroundPlayEnabled = localStorage.getItem('ll_background_play') === 'true';

      const vocabControls = `
        <div class="ll-vocab-controls" onclick="event.stopPropagation()">
          <label class="ll-vocab-chinese-label">
            <input type="checkbox" id="ll-play-chinese" onclick="event.stopPropagation()">
            <span>朗读中文</span>
          </label>
          <label class="ll-vocab-chinese-label">
            <input type="checkbox" id="ll-background-play" ${backgroundPlayEnabled ? 'checked' : ''} onclick="event.stopPropagation()">
            <span>后台播放</span>
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

      ListenLeap.VocabManager.setupControls();
      ListenLeap.VocabManager.setupDragDrop();
    },

    setupControls() {
      const controls = document.querySelector('.ll-vocab-controls');
      if (controls) {
        controls.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      }

      const backgroundPlayCheckbox = document.getElementById('ll-background-play');
      if (backgroundPlayCheckbox) {
        backgroundPlayCheckbox.addEventListener('change', function () {
          localStorage.setItem('ll_background_play', this.checked ? 'true' : 'false');
        });
      }

      const playAllBtn = document.getElementById('ll-play-all');
      if (playAllBtn) {
        playAllBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          ListenLeap.VocabManager.togglePlayAll();
        });
      }

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

      const vocabItems = document.querySelectorAll('.ll-vocab-item');
      vocabItems.forEach(item => {
        item.addEventListener('click', async (e) => {
          if (e.target.classList.contains('ll-vocab-delete')) {
            const word = e.target.dataset.word;
            await chrome.runtime.sendMessage({ action: 'removeFromVocabulary', word: word });
            ListenLeap.VocabManager.load();
          } else if (e.target.closest('.ll-vocab-drag-handle')) {
          } else {
            const word = item.dataset.word;
            if (ListenLeap.Drawer) {
              ListenLeap.Drawer.lookupWord(word);
            }
          }
        });
      });
    },

    setupDragDrop() {
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

            const [movedItem] = vocabData.splice(fromIndex, 1);
            vocabData.splice(toIndex, 0, movedItem);

            await chrome.runtime.sendMessage({
              action: 'updateVocabularyOrder',
              vocabulary: vocabData
            });

            ListenLeap.VocabManager.load();
          }
        });
      });
    },

    stopPlayAll() {
      if (isPlayingAll) {
        isPlayingAll = false;
        playCount = 0;
        const playAllBtn = document.getElementById('ll-play-all');
        if (playAllBtn) {
          playAllBtn.classList.remove('playing');
          playAllBtn.innerHTML = '<i class="fas fa-play"></i><span>循环播放</span>';
        }
      }
    },

    async togglePlayAll() {
      const playAllBtn = document.getElementById('ll-play-all');
      const chineseCheckbox = document.getElementById('ll-play-chinese');
      const playChinese = chineseCheckbox ? chineseCheckbox.checked : false;

      if (isPlayingAll) {
        ListenLeap.VocabManager.stopPlayAll();
        return;
      }

      if (vocabData.length === 0) return;

      isPlayingAll = true;
      playCount = 0;
      playAllBtn.classList.add('playing');
      playAllBtn.innerHTML = '<i class="fas fa-stop"></i><span>停止播放</span>';

      playAllIndex = 0;
      await ListenLeap.VocabManager.playNextWord(playChinese);
    },

    async playNextWord(playChinese) {
      if (playCount >= MAX_PLAY_COUNT) {
        ListenLeap.VocabManager.stopPlayAll();
        return;
      }

      if (!isPlayingAll || playAllIndex >= vocabData.length) {
        playCount++;
        playAllIndex = 0;
        if (isPlayingAll) {
          await ListenLeap.VocabManager.playNextWord(playChinese);
        }
        return;
      }

      const item = vocabData[playAllIndex];
      const currentItemEl = document.querySelector(`.ll-vocab-item[data-index="${playAllIndex}"]`);

      if (currentItemEl) {
        currentItemEl.classList.add('playing');
      }

      if (item.audio) {
        await new Promise((resolve) => {
          const audio = new Audio(item.audio);
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
      }

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
        await ListenLeap.VocabManager.playNextWord(playChinese);
      }
    }
  };

  window.ListenLeap = ListenLeap;
})();
