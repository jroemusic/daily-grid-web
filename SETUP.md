# Daily Grid Web - Setup Guide

Complete setup guide for the Daily Grid Next.js application.

## Prerequisites

- Node.js 18+ installed
- Supabase account (free tier works)
- (Optional) Google Cloud project for calendar integration

## Quick Start

### 1. Install Dependencies

```bash
cd ~/dev/daily-grid-web
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to Project Settings → API
3. Copy the Project URL and anon public key

### 3. Configure Environment Variables

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local and add your Supabase credentials
nano .env.local
```

Add your credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Database Migration

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Run the migration script:

```bash
# Print the migration SQL
npm run migrate:setup
```

Copy the output and paste it into the Supabase SQL Editor, then run it.

### 5. Migrate Existing Data (Optional)

If you have existing data from the Flask app:

```bash
npm run migrate:data
```

This will migrate all templates and schedules from the Flask app to Supabase.

### 6. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000`

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

### Set Custom Domain (Optional)

In Vercel project settings:
1. Go to Domains
2. Add your domain (e.g., `grid.jandkay.com`)
3. Follow the DNS instructions

## Calendar Integration (Optional)

To enable Google Calendar integration:

### 1. Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project
3. Enable Google Calendar API

### 2. Create Service Account

1. Go to APIs & Services → Credentials
2. Create Credentials → Service Account
3. Download the JSON key file

### 3. Share Calendars

For each calendar you want to access:
1. Open Google Calendar settings
2. Share with the service account email
3. Grant "Make changes to events" permission

### 4. Configure Environment

Add to your `.env.local`:
```
GOOGLE_CALENDAR_CREDENTIALS={"type":"service_account","project_id":...}
```

Paste the entire service account JSON as a single line.

## Features

- ✅ Schedule creation and editing
- ✅ Template management
- ✅ Activity management with color coding
- ✅ PDF generation (client-side)
- ✅ Printable HTML view
- ✅ Responsive design
- 🔄 Calendar integration (optional, requires setup)

## Project Structure

```
daily-grid-web/
├── app/
│   ├── api/              # API routes
│   ├── editor/[date]/    # Schedule editor page
│   ├── templates/        # Template management page
│   ├── preview/[date]/   # Print/PDF preview page
│   └── page.tsx          # Dashboard
├── components/           # React components
├── lib/                  # Utilities
│   ├── types.ts         # TypeScript types
│   ├── db.ts            # Database client
│   ├── time.ts          # Time utilities
│   ├── calendar.ts      # Calendar integration
│   └── pdf.ts           # PDF generation
├── prisma/
│   └── migrations/      # Database migrations
├── scripts/
│   └── migrate-data.ts  # Data migration script
└── public/              # Static assets
```

## Troubleshooting

### Database connection errors

- Verify your `.env.local` has correct Supabase credentials
- Ensure the database migration was run in Supabase SQL Editor

### Build errors

```bash
rm -rf .next node_modules
npm install
npm run build
```

### Migration script errors

- Ensure the Flask app data exists at `~/.openclaw/workspace/daily-grid/data/`
- Check that Supabase credentials are set in environment

## Development Tips

- Run `npm run dev` for development with hot reload
- Check the browser console for JavaScript errors
- Use Supabase's table editor to view data directly
- The app uses Next.js 16 with App Router and TypeScript

## Support

For issues or questions:
1. Check the migration guide above
2. Verify environment variables are set correctly
3. Check Supabase logs for database errors
