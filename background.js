const RATE_LIMIT = 1000;
let lastRequestTime = 0;

// History tracking variables
let imageHistory = [];
let currentIndex = -1;

async function getAPIKeys() {
  const response = await fetch('https://my-extension-worker.ssv5593.workers.dev/api-keys');
  if (!response.ok) {
    console.error('Failed to fetch API keys from Cloudflare Worker');
    return { error: 'Failed to fetch API keys' };
  }
  const keys = await response.json();
  console.log('API keys loaded:', keys);  // Added logging to check the loaded keys
  return {
    pexels: keys.PEXELS_API_KEY,
    google: keys.GOOGLE_API_KEY
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPexelsImages') {
    const now = Date.now();
    if (now - lastRequestTime < RATE_LIMIT) {
      sendResponse({ error: 'Please wait 1 second between requests' });
      return;
    }

    lastRequestTime = now;
    console.log('Processing request for query:', request.query);
    processImageRequest(request.query).then(response => {
      console.log('Response from image request:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error processing request:', error);
      sendResponse({ error: 'Error processing request: ' + error.message });
    });
    return true;
  } else if (request.action === 'goBack') {
    const historyImages = goBack();
    sendResponse({ images: historyImages });
  } else if (request.action === 'goForward') {
    const historyImages = goForward();
    sendResponse({ images: historyImages });
  }
});

async function processImageRequest(query) {
  const keys = await getAPIKeys();

  if (keys.error) {
    console.error('API keys not found:', keys.error);
    return { error: 'API keys not configured. Set them in extension options.' };
  }

  try {
    console.log('Detecting language for query:', query);
    const detectedLanguage = await detectLanguage(query, keys.google);
    console.log('Detected language:', detectedLanguage);

    console.log('Translating query to English:', query);
    const translatedText = await translateToEnglish(query, keys.google);
    console.log('Translated text:', translatedText);
    const images = await fetchPexelsImages(translatedText, keys.pexels);
    
    // Send the data to your backend
    sendTranslationToBackend(query, translatedText, images, detectedLanguage);

    return { images };
  } catch (error) {
    console.error('Error during translation or fetching images:', error);
    return { error: 'Error: ' + error.message };
  }
}

async function detectLanguage(text, apiKey) {
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text })
    }
  );

  if (!response.ok) {
    throw new Error('Language detection failed with status ' + response.status);
  }

  const data = await response.json();
  return data.data.detections[0][0].language;
}

async function translateToEnglish(text, apiKey) {
  console.log('Sending translation request to Google API');
  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: 'en',
        format: 'text'
      })
    }
  );

  if (!response.ok) {
    throw new Error('Translation failed with status ' + response.status);
  }

  const data = await response.json();
  return data.data.translations[0].translatedText;
}

async function fetchPexelsImages(query, apiKey) {
  console.log('Fetching images from Pexels with query:', query);
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=12`,
    { headers: { "Authorization": apiKey } }
  );

  if (response.status === 429) {
    console.error('Pexels API rate limit exceeded');
    return { error: 'API rate limit exceeded' };
  }

  if (!response.ok) {
    throw new Error('Image fetch failed with status ' + response.status);
  }

  const data = await response.json();

  const images = data.photos.map(photo => ({
    thumb: photo.src.medium,
    full: photo.src.original,
    alt: photo.alt || query,
    photographer: photo.photographer,
    profile: photo.photographer_url
  }));

  imageHistory.push(images);
  currentIndex = imageHistory.length - 1;

  return images;
}

// Function to send translation data to backend
async function sendTranslationToBackend(originalText, translatedText, images, language) {
  try {
    const data = {
      originalWord: originalText,
      translatedWord: translatedText,
      pexelsImages: images,
      date: new Date().toISOString(),  // Current timestamp as an ISO string
      language: language  // Use detected language here
    };

    const response = await fetch('http://localhost:5000/store-translation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    console.log('Backend response:', result);
  } catch (error) {
    console.error('Failed to send data to backend:', error);
  }
}

// Function to navigate back in the history
function goBack() {
  if (currentIndex > 0) {
    currentIndex--;
    return imageHistory[currentIndex];
  }
  return null;
}

// Function to navigate forward in the history
function goForward() {
  if (currentIndex < imageHistory.length - 1) {
    currentIndex++;
    return imageHistory[currentIndex];
  }
  return null;
}
