# Ithomiini Maps - Setup Guide

This guide provides detailed instructions for setting up all external services required for the Ithomiini Maps project. Follow these steps to enable all features.

## Table of Contents

1. [GitHub Personal Access Token (Classic)](#1-github-personal-access-token-classic)
2. [Cloudflare Worker Setup](#2-cloudflare-worker-setup)
3. [Map Provider API Keys](#3-map-provider-api-keys)
   - [Stadia Maps](#stadia-maps)
   - [MapTiler](#maptiler)

---

## 1. GitHub Personal Access Token (Classic)

The database update feature requires a GitHub Personal Access Token to trigger GitHub Actions workflows. We use the **Classic** token type because it supports organization repositories.

> **Why Classic?** Fine-grained tokens are limited to personal repositories. If this repository is in a GitHub Organization, you must use a Classic token to access it.

### Step-by-Step Instructions

#### 1.1 Navigate to Token Settings

1. Log in to your GitHub account at [github.com](https://github.com)
2. Click on your **profile picture** in the top-right corner
3. Select **Settings** from the dropdown menu
4. In the left sidebar, scroll down and click **Developer settings** (at the very bottom)
5. In the left sidebar, click **Personal access tokens**
6. Click **Tokens (classic)**

   ![Path: Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)]

#### 1.2 Generate a New Classic Token

1. Click the **Generate new token** button
2. Select **Generate new token (classic)** from the dropdown
3. You may be prompted to confirm your password or 2FA

#### 1.3 Configure the Token

Fill in the following settings:

| Field | Value |
|-------|-------|
| **Note** | `Ithomiini DB Updater` (or any descriptive name) |
| **Expiration** | Select your preference (90 days, 1 year, or No expiration) |

#### 1.4 Select Scopes (Permissions)

Check the following scopes:

- [x] **repo** - Full control of private repositories
  - This is required to trigger workflows on the repository
- [x] **workflow** - Update GitHub Action workflows
  - This allows triggering workflow dispatch events

> **Note:** If the repository is public, you technically only need `public_repo` instead of full `repo`, but `repo` works for both public and private repositories.

#### 1.5 Generate and Copy the Token

1. Scroll down and click **Generate token**
2. **IMPORTANT:** Copy the token immediately! It will only be shown once.
3. The token will look like: `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
4. Store it securely (password manager recommended)

#### 1.6 For Organization Repositories

If the repository belongs to a GitHub Organization:

1. The organization may require **SSO authorization** for the token
2. After generating the token, look for a **Configure SSO** button next to it
3. Click it and authorize the token for your organization
4. Without this step, the token won't work with organization repositories

---

## 2. Cloudflare Worker Setup

The Cloudflare Worker acts as a secure proxy between the web application and GitHub's API. It validates the password and triggers the database update workflow.

### Why Use a Cloudflare Worker?

- **Security**: Keeps your GitHub token secret (never exposed to the browser)
- **Password Protection**: Only users who know the password can trigger updates
- **Free**: Cloudflare Workers free tier includes 100,000 requests/day

### Step-by-Step Instructions

#### 2.1 Create a Cloudflare Account

1. Go to [cloudflare.com](https://www.cloudflare.com)
2. Click **Sign Up** in the top-right corner
3. Enter your email and create a password
4. Verify your email address

#### 2.2 Navigate to Workers & Pages

1. After logging in, you'll be on the Cloudflare Dashboard
2. In the left sidebar, click **Workers & Pages**
   - If you don't see it, look for a hamburger menu (≡) to expand the sidebar
3. You'll see the Workers & Pages overview page

#### 2.3 Create a New Worker

1. Click the **Create** button (blue button, top-right area)
2. You'll see options for "Workers" and "Pages" - select **Workers**
3. Click **Create Worker**

#### 2.4 Configure the Worker

1. **Name your Worker**: Enter `ithomiini-db-updater`
   - This will create a URL like: `https://ithomiini-db-updater.<your-subdomain>.workers.dev`
2. Click **Deploy** to create the worker with the default "Hello World" code
   - We'll replace this code in the next step

#### 2.5 Edit the Worker Code

1. After deployment, you'll see a success message
2. Click **Edit code** (or go to the worker and click "Quick Edit")
3. Delete all the default code in the editor
4. Copy the entire contents from `scripts/cloudflare-worker.js` in this repository
5. Paste it into the editor
6. Click **Save and Deploy** (top-right corner)

#### 2.6 Set Environment Variables (Secrets)

Environment variables store sensitive data like your GitHub token securely.

1. Go back to your Worker's main page (click the worker name in breadcrumbs)
2. Click **Settings** in the top tab bar
3. In the left sidebar, click **Variables**
4. Scroll down to **Environment Variables**
5. Click **Add variable** for each of the following:

| Variable Name | Value | Type |
|---------------|-------|------|
| `UPDATE_PASSWORD` | `Hyalyris` | Encrypt |
| `GITHUB_TOKEN` | `ghp_your_token_here` | Encrypt |
| `GITHUB_OWNER` | `Fr4nzz` (or your org name) | Plain text |
| `GITHUB_REPO` | `ithomiini_maps` | Plain text |

**Important:** Click **Encrypt** for sensitive values (password and token) to hide them from view.

6. Click **Save and Deploy** after adding all variables

#### 2.7 Get Your Worker URL

1. Go to your Worker's main page
2. The URL is shown at the top, something like:
   ```
   https://ithomiini-db-updater.<your-subdomain>.workers.dev
   ```
3. Copy this URL - you'll need it for the frontend configuration

#### 2.8 Update the Frontend Code

1. Open `src/components/Sidebar.vue` in your code editor
2. Find the line containing the Worker URL (around line 98):
   ```javascript
   const WORKER_URL = 'https://ithomiini-db-updater.YOUR-SUBDOMAIN.workers.dev/'
   ```
3. Replace `YOUR-SUBDOMAIN` with your actual Cloudflare subdomain
4. Commit and push the change

#### 2.9 Test the Worker

You can test your worker directly:

```bash
curl -X POST https://ithomiini-db-updater.<your-subdomain>.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"password": "Hyalyris", "update_sanger": true, "update_gbif": false}'
```

Expected response:
```json
{"success": true, "message": "Workflow triggered successfully", "run_id": 12345678}
```

---

## 3. Map Provider API Keys

The application uses map tile providers for base layers. Some providers require API keys for production use.

### Free Tiers Summary

| Provider | Free Tier | API Key Required | Notes |
|----------|-----------|------------------|-------|
| CartoDB | Unlimited | No | Default dark/light themes |
| OpenStreetMap | Fair use | No | Streets layer |
| Esri | Fair use | No | Satellite imagery |
| Stadia Maps | 2,500 sessions/month | Yes | Terrain, Smooth Dark |
| MapTiler | 100,000 loads/month | Yes | Many premium styles |

> **Note:** The application works without API keys using the free providers. API keys are only needed if you want to use Stadia Maps or MapTiler premium styles.

---

### Stadia Maps

Stadia Maps offers high-quality map tiles with generous free tier.

#### 3.1 Create an Account

1. Go to [client.stadiamaps.com/signup](https://client.stadiamaps.com/signup/)
2. Fill in your email and create a password
3. Verify your email address
4. No credit card required for free tier

#### 3.2 Create a Property

A "Property" in Stadia Maps represents your website/application.

1. After logging in, click **Add Property**
2. Enter a name: `Ithomiini Maps`
3. Click **Create Property**

#### 3.3 Add Your Domain (Authentication Configuration)

This is the key step for production deployment. Stadia Maps uses **domain-based authentication** for browser requests.

1. In your Property, go to **Authentication Configuration**
2. Click **Create Domain**
3. **Configure the domain fields:**

   For a GitHub Pages URL like `https://fr4nzz.github.io/ithomiini_maps/`:

   | Field | Value | Explanation |
   |-------|-------|-------------|
   | **Subdomain** | `fr4nzz` | The part before `.github.io` |
   | **Domain** | `github.io` | The main domain |
   | **Allow All Subdomains** | OFF | Not needed for a single site |

   The "Matches" preview should show: `fr4nzz.github.io`

4. Click **Save Domain**

> **How Domain Authentication Works:**
> When your site at `fr4nzz.github.io` requests tiles from Stadia, their server checks the `Referer` header. If it matches an authorized domain, the request is allowed WITHOUT needing an API key in the URL. This is more secure than exposing API keys in client-side code.

#### 3.4 Generate an API Key

API keys are used for:
- Local development (localhost)
- Server-side requests
- Mobile/desktop apps (non-browser)

1. In your Property, click **API Keys** tab
2. Click **Generate API Key**
3. Copy the API key (looks like: `2faaf442-9d21-42a1-81a3-3a5094cfa91b`)

#### 3.5 Understanding When API Keys Are Needed

| Environment | API Key Needed? | Why? |
|-------------|-----------------|------|
| **Production (GitHub Pages)** | No* | Domain authentication handles it |
| **localhost development** | No | Stadia allows localhost without auth |
| **Custom domain** | No* | Add domain to Authentication Configuration |
| **Server-side requests** | Yes | No Referer header to verify |
| **Mobile/desktop apps** | Yes | Not browser-based |

\* As long as the domain is added to Authentication Configuration

#### 3.6 Local Development Setup

For local development, you have two options:

**Option A: No API key (recommended)**
- Stadia Maps allows `localhost` requests without authentication
- Just use the tile URLs directly, no configuration needed

**Option B: Use API key in .env.local**
```bash
# Create .env.local file in project root
echo "VITE_STADIA_KEY=your-api-key-here" >> .env.local
```
Then use the key in your tile URLs:
```javascript
`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_KEY}`
```

#### 3.7 Production Deployment (GitHub Pages)

For GitHub Pages deployment, you do NOT need to expose your API key:

1. Add your domain in Authentication Configuration (step 3.3)
2. Use tile URLs WITHOUT the `?api_key=` parameter:
   ```javascript
   'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png'
   ```
3. Stadia will authenticate requests based on the domain

> **Important:** Your `.env.local` file is NOT deployed to GitHub Pages (it's in `.gitignore`). For production, rely on domain authentication instead.

#### 3.8 Available Stadia Styles

These tile URLs work with domain authentication (no API key in URL) or with an API key:

```javascript
// Alidade Smooth (light theme)
'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png'

// Alidade Smooth Dark (dark theme)
'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'

// Stamen Terrain
'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png'

// Stamen Toner (black and white)
'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png'

// OSM Bright
'https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png'
```

#### 3.9 Understanding Stadia Rate Limits

- **2,500 credits/month** on free tier
- **1 credit = 1 map session** (not per tile!)
- A session includes all zoom/pan interactions
- Session timeout: 2 hours of inactivity
- Localhost development: Doesn't count against quota

---

### MapTiler

MapTiler provides beautiful vector and raster map tiles.

#### 3.1 Create an Account

1. Go to [cloud.maptiler.com](https://cloud.maptiler.com/)
2. Click **Sign up for FREE**
3. You can sign up with:
   - Email/password
   - Google account
   - GitHub account
4. Verify your email if using email signup

#### 3.2 Get Your API Key

1. After logging in, you're on the Dashboard
2. Your API key is displayed prominently on the main page
3. It looks like: `AbCdEfGhIjKlMnOp`
4. Click the **Copy** button to copy it

#### 3.3 Configure Authorized URLs (Optional but Recommended)

To prevent API key abuse:

1. Click **Account** in the sidebar
2. Click **API Keys**
3. Click on your key to edit it
4. Under **Authorized URLs**, add:
   - `https://fr4nzz.github.io/*`
   - `http://localhost:*` (for development)
5. Click **Save**

#### 3.4 Add to Your Project

Option A: Environment Variable (recommended)
```bash
# Create .env.local file in project root
echo "VITE_MAPTILER_KEY=your-api-key-here" >> .env.local
```

Option B: Direct in code (not recommended for public repos)
```javascript
// In your map configuration
const maptilerKey = 'your-api-key-here'
```

#### 3.5 Available MapTiler Styles

With your API key, you can use these style URLs:

```javascript
// Streets
`https://api.maptiler.com/maps/streets/style.json?key=${maptilerKey}`

// Basic (clean, simple)
`https://api.maptiler.com/maps/basic/style.json?key=${maptilerKey}`

// Satellite
`https://api.maptiler.com/maps/satellite/style.json?key=${maptilerKey}`

// Toner (black and white)
`https://api.maptiler.com/maps/toner/style.json?key=${maptilerKey}`

// Topo (topographic)
`https://api.maptiler.com/maps/topo/style.json?key=${maptilerKey}`
```

#### Understanding MapTiler Rate Limits

- **100,000 map loads/month** on free tier
- **1 map load = 1 page view** (not per tile!)
- All zoom/pan/rotate interactions within a session are free
- When using third-party SDKs (like MapLibre directly without MapTiler SDK), tiles may be counted individually

---

## Environment Variables Summary

Create a `.env.local` file in your project root:

```bash
# Map Provider API Keys (optional - only if using premium styles)
VITE_STADIA_KEY=your-stadia-api-key
VITE_MAPTILER_KEY=your-maptiler-api-key
```

> **Note:** `.env.local` is already in `.gitignore` and won't be committed to the repository.

---

## Troubleshooting

### GitHub Token Issues

| Problem | Solution |
|---------|----------|
| Token doesn't work | Check if token has `repo` and `workflow` scopes |
| 404 error on workflow trigger | Verify repository name and owner are correct |
| 403 Forbidden | For org repos, authorize token for SSO |
| Token expired | Generate a new token and update Cloudflare Worker |

### Cloudflare Worker Issues

| Problem | Solution |
|---------|----------|
| CORS error in browser | Ensure worker code includes CORS headers |
| 500 Internal Server Error | Check worker logs in Cloudflare dashboard |
| Environment variables not working | Make sure you clicked "Save and Deploy" |
| "Unauthorized" response | Check UPDATE_PASSWORD variable matches |

### Map Tiles Issues

| Problem | Solution |
|---------|----------|
| Tiles not loading | Check API key is correct and not expired |
| 403 Forbidden on tiles | Add your domain to authorized URLs |
| Rate limit exceeded | Wait for monthly reset or upgrade plan |
| Tiles work locally but not in production | Add production domain to authorized URLs |

---

## Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Use encrypted variables** in Cloudflare Workers for sensitive data
3. **Rotate tokens regularly** - Set calendar reminders for expiration
4. **Limit token scopes** - Only grant necessary permissions
5. **Monitor usage** - Check Cloudflare and map provider dashboards regularly
6. **Restrict domains** - Configure authorized URLs in map providers

---

## Quick Reference

After setup, you should have:

- [ ] GitHub Classic Token with `repo` and `workflow` scopes
- [ ] Cloudflare Worker deployed with 4 environment variables
- [ ] Worker URL updated in `src/components/Sidebar.vue`
- [ ] (Optional) Stadia Maps API key in `.env.local`
- [ ] (Optional) MapTiler API key in `.env.local`

---

## Need Help?

- **GitHub Issues**: [ithomiini_maps/issues](https://github.com/Fr4nzz/ithomiini_maps/issues)
- **Cloudflare Docs**: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers/)
- **Stadia Maps Docs**: [docs.stadiamaps.com](https://docs.stadiamaps.com/)
- **MapTiler Docs**: [docs.maptiler.com](https://docs.maptiler.com/)
