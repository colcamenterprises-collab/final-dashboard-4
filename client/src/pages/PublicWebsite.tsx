import { Link, Navigate } from "react-router-dom";
import "./PublicWebsite.css";

const heroSet = "/images/menu/super-double-set.jpg";
const doubleSet = "/images/menu/double-set.jpg";
const singleSet = "/images/menu/single-smash-set.jpg";
const tripleSet = "/images/menu/triple-smash-set.jpg";
const chickenSet = "/images/menu/karaage-chicken-burger-meal-deal.jpg";

const featured = [
  { name: "Super Double Set", kicker: "Double smash burger, fries, and drink.", image: heroSet },
  { name: "Triple Smash Set", kicker: "Three patties, melted cheese, fries, and drink.", image: tripleSet },
  { name: "Karaage Chicken Burger", kicker: "Crispy chicken burger meal with fries.", image: chickenSet },
];

const menuGroups = [
  { title: "Smash Burger Sets", items: ["Single Smash Set", "Double Set", "Super Double Set", "Triple Smash Set"] },
  { title: "Chicken", items: ["Karaage Chicken Burger Meal Deal", "Crispy Chicken Burger", "Chicken Loaded Fries"] },
  { title: "Sides", items: ["House Fries", "Dirty Fries", "Cheese Fries", "Onion Rings"] },
  { title: "Drinks", items: ["Soft Drinks", "Water", "Milkshakes", "Seasonal Specials"] },
];

function Header() {
  return (
    <header className="sbw-header">
      <Link className="sbw-brand" to="/" aria-label="Smash Brothers home">
        <span className="sbw-logo-mark" aria-hidden="true">SB</span>
        <span>Smash Brothers</span>
      </Link>
      <nav className="sbw-nav" aria-label="Customer navigation">
        <Link to="/menu">View Menu</Link>
        <Link to="/membership">Membership</Link>
        <Link className="sbw-nav-cta" to="/order">Order Online</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="sbw-footer">
      <div className="sbw-footer-card">
        <div className="sbw-footer-brand">
          <span className="sbw-logo-mark" aria-hidden="true">SB</span>
          <strong>Smash Brothers</strong>
          <span>Rawai, Phuket</span>
        </div>
        <div className="sbw-footer-links">
          <Link to="/menu">View Menu</Link>
          <Link to="/membership">Membership</Link>
          <Link to="/order">Order Online</Link>
        </div>
        <Link className="sbw-staff-link" to="/staff">Staff Login</Link>
      </div>
    </footer>
  );
}

function ProductCard({ item, tall = false }: { item: typeof featured[number]; tall?: boolean }) {
  return (
    <Link className={`sbw-product-card ${tall ? "is-tall" : ""}`} to="/order">
      <img src={item.image} alt={item.name} />
      <div className="sbw-product-copy">
        <h3>{item.name}</h3>
        <p>{item.kicker}</p>
        <span>Order Online</span>
      </div>
    </Link>
  );
}

export function PublicHome() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-hero">
        <div className="sbw-hero-copy">
          <p className="sbw-eyebrow">Rawai, Phuket</p>
          <h1>Smash Brothers Burgers</h1>
          <p className="sbw-hero-text">Premium smash burger sets built for fast ordering, clean pickup, and serious burger people.</p>
          <div className="sbw-hero-actions">
            <Link to="/order">Order Online</Link>
            <Link to="/menu">View Menu</Link>
          </div>
        </div>
        <div className="sbw-hero-media">
          <img src={heroSet} alt="Super Double Smash Burger Set" />
          <div className="sbw-hero-badge"><strong>Smash Sets</strong><span>Burger. Fries. Drink.</span></div>
        </div>
      </section>

      <section className="sbw-club-block">
        <div><p className="sbw-eyebrow dark">Smash Club</p><h2>Members Eat First</h2></div>
        <div><p>Digital membership is prepared for rewards, faster ordering, and regular customer access.</p><Link to="/membership">Join Membership</Link></div>
      </section>

      <section className="sbw-featured" aria-labelledby="featured-title">
        <div className="sbw-section-title"><p className="sbw-eyebrow">Featured Sets</p><h2 id="featured-title">Built To Order</h2></div>
        <div className="sbw-product-grid">{featured.map((item, index) => <ProductCard key={item.name} item={item} tall={index === 0} />)}</div>
      </section>

      <section className="sbw-order-band"><h2>Order Online or Visit Us Today</h2><Link to="/order">Start Order</Link></section>
      <Footer />
    </main>
  );
}

export function PublicMenu() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-page-hero"><p className="sbw-eyebrow">Public Menu</p><h1>Made to Smash</h1><p>Premium burger sets, crispy chicken, sides, and drinks.</p></section>
      <section className="sbw-menu-grid">{menuGroups.map((group) => <article className="sbw-menu-card" key={group.title}><h2>{group.title}</h2>{group.items.map((item) => <Link to="/order" key={item}><span>{item}</span><small>Order Online</small></Link>)}</article>)}</section>
      <section className="sbw-product-grid sbw-menu-products">{featured.map((item) => <ProductCard key={item.name} item={item} />)}</section>
      <Footer />
    </main>
  );
}

export function PublicMembership() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-membership-hero">
        <div><p className="sbw-eyebrow">Membership</p><h1>Smash Club</h1><p>Digital member access for future rewards, faster ordering, and regular customer updates.</p><Link to="/order">Order Now</Link></div>
        <div className="sbw-card-preview"><span className="sbw-logo-mark" aria-hidden="true">SB</span><span>Member Card</span><strong>SMASH CLUB</strong><small>Rewards coming soon</small></div>
      </section>
      <section className="sbw-membership-strip"><img src={singleSet} alt="Single Smash Set" /><img src={doubleSet} alt="Double Set" /><img src={tripleSet} alt="Triple Smash Set" /></section>
      <Footer />
    </main>
  );
}

export function StaffEntry() { return <Navigate to="/login" replace />; }
