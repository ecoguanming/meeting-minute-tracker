import "./globals.css";

export const metadata = {
  title: "Meeting Minute Tracker",
  description: "Meetings, minutes, and action items in one place.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
