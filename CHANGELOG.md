# Changelog

All notable changes to anison-radio are documented here.

## [1.0.0] - 2026-05-19

First release-ready version. Complete rewrite of the early prototype
into a Spotify-grade web player.

### Added
- Sidebar navigation with home / search / library / queue + playlists.
- Sticky topbar search with substring matching across title, artist,
  anime, and tags.
- Fixed bottom player bar with cover, seek, volume, shuffle, repeat
  (off / all / one), like, and queue-toggle controls.
- Hybrid playback engine: `HTMLAudioElement` when an `audioUrl` is
  provided on a track, WebAudio triangle-wave tone fallback otherwise.
- Library: liked tracks, recently played (last 30), user-created
  playlists with add / remove / rename / delete and play-all /
  shuffle-all.
- Queue with priority over sequential / shuffle next.
- Home discovery shelves: daily-rotating "Today's Pick", genre tags,
  anime grid, and recently played.
- Persistence to `localStorage`: likes, playlists, queue, volume,
  shuffle / repeat state, view, and play history.
- Keyboard shortcuts (Space, arrows, M / L / S / R, /) with an
  in-app help dialog.
- Media Session API integration for OS lock-screen and media-key
  control.
- PWA: web app manifest, service worker with app-shell caching,
  installable from supported browsers.
- Mobile bottom navigation; sidebar on desktop.
- Accessibility: focus-visible outlines, `aria-pressed` on toggles,
  `aria-label` on icon-only buttons, `prefers-reduced-motion` guard.

### Catalogue
- 30 curated anison metadata entries (no copyrighted audio bundled).
