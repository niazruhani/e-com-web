"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { formatPrice, type Product } from "@/lib/catalog";

type CartLine = { productId: string; quantity: number; size: string; product: Product };
type StoreContextValue = {
  cart: CartLine[];
  wishlist: string[];
  wishlistProducts: Product[];
  recentlyViewed: string[];
  recentlyViewedProducts: Product[];
  addToCart: (product: Product, size: string, quantity?: number) => void;
  setQuantity: (productId: string, size: string, quantity: number) => void;
  removeFromCart: (productId: string, size: string) => void;
  toggleWishlist: (product: Product) => void;
  cartCount: number;
  cartSubtotal: number;
  clearCart: () => void;
  notice: string;
  clearNotice: () => void;
  recordViewed: (product: Product) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
type StoreState = {
  cart: CartLine[];
  wishlist: string[];
  wishlistProducts: Product[];
  recentlyViewed: string[];
  recentlyViewedProducts: Product[];
  notice: string;
};
const emptyStore: StoreState = {
  cart: [],
  wishlist: [],
  wishlistProducts: [],
  recentlyViewed: [],
  recentlyViewedProducts: [],
  notice: "",
};
let storeSnapshot = emptyStore;
let loaded = false;
const listeners = new Set<() => void>();

function notifyStore() {
  listeners.forEach((listener) => listener());
}

function isProductSnapshot(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;
  const product = value as Record<string, unknown>;
  const localImage = typeof product.image === "string" && product.image.startsWith("/") && !product.image.startsWith("//");
  let remoteImage = false;
  if (typeof product.image === "string") {
    try {
      const url = new URL(product.image);
      remoteImage =
        url.protocol === "https:" &&
      ((process.env.NODE_ENV === "development" && url.hostname === "images.unsplash.com") ||
          url.hostname === process.env.NEXT_PUBLIC_PRODUCT_IMAGE_HOST);
    } catch {
      remoteImage = false;
    }
  }
  return (
    typeof product.id === "string" &&
    typeof product.sku === "string" &&
    typeof product.slug === "string" &&
    typeof product.name === "string" &&
    typeof product.category === "string" &&
    typeof product.description === "string" &&
    Number.isSafeInteger(product.price) &&
    Number(product.price) > 0 &&
    Number.isSafeInteger(product.stock) &&
    Number(product.stock) >= 0 &&
    Array.isArray(product.sizes) &&
    product.sizes.every((size) => typeof size === "string" && size.length <= 32) &&
    (localImage || remoteImage)
  );
}

function hydrateCartLine(value: unknown): CartLine | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  const product = isProductSnapshot(entry.product) ? entry.product : null;
  if (
    !product ||
    entry.productId !== product.id ||
    typeof entry.size !== "string" ||
    !Number.isInteger(entry.quantity) ||
    Number(entry.quantity) < 1 ||
    Number(entry.quantity) > 20
  ) {
    return null;
  }
  return { productId: product.id, size: entry.size, quantity: Number(entry.quantity), product };
}

function decodeProductList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const snapshots = value.map((item) => (isProductSnapshot(item) ? item : undefined));
  return snapshots.filter((product): product is Product => Boolean(product));
}

function loadStore() {
  if (loaded || typeof window === "undefined") return;
  try {
    const savedCart = window.localStorage.getItem("dhaka-form-cart");
    const savedWishlist = window.localStorage.getItem("dhaka-form-wishlist");
    const savedRecentlyViewed = window.localStorage.getItem("dhaka-form-recently-viewed");
    const parsedCart: unknown = savedCart ? JSON.parse(savedCart) : [];
    const parsedWishlist: unknown = savedWishlist ? JSON.parse(savedWishlist) : [];
    const parsedRecentlyViewed: unknown = savedRecentlyViewed ? JSON.parse(savedRecentlyViewed) : [];
    const wishlistProducts = decodeProductList(parsedWishlist);
    const recentlyViewedProducts = decodeProductList(parsedRecentlyViewed).slice(0, 6);
    const cart = Array.isArray(parsedCart)
      ? parsedCart.map(hydrateCartLine).filter((line): line is CartLine => Boolean(line))
      : [];
    storeSnapshot = {
      cart,
      wishlist: wishlistProducts.map((product) => product.id),
      wishlistProducts,
      recentlyViewed: recentlyViewedProducts.map((product) => product.id),
      recentlyViewedProducts,
      notice: "",
    };
  } catch {
    storeSnapshot = {
      ...emptyStore,
      notice: "Your saved bag could not be read. You can still shop and start a new one.",
    };
  }
  loaded = true;
}

