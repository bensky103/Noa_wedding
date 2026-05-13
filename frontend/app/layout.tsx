import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'החתונה של נועה ויובל',
  description: 'אלבום משותף לתמונות וסרטונים מהחתונה של נועה ויובל',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.className}>
      <body>{children}</body>
    </html>
  );
}
