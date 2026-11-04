# Deploying IR Pacific Operations to DigitalOcean App Platform

## 1. Create the GitHub repository
1. github.com -> New repository -> name `irpacific-app`, owner `joesaundersak`, **Private**, no README/.gitignore.
2. Unzip `irpacific-app-v<version>.zip` on your computer and push it:
   ```bash
   cd irpacific-app
   git init -b main
   git add .
   git commit -m "IR Pacific Operations v<version>"
   git remote add origin https://github.com/joesaundersak/irpacific-app.git
   git push -u origin main
   ```
   (No git? Use GitHub's "uploading an existing file" link and drag in the unzipped folder contents. Include the hidden `.do` folder.)

## 2. Connect GitHub to DigitalOcean
cloud.digitalocean.com -> Apps -> Create App -> GitHub -> "Edit your GitHub permissions" -> install the DigitalOcean app
for `joesaundersak` with access to `irpacific-app`. Cancel the wizard after granting access.

## 3. Create the database
Databases -> Create Database Cluster -> PostgreSQL 16, region **SFO**, Basic 1 GB, name it exactly `irpacific-db`.
Wait until it shows "Online" (a few minutes).

## 4. Create the app from the spec
1. Apps -> Create App -> choose GitHub -> repo `joesaundersak/irpacific-app`, branch `main`, check Autodeploy.
2. When DigitalOcean shows detected components, open the **App Spec** editor (Settings -> App Spec -> Edit) and paste
   the contents of `.do/app.yaml`, or use doctl: `doctl apps create --spec .do/app.yaml`.
3. Replace every `CHANGE_ME` value under Environment Variables (they are encrypted there):
   - `AUTH_SECRET` and `NEXTAUTH_SECRET`: the same random value (`openssl rand -base64 32`).
   - `SEED_USER_PASSWORD` (on the db-migrate job): initial password for the 4 team accounts.
   - `RESEND_API_KEY`: see step 6 (or leave `CHANGE_ME` for now; emails will just fail until set).
   - `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: only needed if you will not use Resend.
4. Create the app. The first deploy runs the `db-migrate` job (creates tables, roles, the 4 users, settings) and then
   starts the web service. Check Activity -> Deploy logs if anything fails.
5. In Databases -> irpacific-db -> Settings -> Trusted Sources, make sure the app `irpacific-app` is listed.

## 5. Point app.irpacific.com at the app
1. App -> Settings -> Domains: `app.irpacific.com` is already listed from the spec. DigitalOcean shows a CNAME target
   like `irpacific-app-xxxxx.ondigitalocean.app`.
2. At your DNS provider for irpacific.com add: Type `CNAME`, Host `app`, Value = that target. Leave the main website
   records alone.
3. Wait for the domain to show "Active" (SSL certificate is issued automatically, usually under 30 minutes).

## 6. Email (meeting summaries)
DigitalOcean blocks outbound SMTP ports (25/465/587), so Office 365 SMTP will most likely not work from App Platform.
Recommended: resend.com (free tier 3,000 emails/month)
1. Sign up -> Domains -> Add `irpacific.com` -> add the DNS records it shows (SPF/DKIM) at your DNS provider -> Verify.
2. API Keys -> Create (Sending access) -> copy the key into `RESEND_API_KEY` in the app's environment variables.
3. Set `EMAIL_FROM` to the sender address (e.g. operations@irpacific.com). Saving env vars redeploys the app.

## 7. First login and data load
1. Open https://app.irpacific.com and sign in as joe@irpacific.com with `SEED_USER_PASSWORD`.
2. Imports -> upload the BuilderTrend exports in this order: Jobsites, WIP, Schedule, Leads (expanded).
3. Share the URL and initial password with Matt, Trisha and Michele.

## Updating the app
Each update arrives as a new zip. Unzip it over your local `irpacific-app` folder (keep the `.git` folder), then:
```bash
git add -A
git commit -m "Update to v<version>"
git push
```
DigitalOcean auto-deploys every push to `main`; the db-migrate job applies schema changes before the new version
goes live. Data in the database is kept between deploys.

## Troubleshooting
- **Build fails on `prisma generate`**: check the Node version in logs is 22.x (set by `engines` in package.json).
- **`permission denied for schema public`**: you are using an App Platform *dev* database; use the managed cluster from step 3.
- **Login loops back to /login**: `AUTH_SECRET` missing, or `NEXTAUTH_URL`/`AUTH_URL` don't match the URL you are using.
- **Before the domain is active**: temporarily set `NEXTAUTH_URL` and `AUTH_URL` to the `.ondigitalocean.app` URL.
