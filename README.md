# anison-radio

A Spotify-grade web player for anime music — built as a zero-build static
web app. Designed to feel like a real streaming product: sidebar
navigation, fixed bottom player, queue + library, playlists, likes,
recently played, keyboard shortcuts, Media Session integration, and PWA
install for offline launch.

## Features

- **Spotify-style UI** — sidebar, sticky topbar, fixed bottom player with
  seek, volume, shuffle, repeat (off/all/one), and like.
- **Hybrid playback engine** — when a track has an `audioUrl`,
  `HTMLAudioElement` plays it; otherwise a WebAudio triangle-wave tone is
  synthesised so every control stays responsive in the absence of
  bundled audio.
- **Library** — liked tracks, recently played (last 30), and
  user-created playlists with add / remove / rename / delete and
  play-all / shuffle-all.
- **Queue** — append any track to the play queue; queued tracks take
  priority over sequential / shuffle next.
- **Discovery** — daily-rotating "Today's Pick", genre tags, and an
  anime shelf on the home view.
- **Search** — substring match across title, artist, anime, and tags.
- **Persistence** — likes, playlists, queue, volume, shuffle/repeat
  state, and play history are saved to `localStorage`.
- **Keyboard shortcuts** — Space / arrows / `M` / `L` / `S` / `R` / `/`
  (press `?` in the topbar for the full list).
- **Media Session API** — OS-level previous / play / next on supported
  platforms (lock screen, headphone buttons).
- **PWA** — installable from supported browsers; service worker caches
  the app shell so it launches offline.
- **Responsive** — bottom nav on mobile, sidebar on desktop. Reduced
  motion preference is respected.

## Run locally

No build step required.

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Deploy

Any static host works (GitHub Pages, Netlify, Cloudflare Pages,
Vercel static, S3+CloudFront). No server, build, or env vars needed.

> Note: service workers require HTTPS (or `localhost`).

## Adding real audio

Each entry in `data.js` accepts an optional `audioUrl`. Add it and the
player will stream that file instead of synthesising a tone:

```js
{ id: "t001", title: "...", artist: "...", anime: "...", duration: 235,
  audioUrl: "https://your-cdn.example/preview.mp3" }
```

The catalogue ships with metadata only — bundle or stream your own
audio assets to keep the repository license-clean.

## Tech

Vanilla ES modules, Web Audio API, `<dialog>`, CSS Grid, Service Worker,
Web App Manifest. No framework, no bundler.

## Language

- English / 日本語 — UI strings are localised in Japanese; this README
  ships in both.

---

# anison-radio (日本語)

アニソン特化の Spotify ライク Web プレイヤー。ビルド不要のスタティック
Web アプリとして実装。サイドバー / トップバー / 固定プレイヤー、
キュー、ライブラリ、プレイリスト、お気に入り、再生履歴、キーボード
ショートカット、Media Session、PWA インストールをサポート。

## ローカル実行

```bash
python3 -m http.server 8000
```

ブラウザで <http://localhost:8000> を開く。

## 実音源の追加

`data.js` の各エントリに `audioUrl` を追加すると、合成トーンではなく
実際のオーディオをストリーミング再生する。
