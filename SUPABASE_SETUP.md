# Supabase Setup Guide for Daily Grid

## Step 1: Create Supabase Project

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign in with GitHub (or create account)
4. Click "New Project"
5. Fill in the form:
   - **Name:** `daily-grid` (or your preferred name)
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose a region close to you (e.g., US East)
6. Click "Create new project"
7. Wait 2-3 minutes for the project to be provisioned

## Step 2: Get Your Credentials

Once the project is ready:

1. In the left sidebar, click on **Settings** (gear icon)
2. Click on **API**
3. Copy these values:
   - **Project URL:** Something like `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public:** A long JWT key

## Step 3: Run the Database Migration

1. In Supabase, click on **SQL Editor** in the left sidebar
2. Click "New query"
3. Copy the output of this command:

```bash
cd ~/dev/daily-grid-web && npm run migrate:setup
```

4. Paste the SQL into the Supabase SQL Editor
5. Click **Run** (or press Cmd/Ctrl+Enter)
6. You should see "Success. No rows returned"

## Step 4: Configure Environment Variables

Run this command to update your environment:

```bash
cd ~/dev/daily-grid-web
nano .env.local
```

Replace the placeholder values with your actual Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 5: Seed Templates

After setting up Supabase:

```bash
cd ~/dev/daily-grid-web
npm run seed:templates
```

This will load all the templates from the Flask app into Supabase.

## Step 6: Start the Development Server

```bash
npm run dev
```

Visit http://localhost:3000

---

## Troubleshooting

**"Database not configured" error:**
- Make sure your `.env.local` has correct values (no quotes around URLs)
- Restart the dev server after changing `.env.local`

**Migration errors:**
- Make sure you ran the SQL in Supabase SQL Editor
- Check that the tables were created: Table Editor (left sidebar) should show `schedules` and `templates`

**Template seeding fails:**
- Verify the JSON files exist in `public/data/`
- Check that environment variables are set correctly

## Verify Setup

1. Go to Supabase → **Table Editor**
2. You should see `schedules` and `templates` tables
3. Click on `templates` - you should see several templates after seeding

Ready to proceed! Let me know when you've completed these steps.
