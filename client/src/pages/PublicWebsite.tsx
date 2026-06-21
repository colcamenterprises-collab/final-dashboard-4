import { Link, Navigate } from "react-router-dom";
import "./PublicWebsite.css";

const logo = "/smash-brothers-logo.png";
const heroBurger = "/uploads/menu-items/5580-1766797583089-469419249.png";
const mealPhoto = "/uploads/menu-items/test-image-1762499242060-955450730.jpg";

const featured = [
  { name: "Super Double Bacon", kicker: "Double smashed patties, cheese, bacon, house sauce.", image: heroBurger },
  { name: "Dirty Fries", kicker: "Loaded fries built for the burger table.", image: mealPhoto },
  { name: "Big Rooster", kicker: "Crispy chicken, pickles, sauce, stacked high.", image: mealPhoto },
];

const menuGroups = [
  { title: "Smash Burgers", items: ["Super Double Bacon", "Classic Smash", "Cheese Smash", "Phuket Heat"] },
  { title: "Chicken", items: ["Big Rooster", "Crispy Chicken Sandwich", "Chicken Loaded Fries"] },
  { title: "Sides", items: ["Dirty Fries", "House Fries", "Cheese Fries", "Onion Rings"] },
  { title: "Drinks", items: ["Soft Drinks", "Water", "Milkshakes", "Seasonal Specials"] },
];

function Header() {
  return (
    <header className="sbw-header">
      <Link className="sbw-brand" to="/" aria-label="Smash Brothers home">
        <img src={logo} alt="Smash Brothers" />
        <span>Smash Brothers</span>
      </Link>
      <nav className="sbw-nav" aria-label="Customer navigation">
        <Link to="/menu">Menu</Link>
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
        <div className="sbw-footer-brand"><img src={logo} alt="" /><strong>Smash Brothers</strong><span>Rawai, Phuket</span></div>
        <div className="sbw-footer-links"><Link to="/menu">Menu</Link><Link to="/membership">Membership</Link><Link to="/order">Order Online</Link></div>
        <Link className="sbw-staff-link" to="/staff">Staff Login</Link>
      </div>
    </footer>
  );
}

function ProductCard({ item, tall = false }: { item: typeof featured[number]; tall?: boolean }) {
  return (
    <Link className={`sbw-product-card ${tall ? "is-tall" : ""}`} to="/order">
      <img src={item.image} alt="" />
      <div className="sbw-product-copy"><h3>{item.name}</h3><p>{item.kicker}</p><span>Order Online</span></div>
    </Link>
  );
}

export function PublicHome() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-hero">
        <div className="sbw-scribble sbw-scribble-left" />
        <div className="sbw-scribble sbw-scribble-right" />
        <p className="sbw-eyebrow">Rawai, Phuket</p>
        <h1>Phuket's<br />Favorite<br />Smash Burger</h1>
        <div className="sbw-hero-actions"><Link to="/order">Order Online</Link><Link to="/menu">View Menu</Link></div>
        <img className="sbw-hero-burger" src={heroBurger} alt="Smash Brothers burger" />
      </section>
      <section className="sbw-club-block">
        <h2>Smash Club</h2>
        <p>Digital membership cards. Rewards. Faster ordering.</p>
        <Link to="/membership">Join Now</Link>
      </section>
      <section className="sbw-featured" aria-labelledby="featured-title">
        <h2 id="featured-title">Burger I've Ever Wanted</h2>
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
      <section className="sbw-page-hero"><p className="sbw-eyebrow">Public Menu</p><h1>Made to Smash</h1><p>Premium burgers, dirty fries, crispy chicken, and cold drinks.</p></section>
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
        <div><p className="sbw-eyebrow">Coming Soon</p><h1>Smash Club</h1><p>Digital card preview, future rewards, and faster ordering for regulars in Rawai.</p><Link to="/order">Order Now</Link></div>
        <div className="sbw-card-preview"><img src={logo} alt="" /><span>Member Card</span><strong>SMASH CLUB</strong><small>Rewards coming soon</small></div>
      </section>
      <Footer />
    </main>
  );
}

export function StaffEntry() { return <Navigate to="/login" replace />; }
