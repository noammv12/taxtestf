import "./globals.css";

export const metadata = {
  title: "Clearly · Tax Operations Platform",
  description: "Tax operations platform for P&L report ingestion, validation, reconciliation, and tax-cleaned client reporting.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
