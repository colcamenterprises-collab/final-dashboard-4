import { Link, Navigate } from "react-router-dom";
import "./PublicWebsite.css";

const logo = "/smash-brothers-logo.png";
const heroBurger = "/images/menu/super-double-set.jpg";
const menuImages = [
  { name: "Super Double Set", image: "/images/menu/super-double-set.jpg" },
  { name: "Triple Smash Set", image: "/images/menu/triple-smash-set.jpg" },
  { name: "Double Set", image: "/images/menu/double-set.jpg" },
  { name: "Karaage Chicken Burger", image: "/images/menu/karaage-chicken-burger-meal-deal.jpg" },
];

function Header() {
  return (
    <header className="sbw-header">
      <Link className="sbw-brand" to="/" aria-label="Smash Brothers home">
        <img src={logo} alt="Smash Brothers" />
      </Link>
      <nav className="sbw-nav" aria-label="Customer navigation">
        <Link to="/menu">Menu</Link>
        <Link to="/membership">Smash Club</Link>
        <Link to="/staff">Staff Login</Link>
      </nav>
      <Link className="sbw-order-button" to="/order">Order Online</Link>
    </header>
  );
}

function Footer() {
  return (
    <footer className="sbw-footer">
      <img src={logo} alt="Smash Brothers" />
      <nav aria-label="Footer navigation">
        <Link to="/menu">Menu</Link>
        <Link to="/membership">Smash Club</Link>
        <Link to="/order">Order Online</Link>
        <Link to="/staff">Staff Login</Link>
      </nav>
    </footer>
  );
}

export function PublicHome() {
  return (
    <main className="sbw-page">
      <section className="sbw-hero">
        <Header />
        <div className="sbw-hero-copy">
          <p>Smash Brothers Burgers</p>
          <h1>Phuket's Favorite Smash Burger</h1>
        </div>
        <img className="sbw-hero-burger" src={heroBurger} alt="Smash Brothers burger" />
      </section>
      <section className="sbw-intro" aria-label="Smash Brothers intro">
        <p>Fresh smashed burgers, crispy sides, and fast ordering in Rawai.</p>
      </section>
      <Footer />
    </main>
  );
}

export function PublicMenu() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-page-heading">
        <p>Menu</p>
        <h1>Made to Smash</h1>
      </section>
      <section className="sbw-feature-list" aria-label="Featured menu items">
        {menuImages.map((item) => (
          <Link className="sbw-feature-item" to="/order" key={item.name}>
            <img src={item.image} alt={item.name} />
            <span>{item.name}</span>
          </Link>
        ))}
      </section>
      <Footer />
    </main>
  );
}

export function PublicMembership() {
  return (
    <main className="sbw-page">
      <Header />
      <section className="sbw-club">
        <p>SMASH CLUB</p>
        <h1>Earn rewards.<br />Exclusive offers.<br />Faster ordering.<br />Skip the queue.</h1>
        <Link className="sbw-order-button" to="/order">Join Smash Club</Link>
      </section>
      <Footer />
    </main>
  );
}

export function StaffEntry() { return <Navigate to="/login" replace />; }
