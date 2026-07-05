import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "検証コンソール",
  robots: { index: false, follow: false },
};

export default function DebugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
