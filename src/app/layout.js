import "./globals.css";

export const metadata = {
  title: "Colmex Pro Tax Ops | Ingestion & Reconciliation Platform",
  description: "Internal broker operations platform for P&L report ingestion, validation, reconciliation, and tax-cleaned client reporting.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
