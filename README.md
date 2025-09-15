# JADDL Fantasy Football League

A comprehensive Next.js 14+ fantasy football league management system built with TypeScript, Tailwind CSS, and modern web technologies.

## 🏆 Features

- **Modern Tech Stack**: Next.js 14+ with App Router, TypeScript, and Tailwind CSS
- **Content Management**: Contentful CMS integration for news, articles, and team profiles
- **Database**: Supabase PostgreSQL for league data, scores, and statistics
- **Responsive Design**: Mobile-first approach with beautiful UI components
- **Real-time Updates**: ISR (Incremental Static Regeneration) for fresh content
- **Type Safety**: Comprehensive TypeScript interfaces for all data structures
- **Component Library**: Shadcn/ui components with custom fantasy football theming

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Supabase account and project
- Contentful account and space

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd JADDL
   pnpm install
   ```

2. **Environment Setup:**
   ```bash
   cp env.example .env.local
   ```

3. **Configure environment variables:**
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Contentful Configuration
   NEXT_PUBLIC_CONTENTFUL_SPACE_ID=your_contentful_space_id
   NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN=your_contentful_access_token
   CONTENTFUL_PREVIEW_ACCESS_TOKEN=your_contentful_preview_token

   # Optional: API Keys for future integrations
   # SLEEPER_API_KEY=your_sleeper_api_key
   REVALIDATE_SECRET=your_revalidation_secret

   # Next.js Configuration
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. **Start development server:**
   ```bash
   pnpm dev
   ```

5. **Open in browser:**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (pages)/           # Page routes
│   │   ├── page.tsx       # Home page
│   │   ├── news/          # News articles
│   │   ├── scores/        # Weekly scores
│   │   ├── standings/     # League standings
│   │   ├── teams/         # Team directory
│   │   └── history/       # League history
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── layout/           # Layout components
│   └── pages/            # Page-specific components
├── lib/                  # Utility libraries
│   ├── contentful/       # CMS integration
│   ├── supabase/         # Database integration
│   ├── api/              # API utilities
│   └── utils/            # Helper functions
└── types/                # TypeScript definitions
    ├── database.ts       # Supabase schema types
    ├── contentful.ts     # CMS content types
    └── api.ts           # API response types
```

## 🗄️ Database Schema

The Supabase database includes the following main tables:

- **teams**: Team information and owners
- **games**: Weekly matchups and scores
- **team_seasons**: Team assignments to divisions/quads by year
- **league_seasons**: League structure by year
- **divisions/quads**: League organizational groupings
- **trophies/trophy_case**: Awards and winners
- **rivalries/rivals**: Team rivalries
- **team_bios**: Extended team information
- **franchise_history**: Team name changes over time
- **drafts**: Draft pick history
- **articles**: Links to Contentful content

## 📝 Content Management

### Contentful Content Types

The system expects the following Contentful content types:

1. **News Article** (`newsArticle`)
   - title, slug, summary, content
   - featuredImage, author, publishedDate
   - tags, featuredTeam, isSticky, category

2. **Team Profile** (`teamProfile`)
   - teamName, shortName, logo
   - ownerName, ownerPhoto, teamColors
   - biography, achievements, socialLinks

3. **League Announcement** (`leagueAnnouncement`)
   - title, message, type, priority
   - publishedDate, expirationDate
   - targetAudience, attachments

4. **Historical Moment** (`historicalMoment`)
   - title, description, season, week, date
   - involvedTeams, photos, videos
   - category, significance

### ISR and Revalidation

The system uses Next.js ISR for optimal performance:

- Content pages revalidate automatically
- Manual revalidation via `/api/revalidate` endpoint
- Webhook integration ready for Contentful

## 🎨 Theming and Design

### Color Palette
- **Primary**: Blues and grays with light blue accent (#1E64FF)
- **League Blue**: Custom blue scale (50-900)
- **League Gray**: Neutral gray scale (50-900)
- **Accent**: Light Blue (#1E64FF) for hovers and active states

### Custom CSS Classes
- `.league-gradient`: Background gradient
- `.league-card`: Standard card styling
- `.league-button-primary`: Primary button style
- `.league-text-primary/secondary`: Text color utilities

## 🔧 Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm type-check   # Run TypeScript compiler
```

### Adding New Components

1. Create component in appropriate directory
2. Export from index.ts files
3. Use TypeScript interfaces from `src/types/`
4. Follow Tailwind CSS conventions

### Database Queries

Use the pre-built API functions in `src/lib/supabase/api.ts`:

```typescript
import { getTeams, calculateStandings, getWeeklyMatchups } from '@/lib/supabase';

// Get all active teams
const teams = await getTeams();

// Get current standings
const standings = await calculateStandings(2024);

// Get weekly matchups
const matchups = await getWeeklyMatchups(2024, 12);
```

### Content Queries

Use Contentful API functions in `src/lib/contentful/api.ts`:

```typescript
import { getNewsArticles, getTeamProfiles } from '@/lib/contentful';

// Get latest news
const articles = await getNewsArticles(10);

// Get team profiles
const profiles = await getTeamProfiles();
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms

The application can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- Self-hosted with Docker

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:
- Database URLs and keys
- CMS credentials
- API secrets
- NextAuth configuration

## 🔮 Future Integrations

The project is prepared for future integrations:

### Sleeper API
- Live scoring integration
- Player data synchronization
- Draft import functionality
- Prepared utilities in `src/lib/api/sleeper.ts`

### Additional Features
- User authentication with NextAuth
- Real-time notifications
- Mobile app with React Native
- Advanced analytics dashboard

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linting and type checks
5. Submit a pull request

### Code Standards

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Write meaningful commit messages
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

For questions or issues:
1. Check the documentation
2. Search existing issues
3. Create a new issue with detailed information
4. Contact the league commissioner

## 🏗️ Architecture Notes

### State Management
- Zustand for client-side state (prepared but not implemented)
- Server state managed through Next.js data fetching
- Local storage utilities for user preferences

### Performance
- Image optimization with Next.js Image component
- ISR for content pages
- Component-level code splitting
- Optimized bundle size with tree shaking

### Security
- Environment variable validation
- API route protection
- Content sanitization
- CORS configuration for external APIs

---

**JADDL Fantasy Football League** - Built with ❤️ for competitive fantasy football players.
