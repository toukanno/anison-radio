// anison-radio - Spotify-like anime song streaming prototype
// Single-file ES module. Persists state in localStorage. Uses a hybrid playback
// engine: if a track has an audioUrl, HTMLAudioElement plays it; otherwise a
// WebAudio-synthesised tone simulates playback so controls feel alive.

import { tracks } from "./data.js";

// ---------------------------------------------------------------------------
// Persistence

const STORAGE_KEY = "anison-radio:v1";

const defaultState = () => ({
  currentId: null,
  playing: false,
  query: "",
  view: "home",
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: "off", // off | all | one
  liked: [],
  recent: [],
  queue: [],
  playlists: [],
  libraryTab: "liked",
  selectedPlaylistId: null,
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    const persistable = { ...state, playing: false };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {}
}

const state = loadState();

// ---------------------------------------------------------------------------
// Utilities

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const trackById = (id) => tracks.find((t) => t.id === id) || null;
const trackIndex = (id) => tracks.findIndex((t) => t.id === id);

function formatTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function coverGradient(track) {
  // Deterministic gradient from a string
  const str = track.id || track.title || "x";
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const h1 = hash % 360;
  const h2 = (h1 + 60 + (hash % 40)) % 360;
  return `linear-gradient(135deg, hsl(${h1} 80% 55%) 0%, hsl(${h2} 80% 45%) 100%)`;
}

let toastTimer = null;
function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1800);
}

// ---------------------------------------------------------------------------
// Playback engine

const playbackEngine = (() => {
  const audioEl = new Audio();
  audioEl.preload = "metadata";
  audioEl.crossOrigin = "anonymous";

  let toneCtx = null;
  let toneOsc = null;
  let toneGain = null;
  let toneAnalyser = null;
  let toneTimer = null;
  let toneStartedAt = 0;
  let toneElapsed = 0; // when paused
  let toneDuration = 0;
  let toneTrackId = null;
  let mode = "idle"; // idle | audio | tone

  const listeners = { time: new Set(), end: new Set(), meta: new Set() };
  const emit = (name, ...args) => listeners[name].forEach((fn) => fn(...args));

  audioEl.addEventListener("timeupdate", () => emit("time", audioEl.currentTime, audioEl.duration || 0));
  audioEl.addEventListener("loadedmetadata", () => emit("meta", audioEl.duration || 0));
  audioEl.addEventListener("ended", () => emit("end"));
  audioEl.addEventListener("error", () => {
    // Audio asset failed — fall back to tone playback so UI keeps working.
    if (mode === "audio" && audioEl.src) startTone(toneTrackId, audioEl.currentTime || 0);
  });

  function ensureToneCtx() {
    if (!toneCtx) toneCtx = new (window.AudioContext || window.webkitAudioContext)();
    return toneCtx;
  }

  function stopTone() {
    if (toneTimer) cancelAnimationFrame(toneTimer);
    toneTimer = null;
    if (toneOsc) {
      try { toneOsc.stop(); } catch {}
      toneOsc.disconnect();
      toneOsc = null;
    }
    if (toneGain) {
      toneGain.disconnect();
      toneGain = null;
    }
  }

  function startTone(trackId, fromSec = 0) {
    stopTone();
    mode = "tone";
    const track = trackById(trackId);
    if (!track) return;
    toneTrackId = trackId;
    toneDuration = track.duration || 180;
    toneElapsed = fromSec;
    toneStartedAt = performance.now() / 1000 - fromSec;

    const ctx = ensureToneCtx();
    if (ctx.state === "suspended") ctx.resume();
    toneOsc = ctx.createOscillator();
    toneGain = ctx.createGain();
    if (!toneAnalyser) {
      toneAnalyser = ctx.createAnalyser();
      toneAnalyser.fftSize = 64;
    }
    let h = 0;
    for (let i = 0; i < track.id.length; i++) h = (h * 31 + track.id.charCodeAt(i)) >>> 0;
    const baseHz = 220 + (h % 220);
    toneOsc.type = "triangle";
    toneOsc.frequency.value = baseHz;
    const target = currentGain();
    const now = ctx.currentTime;
    toneGain.gain.setValueAtTime(0, now);
    toneGain.gain.linearRampToValueAtTime(target, now + 0.05);
    toneOsc.connect(toneGain);
    toneGain.connect(toneAnalyser);
    toneGain.connect(ctx.destination);
    toneOsc.start();
    emit("meta", toneDuration);
    tick();
  }

  function tick() {
    if (mode !== "tone") return;
    const now = performance.now() / 1000;
    const t = Math.min(toneDuration, now - toneStartedAt);
    emit("time", t, toneDuration);
    if (t >= toneDuration) {
      stopTone();
      emit("end");
      return;
    }
    toneTimer = requestAnimationFrame(tick);
  }

  function currentGain() {
    if (state.muted) return 0;
    // Tone is much louder than music — attenuate.
    return Math.max(0, Math.min(0.18, state.volume * 0.18));
  }

  function applyVolume() {
    audioEl.muted = state.muted;
    audioEl.volume = state.volume;
    if (toneGain) toneGain.gain.value = currentGain();
  }

  return {
    on(name, fn) { listeners[name].add(fn); },

    async play(track, { resume = false } = {}) {
      if (!track) return;
      if (track.audioUrl) {
        stopTone();
        mode = "audio";
        toneTrackId = track.id;
        if (audioEl.src !== track.audioUrl) {
          audioEl.src = track.audioUrl;
        } else if (!resume) {
          audioEl.currentTime = 0;
        }
        applyVolume();
        try {
          await audioEl.play();
        } catch (e) {
          // Autoplay policy or asset failure — fall back to tone.
          startTone(track.id, 0);
        }
      } else {
        if (mode === "tone" && resume && toneTrackId === track.id) {
          startTone(track.id, toneElapsed);
        } else {
          startTone(track.id, 0);
        }
      }
    },

    pause() {
      if (mode === "audio") {
        audioEl.pause();
      } else if (mode === "tone") {
        toneElapsed = Math.min(toneDuration, performance.now() / 1000 - toneStartedAt);
        stopTone();
      }
    },

    seek(sec) {
      if (mode === "audio") {
        if (Number.isFinite(audioEl.duration)) {
          audioEl.currentTime = Math.max(0, Math.min(audioEl.duration, sec));
        }
      } else if (mode === "tone") {
        toneElapsed = Math.max(0, Math.min(toneDuration, sec));
        if (toneOsc) startTone(toneTrackId, toneElapsed);
        else emit("time", toneElapsed, toneDuration);
      }
    },

    setVolume(v, muted) {
      state.volume = v;
      state.muted = !!muted;
      applyVolume();
    },

    currentTime() {
      if (mode === "audio") return audioEl.currentTime || 0;
      if (mode === "tone") {
        if (toneOsc) return performance.now() / 1000 - toneStartedAt;
        return toneElapsed;
      }
      return 0;
    },

    duration() {
      if (mode === "audio") return audioEl.duration || 0;
      if (mode === "tone") return toneDuration;
      return 0;
    },

    analyser() {
      return mode === "tone" ? toneAnalyser : null;
    },

    isPlaying() {
      if (mode === "audio") return !audioEl.paused;
      if (mode === "tone") return !!toneOsc;
      return false;
    },
  };
})();

