import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { AuthProvider } from "@/components/auth/auth-provider"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Striker Store - Claimio",
  description: "Self-service vendor portal for managing Shopify orders",
  generator: 'v0.dev',
  applicationName: 'Claimio',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Claimio',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Claimio',
    title: 'Striker Store - Claimio',
    description: 'Self-service vendor portal for managing Shopify orders',
  },
  twitter: {
    card: 'summary',
    title: 'Striker Store - Claimio',
    description: 'Self-service vendor portal for managing Shopify orders',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
