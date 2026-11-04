# IR Pacific Operations

Operations and team-accountability platform for Interior Resources (irpacific.com): sales pipeline,
projects (financial / schedule / contact), revenue forecast, AP calendar, weekly meetings with action items,
and BuilderTrend spreadsheet imports.

Production URL: https://app.irpacific.com (DigitalOcean App Platform, auto-deploys from `main`).

## Local development

```bash
cp .env.example .env      # fill in values
npm install               # also runs `prisma generate`
npm run db:push           # create/update tables
npm run db:seed           # create roles, 4 team accounts, default settings (safe to re-run)
npm run dev               # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run build` | `prisma generate` + production build |
| `npm start` | Runs the production server on `$PORT` (default 3000) |
| `npm run db:deploy` | Schema push + seed. Runs automatically on DigitalOcean before each deploy |

The seed never changes existing users, so re-running it does not reset passwords or roles.

See **DEPLOY.md** for the DigitalOcean + GitHub setup.
