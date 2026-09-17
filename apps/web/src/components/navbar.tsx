import Link from "next/link";
import { LogOut, Menu, User } from "lucide-react";
import { auth0 } from "@/lib/auth0";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/", label: "トップへ戻る", requiresAuth: false },
  { href: "/todo", label: "TODO", requiresAuth: true },
  { href: "/albums", label: "アルバム", requiresAuth: true },
] as const;

export default async function Navbar() {
  const session = await auth0.getSession();
  const email = session?.user?.email;

  const visibleLinks = NAV_LINKS.filter(
    (link) => !link.requiresAuth || session,
  );

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* ロゴ（アプリタイトル。h1ではなくトップへのLink） */}
        <Link
          href="/"
          className="text-lg font-bold text-gray-900 dark:text-white"
        >
          Next ⚡ + fastAPI
        </Link>

        {/* PC: ナビゲーション */}
        <ul className="hidden md:flex items-center gap-6">
          {visibleLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* PC: 右側（アカウント or 認証ボタン） */}
        <div className="hidden md:flex items-center gap-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-muted"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <User className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="text-sm font-medium">{email}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a
                    href="/auth/logout"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    ログアウト
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <a href="/auth/login">ログイン</a>
              </Button>
              <Button variant="ghost" asChild>
                <a href="/auth/login?screen_hint=signup">新規登録</a>
              </Button>
            </>
          )}
        </div>

        {/* モバイル: ハンバーガー → Sheet */}
        <div className="flex md:hidden">
          <Sheet>
            <SheetTrigger
              type="button"
              aria-label="メニューを開く"
              className="p-2"
            >
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-6">
              <SheetHeader>
                <SheetTitle className="text-left">Next ⚡ + fastAPI</SheetTitle>
              </SheetHeader>
              <SheetDescription className="sr-only">
                サイトの各ページへ移動するためのメニューです。
              </SheetDescription>

              {session ? (
                <>
                  <div className="flex items-center gap-2 border-b pb-4 px-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="text-sm font-medium">{email}</span>
                  </div>

                  <ul className="flex flex-col gap-1 px-4">
                    {visibleLinks.map((link) => (
                      <li key={link.href}>
                        <SheetClose asChild>
                          <Link
                            href={link.href}
                            className="block rounded-md px-2 py-2 text-sm font-medium hover:bg-muted"
                          >
                            {link.label}
                          </Link>
                        </SheetClose>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto border-t pt-4 px-4">
                    <a
                      href="/auth/logout"
                      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <LogOut className="h-4 w-4" />
                      ログアウト
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 px-4">
                  <SheetClose asChild>
                    <Button variant="ghost" asChild className="justify-start">
                      <a href="/auth/login">ログイン</a>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button variant="ghost" asChild className="justify-start">
                      <a href="/auth/login?screen_hint=signup">新規登録</a>
                    </Button>
                  </SheetClose>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