// ---------------------------------------------------------------------------
// Selection / queue helpers

function pushRecent(id) {
  state.recent = [id, ...state.recent.filter((x) => x !== id)].slice(0, 30);
}

function pickNextId() {
  // Queue takes priority. repeat=one is handled by the auto-advance listener;
  // manual "next" should still advance.
  if (state.queue.length) {
    const [next, ...rest] = state.queue;
    state.queue = rest;
    return next;
  }
  if (state.shuffle) {
    const others = tracks.filter((t) => t.id !== state.currentId);
    if (!others.length) return state.currentId;
    return others[Math.floor(Math.random() * others.length)].id;
  }
  const idx = trackIndex(state.currentId);
  if (idx === -1) return tracks[0]?.id ?? null;
  if (idx + 1 < tracks.length) return tracks[idx + 1].id;
  return state.repeat === "all" ? tracks[0].id : null;
}

function pickPrevId() {
  const idx = trackIndex(state.currentId);
  if (idx === -1) return tracks[0]?.id ?? null;
  if (idx - 1 >= 0) return tracks[idx - 1].id;
  return state.repeat === "all" ? tracks[tracks.length - 1].id : state.currentId;
}

async function playTrack(id, { resume = false } = {}) {
  const track = trackById(id);
  if (!track) return;
  state.currentId = id;
  state.playing = true;
  if (!resume) pushRecent(id);
  await playbackEngine.play(track, { resume });
  updateMediaSession(track);
  renderAll();
  saveState();
}

async function togglePlay() {
  if (!state.currentId) {
    const first = tracks[0]?.id;
    if (first) await playTrack(first);
    return;
  }
  if (state.playing) {
    state.playing = false;
    playbackEngine.pause();
  } else {
    state.playing = true;
    await playbackEngine.play(trackById(state.currentId), { resume: true });
  }
  renderPlayer();
  saveState();
}

