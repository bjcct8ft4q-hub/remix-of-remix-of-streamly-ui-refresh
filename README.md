# Streamly

Streamly is an anime discovery and streaming website with personalized recommendations, watchlists, episode pages, profiles, seasonal themes, and an admin dashboard.

## Development

Install dependencies and start the local development server:

```sh
bun install
bun run dev
```

Build for production:

```sh
bun run build
```

## Services

Streamly uses Supabase for account authentication and database-backed features. Features that require database setup should be labeled **Requires Supabase connection** until configured.

The website is deployed through Vercel from the GitHub repository.
