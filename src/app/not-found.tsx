import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main not-found-page">
      <span>404 · A little detour</span>
      <h1>Nothing here, just yet.</h1>
      <p>The piece you’re looking for may have moved on. Let’s find you something else.</p>
      <Link className="button button-dark" href="/collections">Explore the collection <span aria-hidden="true">↗</span></Link>
    </main>
  );
}
