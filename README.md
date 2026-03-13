# Daily Grid

A family time-blocking system for managing daily schedules. Built with Next.js, TypeScript, and Supabase.

## Features

- ✅ **Schedule Management** - Create, edit, and delete daily schedules
- ✅ **Template System** - Reusable schedule templates for different day types
- ✅ **Activity Tracking** - Color-coded activities with time management
- ✅ **Multi-Person Support** - Track schedules for multiple family members
- ✅ **PDF Export** - Generate downloadable PDF schedules
- ✅ **Printable Views** - Beautiful HTML views for printing
- ✅ **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **PDF Generation:** jsPDF (client-side)

## Quick Start

### Prerequisites

- Node.js 18+ installed
- Supabase account ([sign up free](https://supabase.com))

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

Follow the complete guide in [SUPABASE_SETUP.md](SUPABASE_SETUP.md):

1. Create a new Supabase project
2. Run the database migration
3. Configure environment variables

### 3. Seed Templates

```bash
npm run seed:templates
```

### 4. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Project Structure

```
daily-grid-web/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── editor/[date]/page.tsx      # Schedule editor
│   ├── templates/page.tsx          # Template management
│   ├── preview/[date]/page.tsx     # Print/PDF preview
│   └── api/                        # API routes
├── lib/
│   ├── types.ts                    # TypeScript types
│   ├── db.ts                       # Supabase client
│   ├── time.ts                     # Time utilities
│   ├── calendar.ts                 # Calendar integration
│   └── pdf.ts                      # PDF generation
├── components/                     # React components
├── prisma/migrations/              # Database migrations
└── scripts/                        # Utility scripts
```

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

npm run migrate:setup    # Print database migration SQL
npm run migrate:data     # Migrate data from Flask app
npm run seed:templates   # Seed templates from JSON files
npm run seed:sample      # Create sample schedule for testing
```

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

### Environment Variables

Required for production:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Activity Types

The system supports 9 activity types with color coding:

| Type | Color | Description |
|------|-------|-------------|
| Routine | Green | Daily habits and routines |
| Meal | Yellow | Breakfast, lunch, dinner |
| Personal | Blue | Individual activities |
| Work | Purple | Work/study time |
| Family | Orange | Family activities |
| School | Teal | School-related |
| Activity | Pink | Extracurricular activities |
| Break | Gray | Rest periods |
| Other | White | Uncategorized |

## Development

### Adding New Features

1. **New API Route:** Add to `app/api/`
2. **New Page:** Add to `app/`
3. **New Component:** Add to `components/`
4. **New Utility:** Add to `lib/`

### Database Schema

View migration in `prisma/migrations/001_initial_schema.sql`

Key tables:
- `schedules` - Daily schedules
- `templates` - Reusable templates

### TypeScript Types

See `lib/types.ts` for all type definitions.

## Migration from Flask

This app was migrated from a Flask application. To migrate existing data:

```bash
npm run migrate:data
```

This requires the original Flask app data at `~/.openclaw/workspace/daily-grid/data/`.

## Support

For setup issues, see:
- [SETUP.md](SETUP.md) - Complete setup guide
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) - Supabase configuration

## License

MIT

## Credits

Built for the Jason & Kay family time-blocking system.