async function playNext() {
  const id = pickNextId();
  if (!id) {
    state.playing = false;
    playbackEngine.pause();
    renderPlayer();
    saveState();
    return;
  }
  await playTrack(id);
}

async function playPrev() {
  const id = pickPrevId();
  if (id) await playTrack(id);
}

// ---------------------------------------------------------------------------
// Library actions

function toggleLike(id) {
  if (state.liked.includes(id)) {
    state.liked = state.liked.filter((x) => x !== id);
    toast("お気に入りから削除");
  } else {
    state.liked = [id, ...state.liked];
    toast("お気に入りに追加");
  }
  saveState();
  renderAll();
}

function addToQueue(id) {
  state.queue.push(id);
  toast("キューに追加");
  saveState();
  renderQueue();
}

function createPlaylist(name) {
  const pl = { id: uid(), name: name.trim() || "新しいプレイリスト", trackIds: [], createdAt: Date.now() };
  state.playlists.push(pl);
  saveState();
  renderSidebar();
  return pl;
}

function addToPlaylist(playlistId, trackId) {
  const pl = state.playlists.find((p) => p.id === playlistId);
  if (!pl) return;
  if (!pl.trackIds.includes(trackId)) pl.trackIds.push(trackId);
  toast(`「${pl.name}」に追加`);
  saveState();
  renderAll();
}

function removeFromPlaylist(playlistId, trackId) {
  const pl = state.playlists.find((p) => p.id === playlistId);
  if (!pl) return;
  pl.trackIds = pl.trackIds.filter((id) => id !== trackId);
  saveState();
  renderAll();
}

function renamePlaylist(playlistId, name) {
  const pl = state.playlists.find((p) => p.id === playlistId);
  if (!pl) return;
  pl.name = name.trim() || pl.name;
  saveState();
  renderAll();
}

function deletePlaylist(playlistId) {
  state.playlists = state.playlists.filter((p) => p.id !== playlistId);
  if (state.selectedPlaylistId === playlistId) {
    state.selectedPlaylistId = null;
    state.view = "library";
  }
  saveState();
  renderAll();
}

// ---------------------------------------------------------------------------
// Rendering

const el = {
  views: {},
  search: $("#search"),
  trackList: $("#track-list"),
  searchResults: $("#search-results"),
  animeShelf: $("#anime-shelf"),
  featuredShelf: $("#featured-shelf"),
  genreShelf: $("#genre-shelf"),
  recentShelf: $("#recent-shelf"),
  likedList: $("#liked-list"),
  recentList: $("#recent-list"),
  playlistsPanel: $("#playlists-panel"),
  queueList: $("#queue-list"),
  playlistList: $("#playlist-list"),
  playlistDetailName: $("#playlist-detail-name"),
  playlistDetailList: $("#playlist-detail-list"),
  currentTitle: $("#current-title"),
  currentMeta: $("#current-meta"),
  cover: $("#player-cover"),
  playBtn: $("#play-btn"),
  nextBtn: $("#next-btn"),
  prevBtn: $("#prev-btn"),
  shuffleBtn: $("#shuffle-btn"),
  repeatBtn: $("#repeat-btn"),
  likeBtn: $("#like-btn"),
  seek: $("#seek"),
  timeNow: $("#time-now"),
  timeTotal: $("#time-total"),
  volume: $("#volume"),
  installBtn: $("#install-btn"),
  queueToggle: $("#queue-toggle"),
};

["home", "search", "library", "queue", "playlist"].forEach((v) => {
  el.views[v] = $(`#view-${v}`);
});

const trackTemplate = $("#track-template");
const cardTemplate = $("#card-template");

function renderTrackItem(track, opts = {}) {
  const { index, ctxPlaylistId } = opts;
  const fragment = trackTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".track-item");
  const select = fragment.querySelector(".track-select");
  const cover = fragment.querySelector(".track-cover");
  fragment.querySelector(".track-index").textContent = index != null ? String(index + 1) : "";
  fragment.querySelector(".track-title").textContent = track.title;
  fragment.querySelector(".track-meta").textContent = `${track.artist} • ${track.anime}`;
  fragment.querySelector(".track-duration").textContent = formatTime(track.duration || 0);
  cover.style.setProperty("--cover", coverGradient(track));

  const likeBtn = fragment.querySelector(".like-toggle");
  const liked = state.liked.includes(track.id);
  likeBtn.classList.toggle("liked", liked);
  likeBtn.setAttribute("aria-pressed", String(liked));
  likeBtn.textContent = liked ? "♥" : "♡";

  if (track.id === state.currentId) item.classList.add("active");

  select.addEventListener("click", () => playTrack(track.id));
  likeBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(track.id); });
  fragment.querySelector(".add-to-queue").addEventListener("click", (e) => {
    e.stopPropagation(); addToQueue(track.id);
  });
  fragment.querySelector(".add-to-playlist").addEventListener("click", (e) => {
    e.stopPropagation(); openAddToPlaylistDialog(track.id);
  });

  if (ctxPlaylistId) {
    // Right-click on the row removes from playlist via context menu fallback
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      removeFromPlaylist(ctxPlaylistId, track.id);
      toast("プレイリストから削除");
    });
  }

  return fragment;
}

