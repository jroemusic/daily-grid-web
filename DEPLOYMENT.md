# Vercel Deployment Guide

## Deploy to Vercel

### Step 1: Link to Vercel

From your project directory:

```bash
cd ~/dev/daily-grid-web
vercel link
```

Follow the prompts to link to your Vercel account.

### Step 2: Set Environment Variables

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste your Supabase URL (e.g., https://xxxxx.supabase.co)

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste your Supabase anon key
```

Or set them in the Vercel dashboard:
1. Go to https://vercel.com
2. Select your project
3. Go to Settings → Environment Variables
4. Add the two variables

### Step 3: Deploy to Production

```bash
vercel --prod
```

### Step 4: Configure Custom Domain (Optional)

In Vercel dashboard:
1. Go to Settings → Domains
2. Add domain: `grid.jandkay.com` (or your preferred domain)
3. Update DNS records as instructed

### Automatic Deployments

After the first deploy, Vercel will automatically:
- Deploy when you push to `main` branch
- Create preview URLs for pull requests

---

## Quick Deploy Commands

```bash
# Deploy to preview URL
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# Open deployment in browser
vercel open
```

## Production Checklist

Before deploying to production:

- [ ] Supabase project created
- [ ] Database migration run in Supabase
- [ ] Templates seeded (`npm run seed:templates`)
- [ ] Environment variables set in Vercel
- [ ] Custom domain configured (optional)
- [ ] Test the production URL

## Monitoring

- **Vercel Dashboard:** https://vercel.com
- **Supabase Dashboard:** https://supabase.com/dashboard
- **Analytics:** Available in Vercel project settings

## Rollback

If something goes wrong:

```bash
# View deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

## Post-Deployment

1. Test all features:
   - Create a schedule
   - Load templates
   - Generate PDF
   - Print view

2. Monitor logs:
   ```bash
   vercel logs --follow
   ```

3. Check database connections in Supabase dashboard

---

Your app should now be live! 🎉
