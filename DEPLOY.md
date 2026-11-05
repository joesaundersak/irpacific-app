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
   Use git from the command line (above) so hidden files such as `.do/` and `.gitignore` are included; Finder and
   GitHub's web upload often skip them.

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
   - `SMTP_USER`: `info@irpnw.com` (the Office 365 mailbox that sends the emails; pre-filled in the spec).
   - `SMTP_PASSWORD`: the password for info@irpnw.com.
   - `SMTP_FROM`: `info@irpnw.com` (pre-filled; keep it equal to `SMTP_USER`).
4. Create the app. The first deploy runs the `db-migrate` job (creates tables, roles, the 4 users, settings) and then
   starts the web service. Check Activity -> Deploy logs if anything fails.
5. In Databases -> irpacific-db -> Settings -> Trusted Sources, make sure the app `irpacific-app` is listed.

## 5. Point app.irpacific.com at the app
1. App -> Settings -> Domains: `app.irpacific.com` is already listed from the spec. DigitalOcean shows a CNAME target
   like `irpacific-app-xxxxx.ondigitalocean.app`.
2. At your DNS provider for irpacific.com add: Type `CNAME`, Host `app`, Value = that target. Leave the main website
   records alone.
3. Wait for the domain to show "Active" (SSL certificate is issued automatically, usually under 30 minutes).

## 6. Email (meeting summaries) via Office 365 SMTP
The app sends through `smtp.office365.com` port 587 (STARTTLS, TLS 1.2+), logged in as `SMTP_USER`.
1. **Enable Authenticated SMTP on the mailbox**: Microsoft 365 admin center -> Users -> Active users -> select the
   sender mailbox (info@irpnw.com) -> Mail -> Manage email apps -> check **Authenticated SMTP** -> Save. (If Security Defaults are on in
   Microsoft Entra ID, SMTP AUTH is blocked tenant-wide until they are turned off or replaced with Conditional Access.)
2. If info@irpnw.com uses MFA, password login over SMTP will be rejected; turn MFA off for that mailbox (or use another
   licensed mailbox without MFA and update `SMTP_USER`/`SMTP_FROM`).
3. **Ask DigitalOcean to unblock outbound SMTP**: DigitalOcean blocks ports 25/465/587 by default. Open a ticket at
   cloud.digitalocean.com/support -> "Networking" and ask them to allow outbound SMTP on port 587 for your account
   so the app `irpacific-app` can send through your own Office 365 tenant (smtp.office365.com). Until they do,
   sending shows: "Could not reach smtp.office365.com:587 ... the hosting provider may be blocking outbound SMTP".
4. Test: open a meeting -> Send Summary. Errors are shown in the app and in the app's Runtime Logs.

## 7. First login and data load
1. Open https://app.irpacific.com and sign in as joe@irpacific.com with `SEED_USER_PASSWORD`.
2. Imports -> upload the BuilderTrend exports in this order: Jobsites, WIP, Schedule, Leads (expanded).
3. Share the URL and initial password with Matt, Trisha and Michele.

## Resetting a password
The seed never changes existing accounts, so re-running it will not fix a password. Instead: DigitalOcean -> your app
-> **Console** tab -> component `web`, then run one of:
```bash
npm run users:reset-password -- joe@irpacific.com 'NewPassword123!'   # one user
npm run users:reset-password -- all 'NewPassword123!'                 # all users
```
It prints "Password updated for N user(s)." If it says no user was found, it lists the accounts that exist; if there
are none, run `npm run db:seed` in the same console first.

## Updating the app
Each update arrives as a new zip. **Check the live version** at the bottom of the left sidebar ("Version x.y.z"):
if it does not show the version you just pushed, the new build has not gone live (check DigitalOcean -> Activity).

The zip has more than 100 files, and GitHub's web "Upload files" page accepts only 100 at a time and skips files
whose names start with a dot, so a web upload easily leaves an old `package.json` behind. Use git or GitHub Desktop:
1. In your local clone, delete everything except the `.git` folder.
2. Unzip the new zip and copy the contents of its `irpacific-app` folder into the clone.
3. Commit and push:
```bash
git add -A
- **Build fails with `npm error ERESOLVE` (e.g. `cmdk`, `vaul`, `react-day-picker`)**: the repo still has an old
  `package.json`/`package-lock.json`. Replace them with the ones from the latest zip (see "Updating the app").
  Do not add `npm_config_legacy_peer_deps`.
- **Import says "database structure is out of date"**: the run command is not `npm start`. In DigitalOcean -> app ->
  Settings -> `web` -> Run Command, set it to `npm start`, or run `npm run db:push` once in the Console tab.
```
(GitHub Desktop: the changes appear automatically; write a summary, **Commit to main**, then **Push origin**.)

DigitalOcean auto-deploys every push to `main`. The app brings the database structure up to date each time it
starts (`npm start` runs `prisma db push` first, never with data loss), so no separate migration step is needed.
Data in the database is kept between deploys.

## Troubleshooting
- **Build fails with `npm error ERESOLVE`**: an old zip is in the repo. Push the latest zip (v1.0.2 or later), which
  installs cleanly with plain npm. Do not add `npm_config_legacy_peer_deps`.
- **Build fails on `prisma generate`**: check the Node version in logs is 22.x (set by `engines` in package.json).
- **`permission denied for schema public`**: you are using an App Platform *dev* database; use the managed cluster from step 3.
- **Login loops back to /login**: `AUTH_SECRET` missing, or `NEXTAUTH_URL`/`AUTH_URL` don't match the URL you are using.
- **"Office 365 rejected the SMTP login"**: wrong password, Authenticated SMTP not enabled for the mailbox, MFA on the
  mailbox, or Security Defaults blocking SMTP AUTH (see step 6).
- **"5.7.60 SMTP; Client does not have permissions to send as this sender"**: `SMTP_FROM` differs from `SMTP_USER` and
  the mailbox lacks Send As rights. Set `SMTP_FROM` equal to `SMTP_USER`.
- **Before the domain is active**: temporarily set `NEXTAUTH_URL` and `AUTH_URL` to the `.ondigitalocean.app` URL.