function subscribeToStore(listener: () => void) {
  listeners.add(listener);
  if (!loaded) {
    loadStore();
    listener();
  }
  return () => {
    listeners.delete(listener);
  };
}

function commitStore(update: (current: StoreState) => StoreState) {
  storeSnapshot = update(storeSnapshot);
  try {
    window.localStorage.setItem("dhaka-form-cart", JSON.stringify(storeSnapshot.cart));
    window.localStorage.setItem("dhaka-form-wishlist", JSON.stringify(storeSnapshot.wishlistProducts));
    window.localStorage.setItem("dhaka-form-recently-viewed", JSON.stringify(storeSnapshot.recentlyViewedProducts));
  } catch {
    storeSnapshot = {
      ...storeSnapshot,
      notice: "Browser storage is unavailable. Your bag will not persist after this visit.",
    };
  }
  notifyStore();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeToStore, () => storeSnapshot, () => emptyStore);
  const addToCart = useCallback((product: Product, size: string, quantity = 1) => {
    commitStore((current) => {
      const available = product.stockBySize?.[size] ?? product.stock;
      if (available < 1) return { ...current, notice: "This piece is currently out of stock." };
      const matching = current.cart.find((line) => line.productId === product.id && line.size === size);
      const currentQuantity = matching?.quantity ?? 0;
      if (currentQuantity + quantity > available) {
        return { ...current, notice: `Only ${available} available in this size.` };
      }
      const cart = matching
        ? current.cart.map((line) =>
            line.productId === product.id && line.size === size
              ? { ...line, product, quantity: line.quantity + quantity }
              : line,
          )
        : [...current.cart, { productId: product.id, size, quantity, product }];
      return { ...current, cart, notice: `${product.name} added to your bag.` };
    });
  }, []);
  const setQuantity = useCallback((productId: string, size: string, quantity: number) => {
    commitStore((current) => {
      const product = current.cart.find((line) => line.productId === productId && line.size === size)?.product;
      if (!product) return current;
      const available = product.stockBySize?.[size] ?? product.stock;
      if (quantity < 1) {
        return {
          ...current,
          cart: current.cart.filter((line) => line.productId !== productId || line.size !== size),
        };
      }
      if (quantity > available) return { ...current, notice: `Only ${available} available in this size.` };
      return {
        ...current,
        cart: current.cart.map((line) =>
          line.productId === productId && line.size === size ? { ...line, quantity } : line,
        ),
      };
    });
  }, []);
  const removeFromCart = useCallback((productId: string, size: string) => {
    commitStore((current) => ({
      ...current,
      cart: current.cart.filter((line) => line.productId !== productId || line.size !== size),
    }));
  }, []);
  const toggleWishlist = useCallback((product: Product) => {
    commitStore((current) => {
      const exists = current.wishlist.includes(product.id);
      const wishlistProducts = exists
        ? current.wishlistProducts.filter((item) => item.id !== product.id)
        : [product, ...current.wishlistProducts];
      return {
        ...current,
        wishlist: wishlistProducts.map((item) => item.id),
        wishlistProducts,
      };
    });
  }, []);
  const clearNotice = useCallback(() => {
    storeSnapshot = { ...storeSnapshot, notice: "" };
    notifyStore();
  }, []);
  const clearCart = useCallback(() => {
    commitStore((current) => ({ ...current, cart: [] }));
  }, []);
  const recordViewed = useCallback((product: Product) => {
    commitStore((current) => {
      const recentlyViewedProducts = [
        product,
        ...current.recentlyViewedProducts.filter((item) => item.id !== product.id),
      ].slice(0, 6);
      return {
        ...current,
        recentlyViewed: recentlyViewedProducts.map((item) => item.id),
        recentlyViewedProducts,
      };
    });
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      cart: state.cart,
      wishlist: state.wishlist,
      wishlistProducts: state.wishlistProducts,
      recentlyViewed: state.recentlyViewed,
      recentlyViewedProducts: state.recentlyViewedProducts,
      addToCart,
      setQuantity,
      removeFromCart,
      toggleWishlist,
      cartCount: state.cart.reduce((total, line) => total + line.quantity, 0),
      cartSubtotal: state.cart.reduce((total, line) => total + line.product.price * line.quantity, 0),
      clearCart,
      notice: state.notice,
      clearNotice,
      recordViewed,
    }),
    [state, addToCart, setQuantity, removeFromCart, toggleWishlist, clearCart, clearNotice, recordViewed],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("Store components must be rendered inside StoreProvider.");
  return context;
}

