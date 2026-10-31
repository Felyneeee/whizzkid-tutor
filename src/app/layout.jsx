import "./globals.css";
import { StoreProvider } from "@/lib/store";
export const metadata = {
    title: "Whizzkids Academic Center",
    description: "Playgroup, Reading Programs and Academic Tutorials — online and face-to-face.",
};
export default function RootLayout({ children }) {
    return (<html lang="en">
      <body className="min-h-screen font-sans">
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>);
}
