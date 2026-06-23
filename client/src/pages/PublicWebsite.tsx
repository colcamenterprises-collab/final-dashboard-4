import { Link, Navigate } from "react-router-dom";
import "./PublicWebsite.css";

const brandLogo = "/public/smash-brothers-logo.png";
const heroImage = "/images/menu/super-double-set.jpg";
const featuredProducts = [
  { name: "Super Double Set", copy: "Double smash burger, fries, and a cold drink.", image: "/images/menu/super-double-set.jpg" },
  { name: "Triple Smash Set", copy: "Triple patty stack with cheese, fries, and drink.", image: "/images/menu/triple-smash-set.jpg" },
  { name: "Karaage Chicken Burger", copy: "Crispy karaage chicken burger meal with fries.", image: "/images/menu/karaage-chicken-burger-meal-deal.jpg" },
  { name: "Single Smash Set", copy: "Classic single smash burger set, built fresh.", image: "/images/menu/single-smash-set.jpg" },
];

function Header() {
  return (
    <header className="sbw-header">
      <Link className="sbw-brand" to="/" aria-label="Smash Brothers home">
        <img src={brandLogo} alt="Smash Brothers" />
      </Link>
      <nav className="sbw-nav" aria-label="Customer navigation">
        <Link to="/menu">Menu</Link>
        <Link to="/membership">Membership</Link>
        <Link to="/order">Order Online</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="sbw-footer">
      <div className="sbw-footer-inner">
        <Link className="sbw-footer-brand" to="/" aria-label="Smash Brothers home">
          <img src={brandLogo} alt="Smash Brothers" />
        </Link>
        <div className="sbw-footer-copy">
          <strong>Smash Brothers Burgers</strong>
          <span>Rawai, Phuket</span>
        </div>
        <div className="sbw-footer-links">
          <Link to="/menu">Menu</Link>
          <Link to="/membership">Membership</Link>
          <Link to="/order">Order Online</Link>
          <Link to="/staff">Staff Login</Link>
        </div>
      </div>
    </footer>
  );
}

function ProductFeature({ product }: { product: typeof featuredProducts[number] }) {
  return (
    <Link className="sbw-product-feature" to="/order">
      <img src={product.image} alt={product.name} />
      <div>
        <span>Order Online</span>
        <h3>{product.name}</h3>
        <p>{product.copy}</p>
      </div>
    </Link>
  );
}

function PublicHero() {
  return (
    <section className="sbw-hero" style={{ "--sbw-hero-image": `url(${heroImage})` } as React.CSSProperties}>
      <Header />
      <div className="sbw-hero-content">
        <p className="sbw-eyebrow">Smash Brothers Burgers</p>
        <h1>Premium Smash Burgers in Rawai</h1>
        <p>Fresh smashed burgers, crispy sides, cold drinks, and fast online ordering.</p>
        <div className="sbw-hero-actions">
          <Link to="/order">Order Online</Link>
          <Link to="/menu">View Menu</Link>
        </div>
      </div>
    </section>
  );
}

export function PublicHome() {
  return (
    <main className="sbw-page">
      <PublicHero />
      <section className="sbw-intro" aria-label="Smash Brothers introduction">
        <p>Made to order. Built for pickup. Served without shortcuts.</p>
      </section>
      <section className="sbw-menu-preview" aria-labelledby="featured-products-title">
        <div className="sbw-section-heading">
          <span>Featured Products</span>
          <h2 id="featured-products-title">Big flavour. Simple ordering.</h2>
        </div>
        <div className="sbw-feature-grid">
          {featuredProducts.slice(0, 2).map((product) => <ProductFeature key={product.name} product={product} />)}
        </div>
      </section>
      <SmashClubSection />
      <Footer />
    </main>
  );
}

export function PublicMenu() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-page-title">
        <span>Menu</span>
        <h1>Featured Smash Sets</h1>
        <p>Large featured products using approved Smash Brothers product assets.</p>
      </section>
      <section className="sbw-feature-grid sbw-feature-grid-page" aria-label="Featured menu products">
        {featuredProducts.map((product) => <ProductFeature key={product.name} product={product} />)}
      </section>
      <Footer />
    </main>
  );
}

function SmashClubSection() {
  return (
    <section className="sbw-smash-club">
      <div>
        <span>Membership</span>
        <h2>SMASH CLUB</h2>
      </div>
      <div className="sbw-smash-club-copy">
        <p>Earn rewards.</p>
        <p>Exclusive offers.</p>
        <p>Faster ordering.</p>
        <p>Skip the queue.</p>
        <Link to="/membership">Join Smash Club</Link>
      </div>
    </section>
  );
}

export function PublicMembership() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-membership-page">
        <SmashClubSection />
      </section>
      <Footer />
    </main>
  );
}

export function StaffEntry() { return <Navigate to="/login" replace />; }
