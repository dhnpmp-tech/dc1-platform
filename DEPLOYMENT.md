# DC1 Platform - Deployment Guide

## 🚀 Vercel Deployment (Recommended)

### Prerequisites
1. Vercel account (https://vercel.com)
2. GitHub account with dc1-platform repository
3. Supabase credentials

### Step 1: Push to GitHub

```bash
# Add remote if not already added
git remote add origin https://github.com/dhnpmp-tech/dc1-platform.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 2: Connect to Vercel

1. Go to https://vercel.com/new
2. Import the `dc1-platform` GitHub repository
3. Vercel will auto-detect Next.js framework
4. Configure build settings (should auto-detect):
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

### Step 3: Add Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add:

```
NEXT_PUBLIC_SUPABASE_URL=https://fvvxqp-qqjszv6vweybvjfpc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fQ3SU27BygDby6WzWkjRtA_lQ3C994x
```

### Step 4: Deploy

1. Click "Deploy"
2. Vercel will build and deploy automatically
3. Your dashboards will be live at `https://dc1-platform.vercel.app`

### Custom Domain (Optional)

In Vercel Dashboard → Settings → Domains:
1. Add custom domain (e.g., `dashboards.dc1st.com`)
2. Follow DNS configuration steps
3. SSL certificate auto-provisioned

---

## 🐳 Docker Deployment

### Build Docker Image

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### Build & Run

```bash
docker build -t dc1-platform .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://fvvxqp-qqjszv6vweybvjfpc.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fQ3SU27BygDby6WzWkjRtA_lQ3C994x \
  dc1-platform
```

---

## 🖥️ Self-Hosted Deployment

### Requirements
- Node.js 18+
- Nginx/Apache reverse proxy (recommended)
- PM2 or systemd for process management

### Installation

```bash
# Clone repository
git clone https://github.com/dhnpmp-tech/dc1-platform.git
cd dc1-platform

# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
npm install -g pm2
pm2 start "npm start" --name "dc1-platform"
pm2 save
pm2 startup
```

### Nginx Configuration

```nginx
upstream dc1_platform {
  server 127.0.0.1:3000;
}

server {
  listen 80;
  server_name dashboards.dc1st.com;

  location / {
    proxy_pass http://dc1_platform;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## 🧪 Post-Deployment Testing

### Health Check

```bash
# Home page
curl https://dc1-platform.vercel.app/

# Provider Dashboard
curl https://dc1-platform.vercel.app/provider

# Renter Dashboard
curl https://dc1-platform.vercel.app/renter

# Admin Dashboard
curl https://dc1-platform.vercel.app/admin
```

### Data Verification Checklist

- [ ] Home page loads (DC1 Platform title visible)
- [ ] Provider dashboard loads with earnings data
- [ ] Renter dashboard displays GPU marketplace
- [ ] Admin dashboard shows KPIs and machine health
- [ ] Supabase real-time subscriptions active
- [ ] No console errors in browser DevTools
- [ ] Mobile responsive on all pages
- [ ] Page performance acceptable (<3s load time)

### Load Testing

```bash
# Install Apache Bench
# Ubuntu/Debian: sudo apt-get install apache2-utils

ab -n 100 -c 10 https://dc1-platform.vercel.app/
```

---

## 🔒 Security Checklist

- [x] Public Supabase key only (no service role key exposed)
- [x] Environment variables not hardcoded
- [x] CORS configured correctly
- [ ] HTTPS enforced in production
- [ ] Admin dashboard auth implemented
- [ ] Rate limiting configured
- [ ] Content Security Policy headers set

### Enable HTTPS (Vercel Auto)
Vercel automatically provides SSL/TLS for all deployments.

### Set Security Headers

In `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
      ],
    },
  ];
}
```

---

## 📊 Monitoring & Analytics

### Vercel Analytics
- Dashboard available in Vercel console
- Real-time metrics, API routes, deployments
- Performance monitoring with Web Vitals

### Application Monitoring

Install Sentry for error tracking:

```bash
npm install @sentry/nextjs
```

Configure in `pages/_app.tsx` or `app/layout.tsx`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Vercel
        uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## 🆘 Troubleshooting

### Build Fails on Vercel

**Error**: `npm ERR! Missing script: "build"`
- **Solution**: Ensure `package.json` has `build` script

**Error**: `NEXT_PUBLIC_SUPABASE_URL is not defined`
- **Solution**: Add env vars to Vercel project settings (not .env.local)

### Slow Performance

- Enable Vercel Edge Network
- Optimize images with next/image
- Use static generation where possible
- Configure ISR (Incremental Static Regeneration)

### Supabase Connection Issues

- Verify ANON_KEY is correct (not SERVICE_ROLE_KEY)
- Check Supabase project status at https://supabase.com/dashboard
- Ensure RLS policies allow public read access
- Test connection: `curl https://fvvxqp-qqjszv6vweybvjfpc.supabase.co`

---

## 📞 Support

For deployment issues:
1. Check Vercel logs: `vercel logs dc1-platform`
2. Review Supabase logs: Supabase Dashboard → Logs
3. Check browser console for client errors
4. Contact DC1 team for @dc1st.com auth setup

---

**Last Updated**: Feb 23, 2026
**Status**: Ready for production deployment ✅
