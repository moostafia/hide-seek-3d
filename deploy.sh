#!/bin/bash

# Quick Deploy Script for Hide & Seek 3D
# This script helps you deploy to various platforms

echo "🎮 Hide & Seek 3D - Deployment Helper"
echo "======================================"
echo ""
echo "Choose your deployment platform:"
echo ""
echo "1) Render (Recommended - Free HTTPS)"
echo "2) Railway (Great WebSocket support)"
echo "3) Glitch (Instant deployment)"
echo "4) Heroku (Classic option)"
echo "5) Show me all deployment options"
echo ""
read -p "Enter your choice (1-5): " choice

case $choice in
  1)
    echo ""
    echo "📦 Deploying to Render..."
    echo ""
    echo "Steps:"
    echo "1. Go to: https://render.com"
    echo "2. Sign up/Login"
    echo "3. Click 'New +' → 'Web Service'"
    echo "4. Connect repository: moostafia/hide-seek-3d"
    echo "5. Render will auto-detect render.yaml"
    echo "6. Click 'Create Web Service'"
    echo ""
    echo "Your app will be live in ~5 minutes!"
    echo ""
    read -p "Press Enter to open Render in browser..." 
    xdg-open "https://render.com" 2>/dev/null || open "https://render.com" 2>/dev/null || echo "Please visit: https://render.com"
    ;;
    
  2)
    echo ""
    echo "🚂 Deploying to Railway..."
    echo ""
    echo "Steps:"
    echo "1. Go to: https://railway.app"
    echo "2. Click 'Start a New Project'"
    echo "3. Select 'Deploy from GitHub'"
    echo "4. Choose: moostafia/hide-seek-3d"
    echo "5. Click 'Deploy'"
    echo "6. Generate Domain in Settings"
    echo ""
    read -p "Press Enter to open Railway in browser..."
    xdg-open "https://railway.app" 2>/dev/null || open "https://railway.app" 2>/dev/null || echo "Please visit: https://railway.app"
    ;;
    
  3)
    echo ""
    echo "✨ Deploying to Glitch..."
    echo ""
    echo "Steps:"
    echo "1. Go to: https://glitch.com"
    echo "2. Click 'New Project' → 'Import from GitHub'"
    echo "3. Paste: https://github.com/moostafia/hide-seek-3d"
    echo "4. Glitch will auto-deploy"
    echo "5. Click 'Share' → 'Live App'"
    echo ""
    read -p "Press Enter to open Glitch in browser..."
    xdg-open "https://glitch.com" 2>/dev/null || open "https://glitch.com" 2>/dev/null || echo "Please visit: https://glitch.com"
    ;;
    
  4)
    echo ""
    echo "📦 Deploying to Heroku..."
    echo ""
    if ! command -v heroku &> /dev/null; then
      echo "⚠️  Heroku CLI not found. Please install it first:"
      echo "   https://devcenter.heroku.com/articles/heroku-cli"
      echo ""
      exit 1
    fi
    
    echo "Creating Heroku app..."
    heroku create hide-seek-3d-$(date +%s)
    
    echo ""
    echo "Deploying..."
    git push heroku HEAD:main
    
    echo ""
    echo "Opening app..."
    heroku open
    ;;
    
  5)
    echo ""
    echo "📚 All Deployment Options:"
    echo ""
    cat DEPLOYMENT.md
    ;;
    
  *)
    echo ""
    echo "❌ Invalid choice. Please run the script again."
    exit 1
    ;;
esac

echo ""
echo "✅ Done! Your game should be deploying now."
echo ""
echo "📋 Next steps:"
echo "   1. Wait for deployment to complete (2-5 minutes)"
echo "   2. Get your app URL from the platform"
echo "   3. Share the URL with friends!"
echo "   4. No sign-up required for players"
echo ""
