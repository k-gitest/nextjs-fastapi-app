import { auth0 } from "@/lib/auth0";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "新規登録",
  description: "新規登録ページ"
};

export default async function Register() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <>
        <Link href="/auth/login?screen_hint=signup">サインアップ</Link>
        <a href="/auth/login?screen_hint=signup">Signup</a>
      </>
    );
  }
}
