document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    refreshBtn: document.getElementById('refreshBtn'),
    queryDisplay: document.getElementById('query-display'),
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    empty: document.getElementById('empty'),
    imageGrid: document.getElementById('imageGrid')
  };

  let isFetching = false;

  function resetUI() {
    elements.imageGrid.innerHTML = '';
    elements.error.hidden = true;
    elements.empty.hidden = true;
  }

  function showMessage(type, customMessage) {
    if (type === 'error') {
      elements.error.textContent = customMessage || 'Failed to load images';
      elements.error.hidden = false;
    } else if (type === 'empty') {
      elements.empty.textContent = customMessage || 'No images found. Try another word.';
      elements.empty.hidden = false;
    }
  }

  function renderImages(images) {
    elements.imageGrid.innerHTML = '';
    
    images.slice(0, 9).forEach(img => {
      const card = document.createElement('div');
      card.className = 'image-card';
      card.innerHTML = `
        <img src="${img.thumb}" alt="${img.alt}" loading="lazy">
        <div class="attribution">
          Photo by <a href="${img.profile}" target="_blank">${img.photographer}</a>
        </div>
      `;
      
      card.addEventListener('click', () => {
        chrome.tabs.create({ url: img.full });
      });
      
      elements.imageGrid.appendChild(card);
    });
  }

  async function loadImages() {
    if (isFetching) return;
    
    try {
      isFetching = true;
      resetUI();
      elements.loading.hidden = false;
      
      const { lastTranslation } = await chrome.storage.local.get('lastTranslation');
      if (!lastTranslation || lastTranslation.includes('Loading')) {
        showMessage('empty', 'Complete a translation first!');
        return;
      }

      const response = await Promise.race([
        chrome.runtime.sendMessage({
          action: 'getPexelsImages',
          query: lastTranslation
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 10000))
      ]);

      if (response?.error) {
        showMessage('error', response.error);
        return;
      }

      if (!response?.images?.length) {
        showMessage('empty');
        return;
      }

      // Updated display logic
      if (response.originalQuery && response.translatedQuery) {
        const displayText = response.originalQuery === response.translatedQuery 
          ? `Images for: ${response.originalQuery}`
          : `Translated "${response.originalQuery}" to "${response.translatedQuery}"`;
        elements.queryDisplay.textContent = displayText;
      }

      renderImages(response.images);
    } catch (error) {
      showMessage('error', error.message.includes('Timeout') 
        ? 'Request timed out. Check your connection.'
        : 'Failed to load images');
    } finally {
      isFetching = false;
      elements.loading.hidden = true;
    }
  }

  elements.refreshBtn.addEventListener('click', loadImages);
  loadImages();
});