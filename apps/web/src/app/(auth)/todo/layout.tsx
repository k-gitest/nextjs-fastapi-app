import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Todoのページ",
  description: "Todoのページの説明",
};

export default function TodoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section>
      {children}
    </section>
  );
}
