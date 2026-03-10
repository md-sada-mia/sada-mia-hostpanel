'use strict';
/**
 * GitHub API routes — OAuth flow and repository fetching
 */
const express = require('express');
const router = express.Router();
const config = require('../config');
const { auth } = require('../middleware/auth');

// We use dynamic imports for node-fetch or we can use native fetch if Node 18+
// In HostPanel we assume Node 20+, so native `fetch` is available globally.

// Redirects user to GitHub for OAuth
router.get('/auth', auth, (req, res) => {
  const clientId = config.githubClientId;
  if (!clientId) {
    return res.status(400).json({ error: 'GitHub Client ID not configured.' });
  }
  
  const scopes = 'repo';
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scopes}`;
  res.json({ url });
});

// OAuth Callback (receives code, exchanges for token)
// This doesn't use the `auth` middleware because GitHub redirects here directly.
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code parameter');

  const clientId = config.githubClientId;
  const clientSecret = config.githubClientSecret;

  if (!clientId || !clientSecret) {
    return res.status(500).send('GitHub OAuth is not configured on the panel.');
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(400).send(`GitHub OAuth Error: ${data.error_description}`);
    }

    // Save the access token to config globally
    config.saveConfig({ githubAccessToken: data.access_token });

    // Redirect back to panel root
    res.redirect('/');
  } catch (error) {
    console.error('GitHub Callback Error:', error);
    res.status(500).send('Internal Server Error during GitHub authentication.');
  }
});

// Disconnect GitHub
router.delete('/auth', auth, (req, res) => {
  config.saveConfig({ githubAccessToken: '' });
  res.json({ success: true });
});

// --- Authenticated GitHub API Wrappers ---

// List repositories
router.get('/repos', auth, async (req, res) => {
  const token = config.githubAccessToken;
  if (!token) return res.status(401).json({ error: 'Not connected to GitHub.' });

  try {
    const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        config.saveConfig({ githubAccessToken: '' }); // token invalid
        return res.status(401).json({ error: 'GitHub token expired or revoked.' });
      }
      return res.status(response.status).json({ error: 'Failed to fetch repositories' });
    }

    const repos = await response.json();
    res.json(repos.map(r => ({
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      clone_url: r.clone_url,
      default_branch: r.default_branch,
      updated_at: r.updated_at
    })));
  } catch (error) {
    console.error('GitHub Repos API Error:', error);
    res.status(500).json({ error: 'Failed to fetch repositories from GitHub.' });
  }
});

// List branches for a specific repo
router.get('/repos/:owner/:repo/branches', auth, async (req, res) => {
  const token = config.githubAccessToken;
  if (!token) return res.status(401).json({ error: 'Not connected to GitHub.' });

  const { owner, repo } = req.params;

  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch branches' });
    }

    const branches = await response.json();
    res.json(branches.map(b => b.name));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches from GitHub.' });
  }
});

module.exports = router;
