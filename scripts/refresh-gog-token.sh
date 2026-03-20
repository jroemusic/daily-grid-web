#!/bin/bash
# Script to refresh GOG token for calendar access
# This will open Chrome for OAuth authentication

echo "🔐 Refreshing GOG token for calendar access..."
echo "📱 Chrome will open for Google OAuth"
echo ""
echo "Please:"
echo "1. Sign in to your Google account (jroemusic@gmail.com)"
echo "2. Grant calendar read permissions only"
echo "3. Copy the authorization code if prompted"
echo ""

# Run GOG auth add - this will open Chrome for OAuth
gog auth add jroemusic@gmail.com

echo ""
echo "✅ Token refresh complete!"
echo ""
echo "Testing calendar access..."
gog calendar events today --json > /dev/null 2>&1

if [ $? -eq 0 ]; then
  echo "✅ Calendar access working!"
else
  echo "❌ Calendar access failed - please try again"
fi