function renderTrackListInto(container, list, opts = {}) {
  container.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("li");
    empty.className = "muted";
    empty.style.padding = "12px";
    empty.textContent = opts.emptyText || "曲がありません";
    container.append(empty);
    return;
  }
  list.forEach((track, i) => container.append(renderTrackItem(track, { index: i, ctxPlaylistId: opts.ctxPlaylistId })));
}

// Stable "today's pick" derived from the local date so it changes once a day.
function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function pseudoShuffle(list, seed) {
  const arr = list.slice();
  let s = seed >>> 0;
  const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 0x100000000;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderFeaturedShelf() {
  if (!el.featuredShelf) return;
  el.featuredShelf.innerHTML = "";
  const picks = pseudoShuffle(tracks, todaySeed()).slice(0, 6);
  for (const t of picks) {
    const frag = cardTemplate.content.cloneNode(true);
    const btn = frag.querySelector(".card");
    frag.querySelector(".card-title").textContent = t.title;
    frag.querySelector(".card-sub").textContent = `${t.artist} • ${t.anime}`;
    frag.querySelector(".card-cover").style.setProperty("--cover", coverGradient(t));
    btn.addEventListener("click", () => playTrack(t.id));
    el.featuredShelf.append(frag);
  }
}

function renderGenreShelf() {
  if (!el.genreShelf) return;
  const genres = new Map();
  for (const t of tracks) {
    for (const tag of t.tags || []) {
      if (!genres.has(tag)) genres.set(tag, []);
      genres.get(tag).push(t);
    }
  }
  el.genreShelf.innerHTML = "";
  // Sort by size desc, then alpha
  const sorted = Array.from(genres.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  for (const [tag, list] of sorted) {
    const frag = cardTemplate.content.cloneNode(true);
    const btn = frag.querySelector(".card");
    frag.querySelector(".card-title").textContent = `#${tag}`;
    frag.querySelector(".card-sub").textContent = `${list.length} 曲`;
    frag.querySelector(".card-cover").style.setProperty("--cover", coverGradient(list[0]));
    btn.addEventListener("click", () => {
      state.query = tag;
      el.search.value = tag;
      switchView("search");
    });
    el.genreShelf.append(frag);
  }
}

function renderAnimeShelf() {
  const grouped = new Map();
  for (const t of tracks) {
    if (!grouped.has(t.anime)) grouped.set(t.anime, []);
    grouped.get(t.anime).push(t);
  }
  el.animeShelf.innerHTML = "";
  for (const [anime, list] of grouped) {
    const frag = cardTemplate.content.cloneNode(true);
    const btn = frag.querySelector(".card");
    frag.querySelector(".card-title").textContent = anime;
    frag.querySelector(".card-sub").textContent = `${list.length} 曲`;
    frag.querySelector(".card-cover").style.setProperty("--cover", coverGradient(list[0]));
    btn.addEventListener("click", () => {
      state.query = anime;
      el.search.value = anime;
      switchView("search");
    });
    el.animeShelf.append(frag);
  }
}

function renderRecentShelf() {
  el.recentShelf.innerHTML = "";
  const recent = state.recent.map(trackById).filter(Boolean).slice(0, 8);
  for (const t of recent) {
    const frag = cardTemplate.content.cloneNode(true);
    const btn = frag.querySelector(".card");
    frag.querySelector(".card-title").textContent = t.title;
    frag.querySelector(".card-sub").textContent = `${t.artist} • ${t.anime}`;
    frag.querySelector(".card-cover").style.setProperty("--cover", coverGradient(t));
    btn.addEventListener("click", () => playTrack(t.id));
    el.recentShelf.append(frag);
  }
}

function renderTrackList() { renderTrackListInto(el.trackList, tracks); }

function renderSearch() {
  const q = state.query.toLowerCase().trim();
  if (!q) {
    renderTrackListInto(el.searchResults, tracks, { emptyText: "検索ワードを入力してください" });
    return;
  }
  const hits = tracks.filter((t) => {
    return `${t.title} ${t.artist} ${t.anime} ${t.tags?.join(" ") || ""}`.toLowerCase().includes(q);
  });
  renderTrackListInto(el.searchResults, hits, { emptyText: "該当する曲がありません" });
}

function renderLibrary() {
  const liked = state.liked.map(trackById).filter(Boolean);
  renderTrackListInto(el.likedList, liked, { emptyText: "お気に入りはまだありません" });
  const recent = state.recent.map(trackById).filter(Boolean);
  renderTrackListInto(el.recentList, recent, { emptyText: "再生履歴はまだありません" });

  el.playlistsPanel.innerHTML = "";
  if (!state.playlists.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "プレイリストはまだありません。左下の＋ボタンから作成できます。";
    el.playlistsPanel.append(empty);
  }
  for (const pl of state.playlists) {
    const frag = cardTemplate.content.cloneNode(true);
    const btn = frag.querySelector(".card");
    frag.querySelector(".card-title").textContent = pl.name;
    frag.querySelector(".card-sub").textContent = `${pl.trackIds.length} 曲`;
    const first = pl.trackIds.map(trackById).filter(Boolean)[0];
    if (first) frag.querySelector(".card-cover").style.setProperty("--cover", coverGradient(first));
    btn.addEventListener("click", () => openPlaylist(pl.id));
    el.playlistsPanel.append(frag);
  }
  // Tab visibility
  $$(".tab", el.views.library).forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === state.libraryTab));
  $$("[data-tab-panel]", el.views.library).forEach((panel) => {
    panel.hidden = panel.dataset.tabPanel !== state.libraryTab;
  });
}

