# MagicBrush Backend

## Vercel deployment

Deploy this folder as its own Vercel project.

1. In Vercel, import the repository.
2. Set the project Root Directory to `magicbrush-backend`.
3. Add all required environment variables from `src/lib/env.ts`.
4. Deploy.

This folder now exposes the auth, admin, contact, services, portfolio, upload, and test Firebase APIs through Next.js route handlers, which makes it compatible with Vercel serverless deployment.
