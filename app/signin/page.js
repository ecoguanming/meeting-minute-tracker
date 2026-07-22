import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "var(--paper)",
          border: "1px solid var(--rule)",
          borderRadius: 14,
          padding: "40px 48px",
          textAlign: "center",
        }}
      >
        <div className="mma-h" style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
          Minutes desk
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 24 }}>
          Sign in with Google to access your calendar and send minutes.
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              border: "none",
              padding: "11px 22px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
