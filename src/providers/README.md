# Providers scaffold

Place provider-specific integrations in this folder.

Suggested structure:

- `src/providers/base/ProviderAdapter.ts`
- `src/providers/spotify/SpotifyProviderAdapter.ts`
- `src/providers/youtube/YouTubeProviderAdapter.ts`
- `src/providers/ProviderFactory.ts`

Each adapter should implement the shared contract described in `docs/provider-integration.md`.
