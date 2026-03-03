(function () {
  const ListenLeap = window.ListenLeap || {};

  ListenLeap.Translator = {
    async translate(text) {
      if (!text || text.trim().length === 0) {
        return { translation: '', error: null };
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'translate',
          text: text
        });
        return response || { translation: '', error: 'no_response' };
      } catch (error) {
        console.error('[Translator] translate error:', error);
        return { translation: '', error: 'network_error' };
      }
    },

    async lookupWord(word, retryCount = 0) {
      const maxRetries = 2;

      if (!word || word.trim().length < 2) {
        return { result: null, error: null };
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'lookupWord',
          word: word
        });

        if (response && response.error === 'network_error' && retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.lookupWord(word, retryCount + 1);
        }

        return response || { result: null, error: 'no_response' };
      } catch (error) {
        console.error('[Translator] lookupWord error:', error);
        return { result: null, error: 'network_error' };
      }
    },

    async translateBatch(texts) {
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'translateBatch',
          texts: texts
        });
        return response.translations || [];
      } catch (error) {
        console.error('[Translator] translateBatch error:', error);
        return texts.map(() => '');
      }
    }
  };

  window.ListenLeap = ListenLeap;
})();
