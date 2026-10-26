import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'CPA',
  description: "Celine's Poop App",
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'white',
    'theme-color': '#f2eff3',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

const REPLICACHE_ENDPOINT = process.env.NEXT_PUBLIC_REPLICACHE_ENDPOINT;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {REPLICACHE_ENDPOINT == null ? null : (
          <link
            rel="preconnect"
            href={REPLICACHE_ENDPOINT}
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