function renderQueue() {
  const qList = state.queue.map(trackById).filter(Boolean);
  renderTrackListInto(el.queueList, qList, { emptyText: "キューは空です" });
}

function renderPlaylistDetail() {
  const pl = state.playlists.find((p) => p.id === state.selectedPlaylistId);
  if (!pl) return;
  el.playlistDetailName.textContent = pl.name;
  const list = pl.trackIds.map(trackById).filter(Boolean);
  renderTrackListInto(el.playlistDetailList, list, { emptyText: "曲を追加してください（右クリックで削除）", ctxPlaylistId: pl.id });
}

function renderSidebar() {
  el.playlistList.innerHTML = "";
  for (const pl of state.playlists) {
    const li = document.createElement("li");
    if (state.selectedPlaylistId === pl.id && state.view === "playlist") li.classList.add("active");
    const btn = document.createElement("button");
    btn.textContent = pl.name;
    btn.addEventListener("click", () => openPlaylist(pl.id));
    li.append(btn);
    el.playlistList.append(li);
  }
  $$(".nav-item, .mnav").forEach((n) => n.classList.toggle("active", n.dataset.view === state.view));
}

function renderPlayer() {
  const t = trackById(state.currentId);
  el.currentTitle.textContent = t ? t.title : "曲を選んで再生";
  el.currentMeta.textContent = t ? `${t.artist} • ${t.anime}` : "—";
  el.cover.style.setProperty("--cover", t ? coverGradient(t) : "var(--accent-grad)");
  el.playBtn.textContent = state.playing ? "❚❚" : "▶";
  el.playBtn.setAttribute("aria-label", state.playing ? "一時停止" : "再生");
  el.shuffleBtn.setAttribute("aria-pressed", String(state.shuffle));
  el.repeatBtn.setAttribute("aria-pressed", String(state.repeat !== "off"));
  el.repeatBtn.textContent = state.repeat === "one" ? "↻¹" : "↻";
  const liked = t && state.liked.includes(t.id);
  el.likeBtn.textContent = liked ? "♥" : "♡";
  el.likeBtn.setAttribute("aria-pressed", String(!!liked));
  el.volume.value = String(Math.round(state.volume * 100));
  el.volume.style.setProperty("--p", `${Math.round(state.volume * 100)}%`);

  const np = document.getElementById("now-playing-dialog");
  if (np?.open) {
    np.dataset.paused = String(!state.playing);
    if (t) {
      document.getElementById("np-cover")?.style.setProperty("--cover", coverGradient(t));
      document.getElementById("np-title").textContent = t.title;
      document.getElementById("np-sub").textContent = t.artist;
      document.getElementById("np-anime").textContent = t.anime;
    }
  }
}

