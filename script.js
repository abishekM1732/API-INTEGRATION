const form = document.getElementById('searchForm');
const cityInput = document.getElementById('cityInput');
const statusEl = document.getElementById('status');
const card = document.getElementById('card');
const locationEl = document.getElementById('location');
const tempEl = document.getElementById('temp');
const detailsEl = document.getElementById('details');

const newsSection = document.getElementById('newsSection');
const newsList = document.getElementById('newsList');
const newsMore = document.getElementById('newsMore');

const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search?name=';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

let lastPlace = '';

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#ffb4b4' : '';
}

function showCard() { card.classList.remove('hidden'); }
function hideCard() { card.classList.add('hidden'); }

function showNews() { newsSection.classList.remove('hidden'); }
function hideNews() { newsSection.classList.add('hidden'); }

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Network error: ${res.status}`);
  return res.json();
}

async function getCoordsForCity(city) {
  const url = GEO_API + encodeURIComponent(city);
  const data = await fetchJSON(url);
  if (!data.results || data.results.length === 0) {
    throw new Error('City not found');
  }
  const top = data.results[0];
  return { name: top.name, country: top.country, lat: top.latitude, lon: top.longitude };
}

async function getCurrentWeather(lat, lon) {
  const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const data = await fetchJSON(url);
  if (!data.current_weather) throw new Error('No weather data');
  return data.current_weather;
}

function renderWeather(weather, place) {
  locationEl.textContent = `${place.name}, ${place.country}`;
  tempEl.textContent = `${weather.temperature} °C`;
  detailsEl.innerHTML = `
    <div>Wind: ${weather.windspeed} m/s • Dir: ${Math.round(weather.winddirection)}°</div>
    <div>Weather code: ${weather.weathercode} • Time: ${new Date(weather.time).toLocaleString()}</div>
  `;
  showCard();
}

async function fetchNewsForPlace(placeName) {
  const googleRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(placeName)}&hl=en-US&gl=US&ceid=US:en`;
  const proxyUrl = CORS_PROXY + encodeURIComponent(googleRssUrl);

  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error('Failed to fetch news');

  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Failed to parse news feed');

  const items = Array.from(xml.querySelectorAll('item'));
  if (!items || items.length === 0) return [];

  const news = items.slice(0, 5).map(item => {
    const title = item.querySelector('title') ? item.querySelector('title').textContent : 'No title';
    const link = item.querySelector('link') ? item.querySelector('link').textContent : '#';
    const pubDate = item.querySelector('pubDate') ? item.querySelector('pubDate').textContent : '';
    const source = item.querySelector('source') ? item.querySelector('source').textContent : '';
    return { title, link, pubDate, source };
  });
  return news;
}

function renderNews(news, placeName) {
  newsList.innerHTML = '';
  if (!news || news.length === 0) {
    newsList.innerHTML = `<li>No recent news found for "${escapeHtml(placeName)}".</li>`;
    newsMore.innerHTML = '';
    showNews();
    return;
  }

  news.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = item.title;
    li.appendChild(a);

    const meta = document.createElement('div');
    meta.className = 'news-meta';
    const dateStr = item.pubDate ? ` • ${new Date(item.pubDate).toLocaleString()}` : '';
    meta.textContent = (item.source ? item.source : 'Source') + dateStr;
    li.appendChild(meta);

    newsList.appendChild(li);
  });

  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(placeName + ' site:news')}&tbm=nws`;
  newsMore.innerHTML = `<a href="${googleSearchUrl}" target="_blank" rel="noopener noreferrer">See more news results</a>`;
  showNews();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const city = cityInput.value.trim();
  if (!city) return;
  hideCard();
  hideNews();
  showStatus('Searching for city...');
  try {
    const place = await getCoordsForCity(city);
    showStatus(`Found ${place.name}, ${place.country}. Fetching weather & news...`);
    const weather = await getCurrentWeather(place.lat, place.lon);
    renderWeather(weather, place);
    lastPlace = `${place.name} ${place.country || ''}`.trim();

    try {
      const news = await fetchNewsForPlace(lastPlace);
      renderNews(news, lastPlace);
    } catch (newsErr) {
      console.warn('News fetch failed:', newsErr);
      newsList.innerHTML = `<li>Could not fetch news for "${escapeHtml(lastPlace)}".</li>`;
      newsMore.innerHTML = '';
      showNews();
    }

    showStatus('Updated ✓');
  } catch (err) {
    console.error(err);
    showStatus(err.message || 'Failed to fetch', true);
  }
});
