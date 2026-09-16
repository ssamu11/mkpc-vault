import { login } from "./actions";
import { configured } from "@/lib/supabase";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-art">
        <div className="brand-mark">✦</div>
        <p className="eyebrow">YOUR GAME. EVERY CARD.</p>
        <h1>
          A home for
          <br />
          your entire
          <br />
          <em>card universe.</em>
        </h1>
        <p>
          One catalog. Thoughtful rosters.
          <br />A clearer view of who comes next.
        </p>
        <span className="login-caption">BIAS VAULT / MODERATOR WORKSPACE</span>
      </div>
      <section className="login-form">
        <span className="eyebrow">STAFF ACCESS</span>
        <h2>Welcome back.</h2>
        <p>Sign in to your moderator workspace.</p>
        {!configured() ? (
          <div className="notice">
            <strong>Connect your Supabase project</strong>
            <p>
              Set the two environment variables in .env.local, apply the
              migration, and create your first admin following the README.
              Sign-in will then be available.
            </p>
          </div>
        ) : (
          <form action={login}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error === "access"
                  ? "Your account does not have moderator access. Ask an admin to add your profile."
                  : "Unable to sign in. Check your email and password."}
              </p>
            )}
            <button className="primary">Sign in →</button>
          </form>
        )}
        <p className="muted small">Private workspace · Invite-only access</p>
      </section>
    </main>
  );
}
