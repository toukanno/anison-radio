const tracks = [
  { title: "紅蓮華", artist: "LiSA", anime: "鬼滅の刃" },
  { title: "again", artist: "YUI", anime: "鋼の錬金術師 FULLMETAL ALCHEMIST" },
  { title: "シルエット", artist: "KANA-BOON", anime: "NARUTO -ナルト- 疾風伝" },
  { title: "only my railgun", artist: "fripSide", anime: "とある科学の超電磁砲" },
  { title: "残酷な天使のテーゼ", artist: "高橋洋子", anime: "新世紀エヴァンゲリオン" }
];

const state = {
  currentIndex: 0,
  playing: false,
  query: ""
};

const list = document.getElementById("track-list");
const template = document.getElementById("track-template");
const currentTitle = document.getElementById("current-title");
const currentMeta = document.getElementById("current-meta");
const playBtn = document.getElementById("play-btn");
const nextBtn = document.getElementById("next-btn");
const search = document.getElementById("search");

function filteredTracks() {
  const query = state.query.toLowerCase().trim();
  if (!query) return tracks;

  return tracks.filter((track) => {
    const text = `${track.title} ${track.artist} ${track.anime}`.toLowerCase();
    return text.includes(query);
  });
}

function updateNowPlaying() {
  const current = tracks[state.currentIndex];
  currentTitle.textContent = current ? current.title : "曲が見つかりません";
  currentMeta.textContent = current ? `${current.artist} • ${current.anime}` : "—";
  playBtn.textContent = state.playing ? "⏸ 一時停止" : "▶ 再生";
}

function renderList() {
  list.innerHTML = "";
  const visible = filteredTracks();

  if (!visible.length) {
    const empty = document.createElement("li");
    empty.textContent = "該当する曲がありません";
    empty.className = "track-meta";
    list.append(empty);
    return;
  }

  visible.forEach((track) => {
    const index = tracks.findIndex((item) => item.title === track.title && item.artist === track.artist);
    const fragment = template.content.cloneNode(true);
    const button = fragment.querySelector(".track-select");
    fragment.querySelector(".track-title").textContent = track.title;
    fragment.querySelector(".track-meta").textContent = `${track.artist} • ${track.anime}`;

    if (index === state.currentIndex) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      state.currentIndex = index;
      state.playing = true;
      updateNowPlaying();
      renderList();
    });

    list.append(fragment);
  });
}

playBtn.addEventListener("click", () => {
  state.playing = !state.playing;
  updateNowPlaying();
});

nextBtn.addEventListener("click", () => {
  state.currentIndex = (state.currentIndex + 1) % tracks.length;
  state.playing = true;
  updateNowPlaying();
  renderList();
});

search.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderList();
});

updateNowPlaying();
renderList();
