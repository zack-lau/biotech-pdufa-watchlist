import '../base.css';
import '../style.css';

export const metadata = {
  title: 'Biotech PDUFA Watchlist',
  description:
    'Watchlist of upcoming FDA PDUFA decisions for US-listed biotechs over the next 90 days, with catalyst ratings, market data, sentiment, and bull/bear/risk theses.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%231d3a6a'/><path d='M9 10 Q16 16 23 10 M9 22 Q16 16 23 22' stroke='white' stroke-width='2.2' fill='none' stroke-linecap='round'/></svg>"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
