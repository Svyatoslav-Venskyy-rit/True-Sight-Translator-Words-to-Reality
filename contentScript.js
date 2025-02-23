const observerConfig = {
  childList: true,
  subtree: true,
  characterData: true
};

// Check if extension context is still valid
const isExtensionValid = () => {
  try {
    return !!chrome.runtime?.id;
  } catch (error) {
    return false;
  }
};

const isValidTranslation = (text) => {
  return text && text.length > 1 && 
         !text.match(/Loading|Listen|\.\.\./);
};

const handleTranslation = async (text) => {
  if (!isValidTranslation(text) || !isExtensionValid()) return;

  try {
    // Wait for document focus with timeout
    await new Promise((resolve, reject) => {
      if (document.hasFocus()) return resolve();
      
      const focusHandler = () => {
        document.removeEventListener('focus', focusHandler);
        resolve();
      };
      
      document.addEventListener('focus', focusHandler);
      setTimeout(() => reject('Focus timeout'), 2000);
    });

    // Use permissions API for clipboard
    const { state } = await navigator.permissions.query({
      name: 'clipboard-write'
    });

    if (state === 'granted') {
      await navigator.clipboard.writeText(text);
      if (isExtensionValid()) {
        chrome.storage.local.set({ lastTranslation: text });
      }
    }
  } catch (error) {
    console.debug('Clipboard write skipped:', error);
  }
};

const findTranslationElement = () => {
  try {
    return document.querySelector('span[jsname="W297wb"].ryNqvb');
  } catch (error) {
    return null;
  }
};

const checkForTranslation = () => {
  if (!isExtensionValid()) {
    translateObserver.disconnect();
    return;
  }

  try {
    const outputElement = findTranslationElement();
    if (!outputElement) return;

    const translatedText = outputElement.textContent.trim();
    if (isValidTranslation(translatedText)) {
      handleTranslation(translatedText);
    }
  } catch (error) {
    console.debug('Translation check error:', error.message);
  }
};

const translateObserver = new MutationObserver(checkForTranslation);

const startObserving = () => {
  if (!isExtensionValid()) return;

  try {
    const targetNode = findTranslationElement() || document.body;
    translateObserver.observe(targetNode, observerConfig);
    checkForTranslation();
  } catch (error) {
    console.debug('Observation failed:', error.message);
  }
};

// Handle extension reload/update
const handleContextInvalidation = () => {
  translateObserver.disconnect();
  window.removeEventListener('focus', handleTranslation);
  document.removeEventListener('visibilitychange', checkForTranslation);
};

chrome.runtime.onMessage.addListener((message) => {
  if (message === 'extensionInvalidated') {
    handleContextInvalidation();
  }
});

// Initialize with safety checks
if (isExtensionValid()) {
  if (document.readyState === 'complete') {
    startObserving();
  } else {
    window.addEventListener('load', () => {
      if (isExtensionValid()) startObserving();
    });
  }
  
  // Add visibility change handler
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForTranslation();
    }
  });
}

// Cleanup when page unloads
window.addEventListener('unload', handleContextInvalidation);