function renderViews() {
  Object.entries(el.views).forEach(([name, node]) => {
    node.hidden = name !== state.view;
  });
}

function renderAll() {
  renderViews();
  renderSidebar();
  renderFeaturedShelf();
  renderGenreShelf();
  renderAnimeShelf();
  renderRecentShelf();
  renderTrackList();
  renderSearch();
  renderLibrary();
  renderQueue();
  if (state.view === "playlist") renderPlaylistDetail();
  renderPlayer();
}

// ---------------------------------------------------------------------------
// Navigation

function switchView(view) {
  state.view = view;
  if (view !== "playlist") state.selectedPlaylistId = null;
  saveState();
  renderAll();
  el.views[view]?.parentElement?.scrollTo({ top: 0, behavior: "smooth" });
}

function openPlaylist(id) {
  state.selectedPlaylistId = id;
  state.view = "playlist";
  saveState();
  renderAll();
}

// ---------------------------------------------------------------------------
// Dialogs

function openPromptDialog(title, defaultValue = "") {
  return new Promise((resolve) => {
    const dlg = $("#prompt-dialog");
    const titleEl = $("#prompt-title");
    const input = $("#prompt-input");
    const form = $("#prompt-form");
    titleEl.textContent = title;
    input.value = defaultValue;
    const onClose = () => {
      form.removeEventListener("submit", onSubmit);
      dlg.removeEventListener("close", onClose);
      resolve(dlg.returnValue === "ok" ? input.value : null);
    };
    const onSubmit = () => {};
    form.addEventListener("submit", onSubmit);
    dlg.addEventListener("close", onClose);
    dlg.showModal();
    setTimeout(() => input.focus(), 0);
  });
}