function Icon({
  name,
  size = 20,
}: {
  name: "search" | "user" | "heart" | "bag" | "arrow" | "menu" | "close" | "plus" | "minus";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    user: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20c.7-3.2 3.2-5 7-5s6.3 1.8 7 5" /></>,
    heart: <path d="M20.4 8.7c0 4.2-8.4 10-8.4 10S3.6 12.9 3.6 8.7A4.1 4.1 0 0 1 12 6.6a4.1 4.1 0 0 1 8.4 2.1Z" />,
    bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    arrow: <><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <path d="M5 12h14" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function SiteHeader() {
  const { cartCount, wishlist } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = String(form.get("q") ?? "").trim();
    if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <>
      <div className="announcement">
        Dhaka Form <span aria-hidden="true">✳</span>
        Browse the collection and review delivery terms at checkout.
      </div>
      <header className="site-header">
        <button
          className="icon-button menu-toggle"
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
        <nav className={`main-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Main navigation">
          <Link href="/collections" onClick={() => setMenuOpen(false)}>Shop all</Link>
          <Link href="/collections?sort=newest" onClick={() => setMenuOpen(false)}>New in</Link>
          <Link href="/collections?category=Clothing" onClick={() => setMenuOpen(false)}>Clothing</Link>
          <Link href="/collections?category=Accessories" onClick={() => setMenuOpen(false)}>Accessories</Link>
        </nav>
        <Link className="wordmark" href="/" aria-label="Dhaka Form home">
          <span className="wordmark-mark">DF</span>
          <span className="wordmark-name">DHAKA FORM</span>
        </Link>
        <div className="header-actions">
          <button
            className="icon-button search-toggle"
            type="button"
            aria-label={searchOpen ? "Close search" : "Open search"}
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <Icon name="search" />
          </button>
          <Link className="icon-button desktop-account" href="/account" aria-label="Your account">
            <Icon name="user" />
          </Link>
          <Link className="icon-button" href="/wishlist" aria-label={`Wishlist, ${wishlist.length} items`}>
            <Icon name="heart" />
            {wishlist.length > 0 && <span className="icon-count">{wishlist.length}</span>}
          </Link>
          <Link className="icon-button" href="/cart" aria-label={`Shopping bag, ${cartCount} items`}>
            <Icon name="bag" />
            <span className="icon-count">{cartCount}</span>
          </Link>
        </div>
      </header>
      {searchOpen && (
        <form className="search-bar" action="/search" role="search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="site-search">Search products</label>
          <Icon name="search" size={18} />
          <input autoFocus id="site-search" name="q" placeholder="What are you looking for?" />
          <button className="text-button" type="submit">Search</button>
        </form>
      )}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="wordmark wordmark-footer" href="/">
            <span className="wordmark-mark">DF</span>
            <span className="wordmark-name">DHAKA FORM</span>
          </Link>
          <p>Thoughtful things for the everyday. Designed with care, right here in Bangladesh.</p>
          <span className="footer-location">Made for the way you live.</span>
        </div>
        <div className="footer-col">
          <h2>Explore</h2>
          <Link href="/collections">Shop all</Link>
          <Link href="/collections?sort=newest">New arrivals</Link>
          <Link href="/about">Our story</Link>
          <Link href="/contact">Get in touch</Link>
        </div>
        <div className="footer-col">
          <h2>Here to help</h2>
          <Link href="/faq">FAQs</Link>
          <Link href="/shipping">Shipping & returns</Link>
          <Link href="/returns">Refunds</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/terms">Terms & conditions</Link>
        </div>
        <div className="footer-newsletter">
          <h2>Letters from us</h2>
          <p>New things, thoughtful notes, and the occasional little treat.</p>
          <form>
            <label className="sr-only" htmlFor="footer-email">Email address</label>
            <input id="footer-email" type="email" placeholder="Your email address" disabled />
            <button type="button" disabled aria-label="Newsletter signup unavailable"><Icon name="arrow" /></button>
          </form>
          <small>Newsletter signup isn’t connected yet.</small>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Dhaka Form Studio</span>
        <span>Designed thoughtfully in Bangladesh</span>
        <span>BDT ৳ &nbsp;·&nbsp; English</span>
      </div>
    </footer>
  );
}

export function Notice() {
  const { notice, clearNotice } = useStore();
  if (!notice) return null;
  return (
    <div className="store-notice" role="status" aria-live="polite">
      {notice}
      <button className="notice-dismiss" type="button" onClick={clearNotice} aria-label="Dismiss notice">×</button>
    </div>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, wishlist, toggleWishlist } = useStore();
  const saved = wishlist.includes(product.id);
  const quickAddSize = product.sizes[0];
  const quickAddStock = product.stockBySize?.[quickAddSize] ?? product.stock;
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <Link href={`/products/${product.slug}`} className="product-image-link" aria-label={`View ${product.name}`}>
          <Image
            src={product.image}
            alt={`${product.name} in ${product.color}`}
            fill
            sizes="(max-width: 640px) 48vw, (max-width: 1000px) 32vw, 24vw"
          />
        </Link>
        {product.badge && <span className={`product-badge ${product.stock === 0 ? "badge-muted" : ""}`}>{product.badge}</span>}
        <button
          className={`wishlist-button ${saved ? "is-saved" : ""}`}
          type="button"
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={saved}
          onClick={() => toggleWishlist(product)}
        >
          <Icon name="heart" size={18} />
        </button>
        <button
          className="quick-add"
          type="button"
          disabled={quickAddStock === 0}
          onClick={() => addToCart(product, quickAddSize)}
        >
          {quickAddStock === 0 ? "Sold out" : "Quick add"} <Icon name="plus" size={15} />
        </button>
      </div>
      <div className="product-meta">
        <div className="product-title-row">
          <Link href={`/products/${product.slug}`} className="product-name">{product.name}</Link>
          {product.reviews > 0 && (
            <span className="product-rating" aria-label={`Rated ${product.rating.toFixed(1)} out of 5 from ${product.reviews} verified reviews`}>
              <span aria-hidden="true">★</span> {product.rating.toFixed(1)}
            </span>
          )}
        </div>
        <p className="product-colour">{product.color} {product.reviews > 0 && <span>· {product.reviews} verified reviews</span>}</p>
        <div className="product-price-row">
          <span>{formatPrice(product.price)}</span>
          {product.compareAt && <del>{formatPrice(product.compareAt)}</del>}
          {product.stock > 0 && product.stock <= 5 && <span className="stock-hint">Only {product.stock} left</span>}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: Product[] }) {
  return (
    <div className="product-grid">
      {items.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}

export function ProductPurchase({ product }: { product: Product }) {
  const { addToCart, recordViewed } = useStore();
  const [size, setSize] = useState(product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const gallery = product.images?.length ? product.images : [product.image];
  const availableStock = product.stockBySize?.[size] ?? product.stock;

  useEffect(() => {
    recordViewed(product);
  }, [product, recordViewed]);

  return (
    <div className="product-detail">
      <div className="detail-gallery">
        <div className="detail-image-main">
          <Image src={gallery[activeImage]} alt={`${product.name}, view ${activeImage + 1}`} fill priority sizes="(max-width: 800px) 100vw, 55vw" />
        </div>
        <div className="gallery-thumbs" aria-label="Product images">
          {gallery.map((src, index) => (
            <button
              key={`${src}-${index}`}
              className={`gallery-thumb ${index === activeImage ? "thumb-active" : ""}`}
              type="button"
              aria-label={`Show product image ${index + 1}`}
              aria-pressed={index === activeImage}
              onClick={() => setActiveImage(index)}
            >
              <Image src={src} alt="" fill sizes="80px" />
            </button>
          ))}
        </div>
      </div>
      <div className="detail-info">
        <div className="breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/collections">{product.category}</Link><span>/</span><span>{product.name}</span></div>
        <p className="eyebrow">{product.category} · Designed in Dhaka</p>
        <h1>{product.name}</h1>
        {product.reviews > 0 ? (
          <div className="detail-rating"><span aria-hidden="true">★</span> {product.rating.toFixed(1)} <a href="#reviews">({product.reviews} verified reviews)</a></div>
        ) : <p className="detail-rating">No verified reviews yet.</p>}
        <div className="detail-price">
          <strong>{formatPrice(product.price)}</strong>
          {product.compareAt && <del>{formatPrice(product.compareAt)}</del>}
          {product.compareAt && <span className="save-note">You save {formatPrice(product.compareAt - product.price)}</span>}
        </div>
        <p className="detail-description">{product.description}</p>
        <div className="detail-colour"><strong>Colour</strong><span>{product.color}</span></div>
        <fieldset className="size-select">
          <legend>Choose your size</legend>
          <div className="size-options">
            {product.sizes.map((option) => (
              <button
                key={option}
                className={`size-option ${size === option ? "size-selected" : ""}`}
                type="button"
                aria-pressed={size === option}
                disabled={(product.stockBySize?.[option] ?? product.stock) === 0}
                onClick={() => {
                  setSize(option);
                  setQuantity(1);
                }}
              >{option}</button>
            ))}
          </div>
        </fieldset>
        <details className="size-guide"><summary className="text-link">Size guide</summary><p>Size measurements will be added with the verified garment spec for each piece.</p></details>
        {availableStock === 0 ? (
          <div className="out-of-stock" role="status">This piece has found its home. Check back soon.</div>
        ) : (
          <>
            <div className="quantity-row">
              <span>Quantity</span>
              <div className="quantity-control">
                <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))}><Icon name="minus" size={15} /></button>
                <span aria-live="polite">{quantity}</span>
                <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => Math.min(availableStock, value + 1))}><Icon name="plus" size={15} /></button>
              </div>
              <span className="stock-note">{availableStock} in stock</span>
            </div>
            <button className="button button-dark button-full" type="button" onClick={() => addToCart(product, size, quantity)}>Add to bag <Icon name="bag" size={18} /></button>
          </>
        )}
        <div className="delivery-notes">
          <p><span>01</span> Delivery charges are calculated from your address at checkout.</p>
          <p><span>02</span> Review the current returns policy before placing an order.</p>
          <p><span>03</span> Product availability is checked when your order is placed.</p>
        </div>
        <div className="detail-accordion" id="reviews">
          <details><summary>Materials & care</summary><p>{product.material || "Material details have not been provided."} {product.care || "Care instructions have not been provided."}</p></details>
          <details><summary>Delivery & returns</summary><p>Delivery charges are calculated at checkout. Review the current returns policy before ordering.</p></details>
          <details><summary>Reviews ({product.reviews})</summary><p>{product.reviews > 0 ? "Only verified-purchase reviews from completed orders are included in this rating." : "There are no verified-purchase reviews for this product yet."}</p></details>
        </div>
      </div>
    </div>
  );
}

export function CartContent() {
  const { cart, cartSubtotal, removeFromCart, setQuantity } = useStore();
  const rows = cart.map((line) => ({
    line,
    product: line.product,
  }));

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <span className="empty-icon"><Icon name="bag" size={30} /></span>
        <p className="eyebrow">A little room for something lovely</p>
        <h2>Your bag is waiting.</h2>
        <p>When something feels just right, you’ll find it here.</p>
        <Link href="/collections" className="button button-dark">Explore the collection <Icon name="arrow" size={17} /></Link>
      </div>
    );
  }

  return (
    <div className="cart-layout">
      <div className="cart-items">
        {rows.map(({ line, product }) => product && (
          <article className="cart-row" key={`${line.productId}-${line.size}`}>
            <Link className="cart-image" href={`/products/${product.slug}`}>
              <Image src={product.image} alt={product.name} fill sizes="120px" />
            </Link>
            <div className="cart-item-info">
              <Link className="cart-item-name" href={`/products/${product.slug}`}>{product.name}</Link>
              <span>{product.color} · Size {line.size}</span>
              <span className={(product.stockBySize?.[line.size] ?? product.stock) < line.quantity ? "stock-error" : "stock-ok"}>
                {(product.stockBySize?.[line.size] ?? product.stock) < line.quantity ? "Availability may have changed — checkout will verify" : "Availability will be verified at checkout"}
              </span>
              <button className="text-link remove-link" type="button" onClick={() => removeFromCart(product.id, line.size)}>Remove</button>
            </div>
            <div className="cart-item-end">
              <strong>{formatPrice(product.price * line.quantity)}</strong>
              <div className="quantity-control quantity-small">
                <button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => setQuantity(product.id, line.size, line.quantity - 1)}><Icon name="minus" size={13} /></button>
                <span>{line.quantity}</span>
                <button type="button" aria-label={`Increase ${product.name} quantity`} onClick={() => setQuantity(product.id, line.size, line.quantity + 1)}><Icon name="plus" size={13} /></button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <aside className="order-summary">
        <h2>Order summary</h2>
        <div className="summary-line"><span>Subtotal</span><span>{formatPrice(cartSubtotal)}</span></div>
        <div className="summary-line"><span>Delivery</span><span>Calculated at checkout</span></div>
        <div className="summary-total"><span>Estimated total</span><strong>{formatPrice(cartSubtotal)}</strong></div>
        <p className="summary-note">Delivery and tax are calculated from the current business settings at checkout.</p>
        <Link href="/checkout" className="button button-dark button-full">Continue to checkout <Icon name="arrow" size={17} /></Link>
        <p className="safe-checkout">Prices and stock are verified before an order is placed.</p>
      </aside>
    </div>
  );
}

export function CheckoutForm({
  onlinePaymentEnabled,
  checkoutEnabled,
}: {
  onlinePaymentEnabled: boolean;
  checkoutEnabled: boolean;
}) {
  const { cart, cartSubtotal, clearCart } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payment, setPayment] = useState("cod");
  const idempotencyKey = useRef<string | null>(null);

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    const submittedPayment = payment;
    idempotencyKey.current ??= crypto.randomUUID();
    const form = new FormData(event.currentTarget);
    const payload = {
      idempotencyKey: idempotencyKey.current,
      items: cart.map((line) => ({
        productId: line.productId,
        size: line.size,
        quantity: line.quantity,
      })),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      address: String(form.get("address") ?? ""),
      division: String(form.get("division") ?? ""),
      district: String(form.get("district") ?? ""),
      area: String(form.get("area") ?? ""),
      postalCode: String(form.get("postalCode") ?? ""),
      note: String(form.get("note") ?? ""),
      paymentMethod: submittedPayment === "online" ? "SSLCOMMERZ" : "COD",
    };
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: unknown = await response.json();
      if (!response.ok || typeof result !== "object" || result === null || !("order" in result)) {
        const errorCode =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "object" &&
          result.error !== null &&
          "code" in result.error &&
          typeof result.error.code === "string"
            ? result.error.code
            : "";
        if (errorCode === "IDEMPOTENCY_KEY_REUSED") idempotencyKey.current = null;
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "object" &&
          result.error !== null &&
          "message" in result.error &&
          typeof result.error.message === "string"
            ? result.error.message
            : "We couldn’t place this order. Please review your details and try again.";
        throw new Error(message);
      }
      if (submittedPayment === "online") {
        if (!("paymentUrl" in result) || typeof result.paymentUrl !== "string") {
          throw new Error("The payment session was not created. No online payment was confirmed.");
        }
        window.location.assign(result.paymentUrl);
        return;
      }
      const order = result.order as { number?: unknown };
      clearCart();
      idempotencyKey.current = null;
      setSuccess(
        typeof order.number === "string"
          ? `Order ${order.number} is placed. Payment is due on delivery.`
          : "Your cash-on-delivery order is placed. Payment is due on delivery.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t place this order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (cart.length === 0) {
    return <div className="checkout-empty"><h2>Your bag is empty.</h2><Link className="button button-dark" href="/collections">Explore the collection</Link></div>;
  }
  return (
    <div className="checkout-layout">
      <form className="checkout-form" onSubmit={submitOrder}>
        <section className="checkout-section">
          <div className="checkout-heading"><span>01</span><div><h2>Contact</h2><p>Where can we reach you?</p></div></div>
          <label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Phone number<input type="tel" name="phone" autoComplete="tel" required placeholder="+880 1XXX-XXXXXX" pattern="[\d +()-]{8,20}" /></label>
        </section>
        <section className="checkout-section">
          <div className="checkout-heading"><span>02</span><div><h2>Delivery address</h2><p>We currently deliver within Bangladesh.</p></div></div>
          <div className="form-two-col">
            <label>First name<input name="firstName" autoComplete="given-name" required /></label>
            <label>Last name<input name="lastName" autoComplete="family-name" required /></label>
          </div>
          <label>Street address<input name="address" autoComplete="street-address" required placeholder="House, road, area" /></label>
          <div className="form-two-col">
            <label>Division<select name="division" required defaultValue=""><option value="" disabled>Select division</option>{["Dhaka", "Chattogram", "Rajshahi", "Khulna", "Barishal", "Sylhet", "Rangpur", "Mymensingh"].map((division) => <option key={division}>{division}</option>)}</select></label>
            <label>District<input name="district" required /></label>
          </div>
          <div className="form-two-col">
            <label>Area / upazila<input name="area" required /></label>
            <label>Postal code<input name="postalCode" inputMode="numeric" pattern="[0-9]{4}" required /></label>
          </div>
          <label>Delivery note <span className="optional-label">Optional</span><textarea name="note" rows={3} placeholder="Anything our delivery team should know?" /></label>
        </section>
        <section className="checkout-section">
          <div className="checkout-heading"><span>03</span><div><h2>Payment</h2><p>Choose how you’d like to pay.</p></div></div>
          <label className={`payment-choice ${payment === "cod" ? "payment-selected" : ""}`}>
            <input type="radio" name="payment" value="cod" checked={payment === "cod"} disabled={submitting} onChange={() => setPayment("cod")} />
            <span><strong>Cash on delivery</strong><small>Payment remains due at delivery.</small></span>
          </label>
          <label className={`payment-choice ${payment === "online" ? "payment-selected" : ""} ${onlinePaymentEnabled ? "" : "payment-disabled"}`}>
            <input type="radio" name="payment" value="online" checked={payment === "online"} disabled={submitting || !onlinePaymentEnabled} onChange={() => setPayment("online")} />
            <span><strong>Online payment</strong><small>{onlinePaymentEnabled ? "Secure hosted checkout by SSLCommerz." : "Not available — payment provider not configured."}</small></span>
          </label>
        </section>
        <div className="checkout-preview-notice" role="note">
          {checkoutEnabled
            ? "Your total is recalculated on the server. Items are reserved only when the order is accepted."
            : "Order placement is disabled until database, delivery/tax settings, support contact and reviewed customer policies are configured."}
        </div>
        {error && <p className="checkout-error" role="alert">{error}</p>}
        {success && <div className="checkout-success" role="status"><h2>Thank you.</h2><p>{success}</p><Link href="/account" className="under-link">Go to your account ↗</Link></div>}
        <button className="button button-dark button-full" type="submit" disabled={!checkoutEnabled || submitting || Boolean(success)}>{submitting ? "Placing order…" : payment === "online" ? "Continue to secure payment" : "Place cash-on-delivery order"} <Icon name="arrow" size={17} /></button>
      </form>
      <aside className="order-summary checkout-summary">
        <h2>Your order</h2>
        {cart.map((line) => {
          const product = line.product;
          return <div className="checkout-item" key={`${line.productId}-${line.size}`}><span>{product.name} <small>× {line.quantity} · {line.size}</small></span><strong>{formatPrice(product.price * line.quantity)}</strong></div>;
        })}
        <div className="summary-line"><span>Subtotal</span><span>{formatPrice(cartSubtotal)}</span></div>
        <div className="summary-line"><span>Delivery</span><span>Calculated from the current business settings</span></div>
        <div className="summary-total"><span>Total</span><strong>{formatPrice(cartSubtotal)}</strong></div>
      </aside>
    </div>
  );
}

export function WishlistContent() {
  const { wishlistProducts: saved } = useStore();
  if (!saved.length) {
    return <div className="empty-state"><span className="empty-icon"><Icon name="heart" size={30} /></span><p className="eyebrow">Keep the good ones close</p><h2>Your wishlist is yours to fill.</h2><p>Tap the heart on anything you love, and we’ll keep it here.</p><Link href="/collections" className="button button-dark">Find your favourites <Icon name="arrow" size={17} /></Link></div>;
  }
  return <ProductGrid items={saved} />;
}

export function RecentlyViewed({ excludeProductId }: { excludeProductId: string }) {
  const { recentlyViewedProducts } = useStore();
  const viewed = recentlyViewedProducts.filter((product) => product.id !== excludeProductId).slice(0, 4);
  if (!viewed.length) return null;
  return (
    <section className="related-products">
      <div className="section-heading"><div><span className="eyebrow">A little look back</span><h2>Recently <em>viewed.</em></h2></div></div>
      <ProductGrid items={viewed} />
    </section>
  );
}
