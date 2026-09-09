import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        {/* <div className="grid grid-cols-1 gap-8 lg:grid-cols-4"> */}
          
          {/* Brand & Bio */}
          {/* <div className="space-y-4 lg:col-span-1">
            <span className="text-lg font-bold text-zinc-900 dark:text-white">
              YourBrand
            </span>
            <p className="text-sm">
              Building exceptional digital experiences and tools for modern web developers.
            </p>
          </div> */}

          {/* Quick Links Sections */}
          {/* <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">
                Product
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/features" className="hover:text-zinc-900 dark:hover:text-white">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-zinc-900 dark:hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/changelog" className="hover:text-zinc-900 dark:hover:text-white">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">
                Resources
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/docs" className="hover:text-zinc-900 dark:hover:text-white">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-zinc-900 dark:hover:text-white">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="hover:text-zinc-900 dark:hover:text-white">
                    Support
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-900 dark:text-white">
                Company
              </h3>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link href="/about" className="hover:text-zinc-900 dark:hover:text-white">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div> */}

        {/* Bottom Bar: Copyright & Socials */}
        <div className=" flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs">
            &copy; {new Date().getFullYear()} WSLima. All rights reserved. Building exceptional digital experiences.
          </p>
          <div className="flex space-x-6 text-sm">
            <Link href="https://instagram.com/i.m.willian" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white">
              Instagram
            </Link>
            <Link href="https://github.com/letscodewill" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white">
              GitHub
            </Link>
            {/* <Link href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-zinc-900 dark:hover:text-white">
              Discord
            </Link> */}
          </div>
        </div>
      </div>
    </footer>
  );
}