function openAddToPlaylistDialog(trackId) {
  const dlg = $("#add-to-playlist-dialog");
  const listEl = $("#add-to-playlist-list");
  listEl.innerHTML = "";

  // "New playlist" option
  const newItem = document.createElement("li");
  const newBtn = document.createElement("button");
  newBtn.type = "button";
  newBtn.textContent = "＋ 新しいプレイリストを作成";
  newBtn.addEventListener("click", async () => {
    dlg.close();
    const name = await openPromptDialog("プレイリスト名");
    if (name == null) return;
    const pl = createPlaylist(name);
    addToPlaylist(pl.id, trackId);
  });
  newItem.append(newBtn);
  listEl.append(newItem);

  for (const pl of state.playlists) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${pl.name} (${pl.trackIds.length})`;
    btn.addEventListener("click", () => {
      addToPlaylist(pl.id, trackId);
      dlg.close();
    });
    li.append(btn);
    listEl.append(li);
  }

  dlg.showModal();
}

// ---------------------------------------------------------------------------
// Event wiring

el.playBtn.addEventListener("click", togglePlay);
el.nextBtn.addEventListener("click", playNext);
el.prevBtn.addEventListener("click", playPrev);

el.shuffleBtn.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  renderPlayer();
  saveState();
});

el.repeatBtn.addEventListener("click", () => {
  state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off";
  renderPlayer();
  saveState();
});

el.likeBtn.addEventListener("click", () => {
  if (!state.currentId) return;
  toggleLike(state.currentId);
});

el.seek.addEventListener("input", (e) => {
  const ratio = Number(e.target.value) / 1000;
  const dur = playbackEngine.duration();
  if (dur > 0) {
    playbackEngine.seek(ratio * dur);
  }
});

el.volume.addEventListener("input", (e) => {
  const v = Number(e.target.value) / 100;
  playbackEngine.setVolume(v, v === 0);
  el.volume.style.setProperty("--p", `${e.target.value}%`);
  saveState();
});

el.search.addEventListener("input", (e) => {
  state.query = e.target.value;
  if (state.view !== "search" && state.query) {
    switchView("search");
    el.search.focus();
  } else {
    renderSearch();
  }
});

$$(".nav-item, .mnav").forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

$("#help-btn")?.addEventListener("click", () => $("#shortcuts-dialog").showModal());

el.queueToggle.addEventListener("click", () => switchView("queue"));

$$(".tab", el.views.library).forEach((tab) => {
  tab.addEventListener("click", () => {
    state.libraryTab = tab.dataset.tab;
    saveState();
    renderLibrary();
  });
});

$("#new-playlist-btn").addEventListener("click", async () => {
  const name = await openPromptDialog("プレイリスト名", `新しいプレイリスト ${state.playlists.length + 1}`);
  if (name == null) return;
  const pl = createPlaylist(name);
  openPlaylist(pl.id);
});

$("#playlist-play-all").addEventListener("click", () => {
  const pl = state.playlists.find((p) => p.id === state.selectedPlaylistId);
  if (!pl?.trackIds.length) return;
  state.queue = pl.trackIds.slice(1);
  playTrack(pl.trackIds[0]);
});

$("#playlist-shuffle").addEventListener("click", () => {
  const pl = state.playlists.find((p) => p.id === state.selectedPlaylistId);
  if (!pl?.trackIds.length) return;
  const shuffled = pl.trackIds.slice().sort(() => Math.random() - 0.5);
  state.queue = shuffled.slice(1);
  state.shuffle = true;
  playTrack(shuffled[0]);
});

$("#playlist-rename").addEventListener("click", async () => {
  const pl = state.playlists.find((p) => p.id === state.selectedPlaylistId);
  if (!pl) return;
  const name = await openPromptDialog("プレイリスト名を変更", pl.name);
  if (name == null) return;
  renamePlaylist(pl.id, name);
});

$("#playlist-delete").addEventListener("click", async () => {
  const pl = state.playlists.find((p) => p.id === state.selectedPlaylistId);
  if (!pl) return;
  const ok = confirm(`プレイリスト「${pl.name}」を削除しますか？`);
  if (ok) deletePlaylist(pl.id);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const target = e.target;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
  if (e.key === " " || e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); playNext(); }
  else if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); playPrev(); }
  else if (e.key === "ArrowRight") { playbackEngine.seek(playbackEngine.currentTime() + 5); }
  else if (e.key === "ArrowLeft") { playbackEngine.seek(Math.max(0, playbackEngine.currentTime() - 5)); }
  else if (e.key === "ArrowUp") { e.preventDefault(); const v = Math.min(1, state.volume + 0.05); playbackEngine.setVolume(v, false); renderPlayer(); }
  else if (e.key === "ArrowDown") { e.preventDefault(); const v = Math.max(0, state.volume - 0.05); playbackEngine.setVolume(v, v === 0); renderPlayer(); }
  else if (e.key === "m" || e.key === "M") { playbackEngine.setVolume(state.volume, !state.muted); renderPlayer(); }
  else if (e.key === "l" || e.key === "L") { if (state.currentId) toggleLike(state.currentId); }
  else if (e.key === "s" || e.key === "S") { state.shuffle = !state.shuffle; renderPlayer(); saveState(); }
  else if (e.key === "r" || e.key === "R") { state.repeat = state.repeat === "off" ? "all" : state.repeat === "all" ? "one" : "off"; renderPlayer(); saveState(); }
  else if (e.key === "/" ) { e.preventDefault(); el.search.focus(); }
});

// Playback engine -> UI
playbackEngine.on("time", (t, d) => {
  el.timeNow.textContent = formatTime(t);
  if (d > 0) el.timeTotal.textContent = formatTime(d);
  const ratio = d > 0 ? Math.min(1, t / d) : 0;
  el.seek.value = String(Math.round(ratio * 1000));
  el.seek.style.setProperty("--p", `${Math.round(ratio * 100)}%`);
});
playbackEngine.on("meta", (d) => {
  el.timeTotal.textContent = formatTime(d);
});
playbackEngine.on("end", () => {
  if (state.repeat === "one") {
    playTrack(state.currentId);
  } else {
    playNext();
  }
});

// ---------------------------------------------------------------------------
// Media Session integration

function updateMediaSession(track) {
  if (!("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.anime,
  });
  const handlers = [
    ["play", () => togglePlay()],
    ["pause", () => togglePlay()],
    ["nexttrack", () => playNext()],
    ["previoustrack", () => playPrev()],
  ];
  for (const [name, fn] of handlers) {
    try { navigator.mediaSession.setActionHandler(name, fn); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Hash-based router

const VIEWS = new Set(["home", "search", "library", "queue", "playlist"]);

function parseHash() {
  const h = (location.hash || "").replace(/^#\/?/, "");
  if (!h) return { view: "home" };
  const [view, id] = h.split("/");
  if (!VIEWS.has(view)) return { view: "home" };
  if (view === "playlist") return { view, id };
  return { view };
}

function writeHash() {
  let next;
  if (state.view === "playlist" && state.selectedPlaylistId) {
    next = `#/playlist/${state.selectedPlaylistId}`;
  } else {
    next = `#/${state.view}`;
  }
  if (location.hash !== next) history.replaceState(null, "", next);
}

window.addEventListener("hashchange", () => {
  const { view, id } = parseHash();
  if (view === "playlist") {
    if (id && state.playlists.some((p) => p.id === id)) openPlaylist(id);
    else switchView("home");
  } else {
    switchView(view);
  }
});

