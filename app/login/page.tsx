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
      <section className="login-form">
        <div>
          <span className="eyebrow">MKPC VAULT</span>
          <h2>Sign in</h2>
          <p>Moderator workspace</p>
        </div>

        {!configured() ? (
          <div className="notice">
            <strong>Supabase is not configured.</strong>
          </div>
        ) : (
          <form action={login}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
              />
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
                  ? "This account does not have workspace access."
                  : "Incorrect email or password."}
              </p>
            )}

            <button className="primary">
              Sign in
            </button>
          </form>
        )}
      </section>
    </main>
  );
}