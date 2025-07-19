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
    'theme-color': '#f9f9f9',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://replicache-license.herokuapp.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://celinespoopapp.fly.dev"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
