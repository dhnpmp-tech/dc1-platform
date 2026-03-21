import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-dc1-surface-l1 border-t border-dc1-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center mb-4">
              <img
                src="/logo.svg"
                alt="DCP"
                className="h-10 w-auto"
              />
            </div>
            <p className="text-sm text-dc1-text-secondary leading-relaxed">
              Decentralized Compute Platform. Borderless infrastructure connecting global GPU supply with AI engineering demand.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-dc1-text-primary mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><Link href="/renter/register" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Rent GPUs</Link></li>
              <li><Link href="/provider/register" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Earn with GPUs</Link></li>
              <li><Link href="/marketplace" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Marketplace</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-dc1-text-primary mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><Link href="/docs" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Docs</Link></li>
              <li><Link href="/docs/api" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">API Reference</Link></li>
              <li><Link href="/support" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Support</Link></li>
              <li><Link href="/login" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Console Login</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-dc1-text-primary mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/privacy" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Privacy Policy</Link></li>
              <li><Link href="/acceptable-use" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Acceptable Use</Link></li>
              <li><Link href="/status" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">System Status</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-dc1-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-dc1-text-muted">
            &copy; {new Date().getFullYear()} DC Power Solutions Company. CR: 7053667775. All rights reserved.
          </p>
          <p className="text-xs text-dc1-text-muted">
            dcp.sa
          </p>
        </div>
      </div>
    </footer>
  )
}
