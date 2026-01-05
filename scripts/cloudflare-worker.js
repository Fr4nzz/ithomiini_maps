/**
 * Cloudflare Worker: Database Update Trigger
 *
 * This worker acts as a secure proxy between the frontend and GitHub Actions.
 * It verifies the password and triggers the GitHub workflow using a Personal Access Token.
 *
 * SETUP INSTRUCTIONS:
 * 1. Go to https://dash.cloudflare.com/ and create a new Worker
 * 2. Name it: ithomiini-db-updater
 * 3. Paste this code into the worker
 * 4. Set the environment variables (see below)
 * 5. Deploy the worker
 *
 * ENVIRONMENT VARIABLES (set in Worker Settings > Variables):
 * - UPDATE_PASSWORD: "Hyalyris" (or your chosen password)
 * - GITHUB_TOKEN: Your GitHub Personal Access Token with 'repo' scope
 * - GITHUB_OWNER: "Fr4nzz" (your GitHub username)
 * - GITHUB_REPO: "ithomiini_maps" (repository name)
 *
 * CREATE A GITHUB PERSONAL ACCESS TOKEN:
 * 1. Go to https://github.com/settings/tokens?type=beta
 * 2. Click "Generate new token" (Fine-grained tokens)
 * 3. Name: "Ithomiini DB Updater"
 * 4. Repository access: Select "ithomiini_maps" only
 * 5. Permissions: Actions (Read and write)
 * 6. Generate token and copy it to Cloudflare Worker env vars
 */

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const body = await request.json();
      const { password, update_sanger, update_gbif } = body;

      // Verify password
      if (password !== env.UPDATE_PASSWORD) {
        return new Response('Invalid password', {
          status: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }

      // Trigger GitHub Actions workflow
      const workflowUrl = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/update_data.yml/dispatches`;

      const response = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
          'User-Agent': 'Ithomiini-DB-Updater',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',  // Branch to run on
          inputs: {
            update_sanger: String(update_sanger !== false),
            update_gbif: String(update_gbif === true),
          },
        }),
      });

      if (response.status === 204) {
        // Success - GitHub returns 204 No Content for successful workflow dispatch
        return new Response('Update triggered successfully', {
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      } else {
        const error = await response.text();
        return new Response(`GitHub API error: ${error}`, {
          status: response.status,
          headers: { 'Access-Control-Allow-Origin': '*' },
        });
      }
    } catch (err) {
      return new Response(`Error: ${err.message}`, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }
  },
};
