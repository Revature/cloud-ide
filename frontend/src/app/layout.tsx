import { Outfit } from "next/font/google";
import "./globals.css";
import '@xterm/xterm/css/xterm.css';
import '@/styles/xterm.css';
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import "flatpickr/dist/flatpickr.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CloudConnectorsProvider } from "@/context/CloudConnectorsContext";
import { ImagesProvider } from "@/context/ImagesContext";
import { RunnersProvider } from "@/context/RunnersContext";

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
        <ThemeProvider>
          <SidebarProvider>
            <CloudConnectorsProvider>
              <ImagesProvider>
                <RunnersProvider>
                  {children}
                </RunnersProvider>
              </ImagesProvider>
            </CloudConnectorsProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}