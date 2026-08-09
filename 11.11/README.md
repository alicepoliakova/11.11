This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Database (Sproochen flashcards)

This app stores flashcard topics/cards in SQLite via Drizzle ORM + `@libsql/client`.

**Local development** uses a local file — no setup needed beyond `.env.local`
(see `.env.local.example`). Run `npm run db:migrate` then `npm run db:seed` once
to create and populate `local.db`.

**Production (Vercel)** needs a hosted Turso database, since Vercel's filesystem
is ephemeral:

1. Install the Turso CLI and sign in: see https://docs.turso.tech/cli/installation
2. Create a database: `turso db create sproochen`
3. Get the connection URL: `turso db show sproochen --url`
4. Create an auth token: `turso db tokens create sproochen`
5. In the Vercel project settings, add environment variables:
   - `DATABASE_URL` — the `libsql://...` URL from step 3
   - `DATABASE_AUTH_TOKEN` — the token from step 4
   - `ADMIN_PASSWORD` — your chosen admin password
   - `ADMIN_SECRET` — output of `openssl rand -hex 32`
6. Run migrations and seed against the Turso database from your machine, with
   those same values exported locally:
   ```bash
   export DATABASE_URL=libsql://...
   export DATABASE_AUTH_TOKEN=...
   npm run db:migrate
   npm run db:seed
   ```
7. Deploy. `/admin` is protected by `ADMIN_PASSWORD`; `/` and `/study/**` are public.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
