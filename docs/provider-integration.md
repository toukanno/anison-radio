# Provider integration blueprint (Spotify + YouTube)

## Goal

Enable a single app experience for anime song discovery and playback while allowing multiple backend music providers.

## Architecture

Use a provider adapter layer so UI and business logic call one shared contract.

```text
UI / API layer
   -> MusicService (provider-agnostic)
      -> ProviderAdapter interface
         -> SpotifyProviderAdapter
         -> YouTubeProviderAdapter
```

## Shared adapter contract

Implement the following methods for each provider:

- `authenticate(): Promise<AuthSession>`
- `refreshToken(session): Promise<AuthSession>`
- `searchTracks(query, options): Promise<Track[]>`
- `getTrack(id): Promise<Track | null>`
- `getPlaylist(id): Promise<Playlist | null>`
- `getRecommendations(seed, options): Promise<Track[]>`
- `getStreamReference(trackId): Promise<StreamReference>`

`StreamReference` should store provider-specific playback information (e.g., Spotify URI, YouTube video ID) and avoid exposing secrets to clients.

## Data model normalization

Define internal models once and map provider data into them:

- `Track`
  - `id` (internal stable ID)
  - `provider` (`spotify` | `youtube`)
  - `providerTrackId`
  - `title`
  - `artists[]`
  - `album`
  - `durationMs`
  - `imageUrl`
  - `previewUrl` (optional)
  - `explicit` (optional)
- `Playlist`
  - `id`, `provider`, `providerPlaylistId`, `name`, `tracks[]`

## Auth strategy

### Spotify

- Use OAuth Authorization Code flow.
- Store encrypted refresh tokens server-side.
- Use minimal scopes first; expand only when needed.

### YouTube

- For public metadata search: API key can be enough.
- For account-level features: OAuth 2.0 required.
- Keep API key and OAuth credentials separate.

## Configuration

Use `.env` keys from `.env.example`:

- Spotify: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI`
- YouTube: `YOUTUBE_API_KEY`, `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REDIRECT_URI`
- App defaults: `MUSIC_PROVIDER_DEFAULT`, `MUSIC_PROVIDER_FALLBACK`

## Suggested implementation order

1. Add provider registry/factory (`spotify`, `youtube`).
2. Implement `searchTracks` + `getTrack` for both providers.
3. Add normalization/mapping unit tests.
4. Add auth and token refresh lifecycle.
5. Add playback handoff using `StreamReference`.

## Compliance reminders

- Respect Spotify and YouTube Terms of Service.
- Do not bypass official playback SDK requirements.
- Enforce region/licensing restrictions where applicable.
