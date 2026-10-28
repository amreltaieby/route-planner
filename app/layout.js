import { Suspense } from "react";
import "./globals.css";
import "./app.css";
import AuthGate from "./AuthGate";
import Sidebar from "./Sidebar";

export const metadata = { title: "RouteIQ" };
export const viewport = { colorScheme: "only light" };

const themeScript = `try{var t=localStorage.getItem("routiq_theme");document.documentElement.setAttribute("data-theme",["dark","light","gray","slate","gold","mono"].indexOf(t)>-1?t:"dark")}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={null}>
          <AuthGate>
            <Sidebar>{children}</Sidebar>
          </AuthGate>
        </Suspense>
      </body>
    </html>
  );
}