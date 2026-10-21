"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-main not-found-page" role="alert">
      <span>Something unexpected</span>
      <h1>Let’s try that again.</h1>
      <p>We couldn’t load this page. Your saved bag is not affected.</p>
      <button className="button button-dark" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
