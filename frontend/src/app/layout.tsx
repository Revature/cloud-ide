import { Outfit } from "next/font/google";
import "./globals.css";
import '@xterm/xterm/css/xterm.css';
import '@/styles/xterm.css';
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import "flatpickr/dist/flatpickr.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { QueryProvider } from "@/context/QueryContext";
import { AuthKitProvider } from '@workos-inc/authkit-nextjs/components';

const outfit = Outfit({
  variable: "--font-outfit-sans",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} dark:bg-gray-900`}>
        <AuthKitProvider>
          <QueryProvider>
            <ThemeProvider>
              <SidebarProvider>
                      {children}
              </SidebarProvider>
            </ThemeProvider>
          </QueryProvider>
        </AuthKitProvider>
      </body>
    </html>
  );
}