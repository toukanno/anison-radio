# anison-radio

Anime song streaming app inspired by Spotify. Play, discover, and enjoy anime music.

## Integration-ready foundation

This repository is now prepared so Spotify API and YouTube API support can be added incrementally without reworking core app flows.

### Added preparation items

- A provider-agnostic integration design document with a shared adapter contract.
- Environment variable templates for Spotify and YouTube credentials.
- A provider folder scaffold for future implementation.

See [`docs/provider-integration.md`](docs/provider-integration.md) for implementation details.

## Quick start

1. Copy environment template:
   - `cp .env.example .env`
2. Fill in credentials when you are ready to integrate:
   - Spotify: client ID/secret + redirect URI
   - YouTube: API key or OAuth client credentials
3. Implement provider adapters in `src/providers/` using the documented contract.

## Planned provider adapters

- `SpotifyProvider` (catalog search, metadata, playback controls where allowed).
- `YouTubeProvider` (search, metadata, stream URL handoff/player integration).

## Notes

This project currently contains planning and scaffolding. Runtime streaming behavior must follow each platform's Terms of Service, SDK requirements, and licensing limits.
