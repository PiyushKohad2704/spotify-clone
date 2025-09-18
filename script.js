const SONGS = [
  { id: 1, title: "Itna Na Mujhse Tu Pyar Badha", artist: "Talat Mahmood, Lata Mangeshkar", file: "./songs/song1.mp3", cover: "./assest/chaya.jpg", duration: "03:33" },
  { id: 2, title: "Mere Khwabo Mein", artist: "Lata Mangeshkar", file: "./songs/song2.mp3", cover: "./assest/card2img.jpeg", duration: "04:10" },
  { id: 3, title: "Tere Bina Zindagi Se", artist: "Kishore Kumar, Lata Mangeshkar", file: "./songs/song3.mp3", cover: "./assest/card3img.jpeg", duration: "05:01" }
];
const FADE_TIME_MS = 250;

let currentIndex = 0, isPlaying = false, isShuffle = false;
let repeatMode = "none";
let history = [];
const MAX_HISTORY = 10;
const favoritesKey = "spotify_clone_favorites_v1";
let favorites = new Set(JSON.parse(localStorage.getItem(favoritesKey) || "[]"));

const playerImgs = Array.from(document.querySelectorAll(".player-controls img"));
const playBtnImg = playerImgs[2] || document.querySelector(".player-controls img:nth-child(3)");
const prevBtnImg = playerImgs[1] || document.querySelector(".player-controls img:nth-child(2)");
const nextBtnImg = playerImgs[3] || document.querySelector(".player-controls img:nth-child(4)");
const progressBar = document.querySelector(".progress-bar");
const currTimeEl = document.querySelector(".curr-time");
const totalTimeEl = document.querySelector(".total-time");
const volumeBar = document.querySelector(".volume-bar");
const albumImg = document.querySelector(".album-img");
const songTitleEl = document.querySelector(".sg-song a");
const singerEls = document.querySelectorAll(".sg-singer");
const queueSection = document.querySelector(".queue-section");
const miniTitleEls = Array.from(document.querySelectorAll(".sg-song a, .mini-title, .footer-title"));
const miniArtistEls = Array.from(document.querySelectorAll(".sg-singer, .mini-artist, .footer-artist"));

const audio = new Audio();
audio.preload = "metadata";
audio.volume = 0.8;
if (volumeBar) volumeBar.value = Math.round(audio.volume * 100);

function formatTime(seconds) {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function updateAllTitleAreas(song) {
  const title = song.title || "Unknown Title";
  const artist = song.artist || "Unknown Artist";
  miniTitleEls.forEach(el => { el.textContent = title; });
  miniArtistEls.forEach(el => { el.textContent = artist; });
}

function loadSong(index) {
  index = clamp(index, 0, SONGS.length - 1);
  currentIndex = index;
  const song = SONGS[index];
  audio.src = song.file;
  audio.load();
  if (albumImg) albumImg.src = song.cover || "./assest/chaya.jpg";
  if (songTitleEl) songTitleEl.textContent = song.title || "Unknown Title";
  if (singerEls && singerEls.length > 0) {
    const parts = (song.artist || "").split(",");
    singerEls[0].textContent = (parts[0] || "") + (parts[1] ? "," : "");
    singerEls[1] && (singerEls[1].textContent = parts[1] || "");
  }
  if (totalTimeEl) totalTimeEl.textContent = song.duration || "0:00";
  if (progressBar) progressBar.value = 0;
  updateAllTitleAreas(song);
}

function fadeVolume(targetVolume, duration = FADE_TIME_MS) {
  const start = audio.volume;
  const change = targetVolume - start;
  if (duration <= 0 || !isFinite(start) || !isFinite(targetVolume)) {
    audio.volume = clamp(targetVolume, 0, 1);
    return Promise.resolve();
  }
  const steps = 12;
  const stepTime = Math.max(10, Math.floor(duration / steps));
  return new Promise(resolve => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      audio.volume = clamp(start + (change * (i / steps)), 0, 1);
      if (i >= steps) { clearInterval(iv); resolve(); }
    }, stepTime);
  });
}

