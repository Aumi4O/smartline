import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Editorial display serif (closest free match to Anthropic's Tiempos) used for
// the big headlines; Geist carries body copy.
const displaySerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const GA_ID = "G-94L1NLPG8Q";
const CLARITY_ID = "whpeg9p4tt";

export const metadata: Metadata = {
  title: "SmartLine — AI Voice Agents for Business",
  description: "Deploy intelligent voice agents that answer calls, book appointments, and handle customer inquiries 24/7.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${displaySerif.variable}`}
    >
      <body>
        <script
          id="ga-gtag"
          dangerouslySetInnerHTML={{
            __html: `
            window.dataLayer = window.dataLayer || [];
            window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
            window.gtag('js', new Date());
            window.gtag('config', '${GA_ID}', { send_page_view: true });
          `,
          }}
        />
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        />
        <script
          id="ms-clarity"
          dangerouslySetInnerHTML={{
            __html: `
            (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");
          `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
