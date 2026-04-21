import { auth0 } from "@/lib/auth0";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Navbar() {
  const session = await auth0.getSession();

  return (
    <nav className="flex justify-center gap-2">
      <h1 className="text-3xl font-bold text-gray-900 mb-5 dark:text-white">
        Next ⚡ + fastAPI
      </h1>
      <ul>
        <li>
          <Link href="/">トップへ戻る</Link>
        </li>
        {session && (
          <li>
            <Link href="/todo">TODOのページへ</Link>
          </li>
        )}
      </ul>
      {!session && (
        <>
          <Button variant="ghost" asChild>
            <a href="/auth/login">ログイン</a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/auth/login?screen_hint=signup">新規登録</a>
          </Button>
        </>
      )}
      {session && (
        <Button variant="ghost" asChild>
          <a href="/auth/logout">ログアウト</a>
        </Button>
      )}
    </nav>
  );
}
