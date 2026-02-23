# DC1 Platform - GPU Rental Network

## 🚀 Overview

Complete Next.js 14 dashboard platform for DC1 GPU Rental Network with three role-based dashboards:

- **Provider Dashboard** - Manage GPUs, view earnings, track rentals, withdraw funds
- **Renter Dashboard** - GPU marketplace, advanced filters, billing management, rebate tracking
- **Admin Dashboard** - Platform KPIs, machine health, provider leaderboard (email auth: @dc1st.com)

## ✨ Features


### All Dashboards
- **Real-time Data** - Live Supabase integration with subscriptions
- **Responsive Design** - Mobile, tablet, and desktop compatible
- **DC1 Branding** - Custom colors (#1a1a1a black, #FFD700 gold, #00A8E1 cyan)
- **Modern UI** - Clean, intuitive interfaces with Tailwind-like styling

### Provider Dashboard
- 📊 Earnings summary (total earnings, active rentals count)
- 💻 Machines management table (model, VRAM, hourly rate, status)
- 🔄 Active rentals tracking with details
- 🏆 Reward tier system (Bronze/Silver/Gold based on earnings)
- 💸 Wallet balance and withdraw button

### Renter Dashboard
- 🎮 GPU marketplace with live machine listing
- 🔍 Advanced filters (min VRAM, max price, status)
- 🛒 Rent button per machine
- 📈 Billing history with transaction tracking
- 💰 Rebate tracker (5% on all rentals)

### Admin Dashboard
- 📈 Key performance indicators (total users, machines, rentals, volume)
- ⚙️ Machine health monitoring with uptime metrics
- 📋 Recent rentals activity feed
- 🏅 Provider leaderboard with earnings ranking
- 🔐 @dc1st.com email authentication required

## 🏗️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (Real-time PostgreSQL)
- **Styling**: Inline CSS + Tailwind-inspired class names
- **Deployment**: Vercel

## 📦 Project Structure

```
dc1-platform/
├── app/
│   ├── page.tsx              # Home/landing page
│   ├── layout.tsx            # Root layout with styles
│   ├── provider/
│   │   └── page.tsx          # Provider dashboard
│   ├── renter/
│   │   └── page.tsx          # Renter dashboard
│   └── admin/
│       └── page.tsx          # Admin dashboard
├── lib/
│   └── supabase.ts           # Supabase client and queries
├── public/                   # Static assets
├── package.json
├── next.config.js
└── tsconfig.json
```

## 🔌 Supabase Integration

### Connected Tables
- `users` - Provider and renter accounts
- `machines` - GPU inventory with rates and status
- `rentals` - Active and completed rentals
- `wallets` - User balances and transaction history
- `transactions` - Billing history and rebates
- `ratings` - Provider ratings from renters

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=https://fvvxqp-qqjszv6vweybvjfpc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fQ3SU27BygDby6WzWkjRtA_lQ3C994x
```

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
# Open http://localhost:3000
```

### Build & Deploy
```bash
npm run build
npm start

# Or deploy to Vercel
vercel
```

## 📱 Routes

- `/` - Home page with dashboard selection
- `/provider` - Provider dashboard
- `/renter` - Renter dashboard
- `/admin` - Admin dashboard (requires @dc1st.com)

## 🧪 Testing Checklist

- [x] Local dev server running
- [x] All 3 dashboards render correctly
- [x] Supabase connection configured
- [x] Real-time subscription setup in place
- [x] Mobile responsive layout
- [x] DC1 color scheme applied (#1a1a1a, #FFD700, #00A8E1)
- [ ] Vercel deployment live
- [ ] Data verification: Confirm all 6 users, 4 machines, 3 rentals displaying
- [ ] Real-time updates: Test subscription updates
- [ ] Auth verification: Admin dashboard access control

## 📊 Sample Data Available

From Supabase seed data:
- **6 Users**: 3 providers (Tareg, Peter, Mining Farm) + 3 renters (Ahmed, Dr. Fatima, AI Labs)
- **4 Machines**: RTX 4090, H100, RTX 3090, RTX 3060
- **3 Rentals**: 1 active, 2 completed
- **6 Wallets**: With balances and transaction history

## 🔐 Security

- Public Supabase key for client-side reads
- Admin dashboard access control via email domain
- Row-level security (RLS) configured in Supabase
- No sensitive keys committed to repository

## 🎨 Customization

Edit dashboard components in `/app/{provider,renter,admin}/page.tsx` to:
- Modify layouts and colors
- Add new KPIs or metrics
- Change filtering logic
- Customize machine display

## 🐛 Troubleshooting

**Dev server won't start**
```bash
rm -rf .next node_modules
npm install
npm run dev
```

**Supabase connection error**
- Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in `.env.local`
- Verify Supabase project is active
- Check network connectivity

**Build fails**
```bash
npm run build -- --no-lint
```

## 📝 License

DC1 Platform - Confidential

## 🤝 Support

For issues or questions, contact the DC1 team.

---

**Status**: ✅ Ready for Vercel deployment
**Last Updated**: Feb 23, 2026
**Build Size**: ~96 kB First Load JS | ~149 kB per dashboard
