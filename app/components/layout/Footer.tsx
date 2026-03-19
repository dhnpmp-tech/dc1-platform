import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-dc1-surface-l1 border-t border-dc1-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logo.svg"
                alt="DCP."
                className="h-10 w-auto"
              />
              <span className="text-lg font-bold">DCP.</span>
            </div>
            <p className="text-sm text-dc1-text-secondary leading-relaxed">
              Power, Digitalized. The transparent, reliable GPU compute marketplace.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-sm font-semibold text-dc1-text-primary mb-4">Platform</h4>
            <ul className="space-y-2">
              <li><Link href="/provider/register" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Become a Provider</Link></li>
              <li><Link href="/renter/register" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Rent GPUs</Link></li>
              <li><Link href="/renter/marketplace" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">GPU Marketplace</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-dc1-text-primary mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><Link href="/docs" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Documentation</Link></li>
              <li><Link href="/docs/api" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">API Reference</Link></li>
              <li><Link href="/support" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Support</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-dc1-text-primary mb-4">Legal</h4>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Privacy Policy</Link></li>
              <li><Link href="/acceptable-use" className="text-sm text-dc1-text-secondary hover:text-dc1-amber transition-colors">Acceptable Use</Link></li>
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
