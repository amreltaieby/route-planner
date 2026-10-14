import "./globals.css";
import "./app.css";
import Sidebar from "./Sidebar";

export const metadata = { title: "Routify" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Sidebar>{children}</Sidebar>
      </body>
    </html>
  );
}