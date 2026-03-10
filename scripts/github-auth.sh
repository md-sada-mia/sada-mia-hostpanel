#!/usr/bin/env bash
# Run this once after getting your GitHub Personal Access Token (PAT)
echo "Setting up GitHub Authentication..."

# Enable credential caching (saves it to ~/.git-credentials)
git config --global credential.helper store

echo ""
echo "Credential helper enabled. In your next 'git push', when prompted:"
echo "1. Username: Enter your GitHub username"
echo "2. Password: Paste your Personal Access Token (PAT)"
echo ""
echo "It will automatically save the token for all future pushes."
7