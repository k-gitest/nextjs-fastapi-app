import type { Metadata } from "next";
import { auth0 } from "@/lib/auth0";

export const metadata: Metadata = {
  title: "ダッシュボード",
  description: "ダッシュボードのページ",
};

const Dashboard = async () => {
  const session = await auth0.getSession();

  return (
    <div>
      <h1>ダッシュボード</h1>
      {session && (
        <>
          <p>Logged in as {session.user.email}</p>

          <h2>User Profile</h2>
          <pre>{JSON.stringify(session.user, null, 2)}</pre>
          <a href="/auth/logout" data-testid="dashboard-logout">ログアウト</a>
        </>
      )}
    </div>
  );
};
export default Dashboard;