async function playSong(fadeIn = true) {
  try {
    const targetVol = clamp(volumeBar ? volumeBar.value / 100 : 0.8, 0, 1);
    if (fadeIn) {
      audio.volume = 0;
      await audio.play();
      await fadeVolume(targetVol, FADE_TIME_MS);
    } else {
      await audio.play();
    }
    isPlaying = true;
    if (playBtnImg) playBtnImg.src = "./assest/pause_icon.png";
    pushHistory(SONGS[currentIndex].id);
  } catch (err) { console.error("Play failed:", err); }
}

async function pauseSong(fadeOut = true) {
  if (fadeOut) {
    const currentVol = audio.volume;
    await fadeVolume(0, FADE_TIME_MS);
    audio.pause();
    audio.volume = clamp(volumeBar ? volumeBar.value / 100 : currentVol, 0, 1);
  } else {
    audio.pause();
  }
  isPlaying = false;
  if (playBtnImg) playBtnImg.src = "./assest/player_icon3.png";
}

function togglePlayPause() { isPlaying ? pauseSong(true) : playSong(true); }
function nextIndex() { return isShuffle ? getRandomIndex() : (currentIndex + 1) % SONGS.length; }
function prevIndex() { return isShuffle ? getRandomIndex() : (currentIndex - 1 + SONGS.length) % SONGS.length; }
function getRandomIndex() {
  let idx;
  do { idx = Math.floor(Math.random() * SONGS.length); } while (idx === currentIndex && SONGS.length > 1);
  return idx;
}

function handleEnded() {
  if (repeatMode === "one") { audio.currentTime = 0; playSong(false); return; }
  if (repeatMode === "all") { loadSong(nextIndex()); playSong(false); return; }
  loadSong(nextIndex()); playSong(false);
}

audio.addEventListener("loadedmetadata", () => {
  if (totalTimeEl && isFinite(audio.duration)) totalTimeEl.textContent = formatTime(audio.duration);
});
audio.addEventListener("timeupdate", () => {
  if (!progressBar || !isFinite(audio.duration)) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  progressBar.value = pct;
  if (currTimeEl) currTimeEl.textContent = formatTime(audio.currentTime);
});

if (progressBar) {
  progressBar.addEventListener("input", () => {
    if (!isFinite(audio.duration)) return;
    const t = (progressBar.value / 100) * audio.duration;
    if (currTimeEl) currTimeEl.textContent = formatTime(t);
  });
  progressBar.addEventListener("change", () => {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = (progressBar.value / 100) * audio.duration;
  });
}

if (volumeBar) {
  volumeBar.addEventListener("input", () => {
    audio.volume = clamp(volumeBar.value / 100, 0, 1);
  });
}

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement && document.activeElement.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea") return;
  switch (e.code) {
    case "Space": e.preventDefault(); togglePlayPause(); break;
    case "ArrowRight": audio.currentTime = clamp(audio.currentTime + 5, 0, audio.duration || Infinity); break;
    case "ArrowLeft": audio.currentTime = clamp(audio.currentTime - 5, 0, audio.duration || Infinity); break;
    case "ArrowUp": audio.volume = clamp(audio.volume + 0.05, 0, 1); if (volumeBar) volumeBar.value = Math.round(audio.volume * 100); break;
    case "ArrowDown": audio.volume = clamp(audio.volume - 0.05, 0, 1); if (volumeBar) volumeBar.value = Math.round(audio.volume * 100); break;
    case "KeyS": toggleShuffle(); break;
    case "KeyR": cycleRepeatMode(); break;
  }
});

function toggleShuffle() {
  isShuffle = !isShuffle;
  const shuffleIcon = playerImgs[0];
  if (shuffleIcon) shuffleIcon.style.opacity = isShuffle ? "1" : "0.6";
}
function cycleRepeatMode() {
  if (repeatMode === "none") repeatMode = "all";
  else if (repeatMode === "all") repeatMode = "one";
  else repeatMode = "none";
  const repeatIcon = playerImgs[4];
  if (repeatIcon) repeatIcon.style.opacity = (repeatMode === "none" ? "0.6" : repeatMode === "all" ? "1" : "0.9");
}

