import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import MinutesDesk from "./components/MinutesDesk";

export default async function Home() {
  const session = await auth();
  if (!session) {
    redirect("/signin");
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 0 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          color: "var(--ink-soft)",
          padding: "0 4px 8px",
        }}
      >
        <span>{session.user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            style={{
              background: "none",
              border: "1px solid var(--rule)",
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 12,
              cursor: "pointer",
              color: "var(--ink-soft)",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
      <MinutesDesk />
    </div>
  );
}
