import type { AppProps } from 'next/app';
import { ThemeProvider } from 'next-themes';
import { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
    title: "Pysplanner Dashboard",
    description: "Dashboard for PySplanner"
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider defaultTheme="dark" attribute="class">
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;