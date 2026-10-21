import Image from "next/image";
import Link from "next/link";
import { ProductGrid } from "@/components/store";
import { getCategories, getProducts } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, products] = await Promise.all([getCategories(), getProducts()]);
  const campaignImage =
    process.env.NODE_ENV === "development"
      ? "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1800&q=90"
      : "/product-placeholder.svg";
  const storyImage =
    process.env.NODE_ENV === "development"
      ? "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85"
      : "/product-placeholder.svg";
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">A little more considered</span>
          <h1>For the days<br />that feel like <em>you.</em></h1>
          <p>Everyday pieces, ready to make your own.</p>
          <Link className="button button-light" href="/collections">Find your everyday <span aria-hidden="true">↗</span></Link>
          <div className="hero-footnote"><span className="hero-dot" /> New season, same thoughtful things</div>
        </div>
        <div className="hero-image">
          <Image
            src={campaignImage}
            alt={process.env.NODE_ENV === "development" ? "Sample campaign image" : "Product image placeholder"}
            fill
            priority
            sizes="(max-width: 760px) 100vw, 58vw"
          />
          <span className="hero-image-caption">The softer side of getting dressed</span>
          <span className="hero-image-index">01 / 03</span>
        </div>
        <span className="hero-vertical-note">DHAKA FORM</span>
      </section>

      <section className="intro-strip">
        <p>A good piece does more than get dressed.<br /><em>It makes room for the day.</em></p>
        <span>Designed in Dhaka, for wherever you call home.</span>
      </section>

      <section className="section category-section">
        <div className="section-heading">
          <div><span className="eyebrow">A place to begin</span><h2>Find your kind of <em>everyday.</em></h2></div>
          <Link href="/collections" className="under-link">Explore all <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link className={`category-card category-card-${index + 1}`} href={category.href} key={category.name}>
              <Image src={category.image} alt="" fill sizes="(max-width: 700px) 70vw, 33vw" />
              <div className="category-overlay"><span>{category.detail}</span><h3>{category.name}</h3><span className="category-arrow">↗</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section arrivals-section">
        <div className="section-heading">
          <div><span className="eyebrow">Fresh from the studio</span><h2>New, and already <em>loved.</em></h2></div>
          <Link href="/collections?sort=newest" className="under-link">View all pieces <span aria-hidden="true">↗</span></Link>
        </div>
        <ProductGrid items={products.slice(0, 4)} />
      </section>

      <section className="story-banner">
        <div className="story-image"><Image src={storyImage} alt={process.env.NODE_ENV === "development" ? "Sample campaign image" : "Product image placeholder"} fill sizes="(max-width: 760px) 100vw, 50vw" /></div>
        <div className="story-copy"><span className="eyebrow">About Dhaka Form</span><h2>Find your<br /><em>everyday.</em></h2><p>Learn about the business, materials and sourcing details as they are added by the Dhaka Form team.</p><Link href="/about" className="button button-dark">A little about us <span aria-hidden="true">↗</span></Link><span className="story-mark">DF · 01</span></div>
      </section>

      <section className="section bestsellers-section">
        <div className="section-heading">
          <div><span className="eyebrow">Good things, on repeat</span><h2>The pieces you <em>come back to.</em></h2></div>
          <Link href="/collections?sort=popular" className="under-link">Shop bestsellers <span aria-hidden="true">↗</span></Link>
        </div>
        <ProductGrid items={products.filter((product) => product.bestseller)} />
      </section>

      <section className="benefits-band">
        <div><span className="benefit-icon">৳</span><h3>Clear pricing</h3><p>Order totals are recalculated by the server before an order is accepted.</p></div>
        <div><span className="benefit-icon">✓</span><h3>Stock checked</h3><p>Availability is checked against inventory during order placement.</p></div>
        <div><span className="benefit-icon">↺</span><h3>Policy first</h3><p>Delivery and return details should be reviewed before placing an order.</p></div>
        <div><span className="benefit-icon">♡</span><h3>Need help?</h3><p>Support contact details must be configured before the business launches.</p></div>
      </section>

      <section className="newsletter-section">
        <span className="eyebrow">A note, now and then</span>
        <h2>Good things, <em>in your inbox.</em></h2>
        <p>A first look at new pieces, thoughtful reads and the occasional little treat.</p>
        <form className="newsletter-form" action="/newsletter">
          <label className="sr-only" htmlFor="home-email">Email address</label>
          <input id="home-email" type="email" placeholder="Your email address" required disabled />
          <button type="button" disabled>Coming soon</button>
        </form>
        <small>We’ll only write when we have something good to say. Newsletter signup is not connected yet.</small>
      </section>
    </main>
  );
}
