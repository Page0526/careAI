import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "CareAI – Pediatric EHR Data Validation",
  description: "AI-powered EHR data validation for pediatric inpatient nutrition. Built for HSIL Hackathon 2026.",
  keywords: ["CareAI", "EHR", "pediatric", "nutrition", "FHIR", "AI", "data validation"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
