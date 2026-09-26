# Sift — Cloudflare Setup Guide

Sift uses two Cloudflare products, both usable on the free plan:

- **D1** (serverless SQLite) for pipeline state, the research archive, and the 7-day dedup index. Scripts reach it through the D1 REST API.
- **Pages** for hosting. Pages deploys the `site/` directory whenever you push to `main`.

## 1. Create the D1 Database

1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com) → **Storage & Databases** → **D1 SQL Database**
2. Click **Create** and name the database (for example `sift-db`)
3. Copy the **Database ID** from the overview page. It goes in `.env.local`.

Your **Account ID** is in the dashboard URL (`dash.cloudflare.com/<ACCOUNT_ID>/...`) or on any account overview page.

## 2. Create a Scoped API Token

1. Open **My Profile** → **API Tokens** → **Create Token** → **Create Custom Token**
2. Add one permission: **Account** → **D1** → **Edit**
3. Under **Account Resources**, include only your account
4. Create the token and copy it. Cloudflare shows it only once.

The pipeline never touches Pages through the API (deploys happen through git), so the token needs no other permissions.

## 3. Configure `.env.local`

```bash
cp .env.example .env.local
```

```ini
CF_ACCOUNT_ID=00000000000000000000000000000000
CF_API_TOKEN=your-cloudflare-api-token
CF_D1_DATABASE_ID=00000000-0000-0000-0000-000000000000
SITE_URL=https://example.com
YOUTUBE_API_KEY=your-youtube-data-api-key
```

`.env.local` is gitignored. Then create the schema (tables `editions`, `sections`, `content_index`):

```bash
npm install
npm run init-db
node scripts/d1-save.mjs status   # should connect and report no editions
```

## 4. Create the Cloudflare Pages Project

1. Push your clone to your own GitHub or GitLab repository
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select the repository
3. Build settings:
   - **Production branch:** `main`
   - **Build command:** *(leave empty; the pipeline commits finished HTML)*
   - **Build output directory:** `site`
4. **Save and Deploy**

The site deploys to a `*.pages.dev` URL immediately. Put that URL, or your custom domain, in `SITE_URL`.

## 5. (Optional) Custom Domain

Open your Pages project → **Custom domains** → **Set up a custom domain** → enter your domain (for example `digest.example.com`). If the domain's DNS is already on Cloudflare, the record is created for you. Otherwise, follow the prompts to add the zone and update your registrar's nameservers.

## 6. Keep It Private (default) or Make It Public

The site ships with `site/_headers` (`X-Robots-Tag: noindex`) and a `robots.txt` that blocks all crawlers, including AI scrapers. It is reachable by anyone with the URL but is not indexed. To keep it fully private, put the Pages project behind [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/). To make it public and indexable, edit both files.

## 7. First Run

Open Claude Code in the repository and paste the contents of `KICKOFF.md`. The orchestrator follows `instructions/DAILY-DIGEST-CREATOR.md` end to end: research, assembly, commit, push, and `scripts/check-deploy.mjs` to confirm the edition is live.

## Quick Reference

| Thing | Where to find it |
|-------|------------------|
| Account ID | Dashboard URL or account overview |
| D1 Database ID | Storage & Databases → D1 → your database |
| API token | My Profile → API Tokens |
| Pages URL | Workers & Pages → your project → Deployments |
| Custom domain | Workers & Pages → your project → Custom domains |
