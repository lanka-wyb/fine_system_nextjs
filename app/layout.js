import "./globals.css";

export const metadata = {
  title: "Students' Fines/Dues Verification",
  description: "Official Student Information and Fine Verification System Registry",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Global background blob layout */}
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
        
        {children}
      </body>
    </html>
  );
}
