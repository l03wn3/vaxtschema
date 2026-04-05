#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Pulling latest..."
git pull
echo "Installing dependencies..."
npm install --no-optional
echo "Building..."
npx vite build
echo "Reloading nginx..."
sudo systemctl reload nginx
echo "Done! Växtmanual deployed."
