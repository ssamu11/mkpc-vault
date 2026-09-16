"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>We couldn’t load your catalog.</h1>
      <p>
        Check your connection and that the Supabase migration has been applied.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
