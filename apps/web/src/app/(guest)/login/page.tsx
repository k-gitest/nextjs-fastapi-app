import { auth0 } from "@/lib/auth0";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ログイン",
  description: "ログインページ"
};

export default async function Login() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <a href="/auth/login">Login</a>
    );
  }
}