function toggleFavoriteForCurrent() {
  const id = SONGS[currentIndex].id;
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  localStorage.setItem(favoritesKey, JSON.stringify(Array.from(favorites)));
}

function pushHistory(songId) {
  history.unshift({ id: songId, at: Date.now() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
}

function renderPlaylist() {
  if (!queueSection) return;
  let list = queueSection.querySelector(".js-playlist");
  if (!list) {
    list = document.createElement("div");
    list.className = "js-playlist";
    list.style.maxHeight = "180px";
    list.style.overflowY = "auto";
    list.style.marginTop = "0.75rem";
    queueSection.appendChild(list);
  }
  list.innerHTML = "";
  SONGS.forEach((s, idx) => {
    const row = document.createElement("div");
    row.className = "js-playlist-row";
    row.style.display = "flex";
    row.style.alignItems = "center";
    row.style.justifyContent = "space-between";
    row.style.padding = "0.35rem";
    row.style.cursor = "pointer";
    row.style.opacity = idx === currentIndex ? "1" : "0.9";
    row.onmouseenter = () => row.style.background = "#252525";
    row.onmouseleave = () => row.style.background = "transparent";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "0.6rem";

    const img = document.createElement("img");
    img.src = s.cover || "./assest/chaya.jpg";
    img.style.height = "36px";
    img.style.width = "36px";
    img.style.objectFit = "cover";
    img.style.borderRadius = "4px";

    const meta = document.createElement("div");
    meta.innerHTML = `<div style="font-weight:600; font-size:0.92rem">${s.title}</div><div style="opacity:0.7; font-size:0.8rem">${s.artist}</div>`;

    left.appendChild(img);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "0.5rem";

    const fav = document.createElement("button");
    fav.textContent = favorites.has(s.id) ? "♥" : "♡";
    fav.style.background = "transparent";
    fav.style.border = "none";
    fav.style.cursor = "pointer";
    fav.onclick = (ev) => {
      ev.stopPropagation();
      if (favorites.has(s.id)) favorites.delete(s.id);
      else favorites.add(s.id);
      localStorage.setItem(favoritesKey, JSON.stringify(Array.from(favorites)));
      fav.textContent = favorites.has(s.id) ? "♥" : "♡";
    };

    const playNow = document.createElement("button");
    playNow.textContent = "Play";
    playNow.style.cursor = "pointer";
    playNow.onclick = (ev) => {
      ev.stopPropagation();
      loadSong(idx);
      playSong(true);
      renderPlaylist();
    };

    right.appendChild(fav);
    right.appendChild(playNow);
    row.appendChild(left);
    row.appendChild(right);
    row.onclick = () => {
      loadSong(idx);
      playSong(true);
      renderPlaylist();
    };
    list.appendChild(row);
  });
}

if (playBtnImg) playBtnImg.addEventListener("click", togglePlayPause);
if (nextBtnImg) nextBtnImg.addEventListener("click", () => { loadSong(nextIndex()); playSong(true); renderPlaylist(); });
if (prevBtnImg) prevBtnImg.addEventListener("click", () => { loadSong(prevIndex()); playSong(true); renderPlaylist(); });
if (playerImgs[0]) playerImgs[0].addEventListener("click", toggleShuffle);
if (playerImgs[4]) playerImgs[4].addEventListener("click", cycleRepeatMode);
if (albumImg) albumImg.addEventListener("dblclick", toggleFavoriteForCurrent);

audio.addEventListener("ended", handleEnded);

function init() {
  loadSong(currentIndex);
  renderPlaylist();
}
init();

window.SpotifyClone = {
  SONGS, loadSong, playSong, pauseSong, toggleShuffle, cycleRepeatMode,
  toggleFavoriteForCurrent, getState: () => ({ currentIndex, isPlaying, isShuffle, repeatMode, history, favorites: Array.from(favorites) })
};