// Hook hash writes into navigation.
const _switchView = switchView;
switchView = function (view) {
  _switchView(view);
  writeHash();
};
const _openPlaylist = openPlaylist;
openPlaylist = function (id) {
  _openPlaylist(id);
  writeHash();
};

// ---------------------------------------------------------------------------
// Sleep timer

let sleepTimerId = null;
let sleepEndsAt = 0;

function setSleepTimer(minutes) {
  if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
  if (!minutes) {
    sleepEndsAt = 0;
    toast("スリープタイマー解除");
    return;
  }
  sleepEndsAt = Date.now() + minutes * 60_000;
  sleepTimerId = setTimeout(() => {
    if (state.playing) togglePlay();
    sleepTimerId = null;
    sleepEndsAt = 0;
    toast("スリープ: 再生を停止しました");
  }, minutes * 60_000);
  toast(`スリープタイマー: ${minutes}分後に停止`);
}

$("#sleep-btn").addEventListener("click", () => {
  const dlg = $("#sleep-dialog");
  const status = $("#sleep-status");
  if (sleepEndsAt) {
    const mins = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 60_000));
    status.textContent = `あと約 ${mins} 分で停止します`;
  } else {
    status.textContent = "タイマーは設定されていません";
  }
  dlg.showModal();
});
$$("#sleep-dialog [data-min]").forEach((btn) => {
  btn.addEventListener("click", () => {
    setSleepTimer(Number(btn.dataset.min));
  });
});

// ---------------------------------------------------------------------------
// Now Playing modal + canvas visualizer

const npDialog = $("#now-playing-dialog");
const npCover = $("#np-cover");
const npTitle = $("#np-title");
const npSub   = $("#np-sub");
const npAnime = $("#np-anime");

function openNowPlaying() {
  const t = trackById(state.currentId);
  if (!t) { toast("曲を選んでください"); return; }
  npCover.style.setProperty("--cover", coverGradient(t));
  npTitle.textContent = t.title;
  npSub.textContent = t.artist;
  npAnime.textContent = t.anime;
  npDialog.dataset.paused = String(!state.playing);
  npDialog.showModal();
}

$("#cover-expand").addEventListener("click", openNowPlaying);

const viz = $("#player-viz");
const vizCtx = viz?.getContext("2d");
function sizeCanvas() {
  if (!viz) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = viz.getBoundingClientRect();
  viz.width = Math.max(1, Math.round(rect.width * dpr));
  viz.height = Math.max(1, Math.round(rect.height * dpr));
}
window.addEventListener("resize", sizeCanvas);

function tickViz() {
  requestAnimationFrame(tickViz);
  if (!vizCtx) return;
  if (!viz.width || !viz.height) sizeCanvas();
  vizCtx.clearRect(0, 0, viz.width, viz.height);
  const a = playbackEngine.analyser?.();
  if (!a || !playbackEngine.isPlaying()) return;
  const bins = a.frequencyBinCount;
  const data = new Uint8Array(bins);
  a.getByteFrequencyData(data);
  const bars = Math.min(8, bins);
  const w = viz.width / bars;
  for (let i = 0; i < bars; i++) {
    const v = data[i * Math.floor(bins / bars)] / 255;
    const h = v * viz.height;
    vizCtx.fillStyle = `hsla(${(i * 36 + 320) % 360} 90% 60% / 0.85)`;
    vizCtx.fillRect(i * w + 1, viz.height - h, Math.max(1, w - 2), h);
  }
}
sizeCanvas();
requestAnimationFrame(tickViz);

// ---------------------------------------------------------------------------
// PWA: install prompt + service worker

let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstall = e;
  el.installBtn.hidden = false;
});
el.installBtn.addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  el.installBtn.hidden = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

// ---------------------------------------------------------------------------
// Boot

playbackEngine.setVolume(state.volume, state.muted);
el.seek.style.setProperty("--p", "0%");
el.timeNow.textContent = "0:00";
el.timeTotal.textContent = "0:00";

// Apply hash-based view at boot (overrides persisted view when present).
if (location.hash) {
  const { view, id } = parseHash();
  if (view === "playlist" && id && state.playlists.some((p) => p.id === id)) {
    state.selectedPlaylistId = id;
    state.view = "playlist";
  } else {
    state.view = view;
  }
}
renderAll();
writeHash();
// Don't auto-play on load (browser policy), but restore the meta so player has context.
if (state.currentId) {
  const t = trackById(state.currentId);
  if (t) updateMediaSession(t);
}
