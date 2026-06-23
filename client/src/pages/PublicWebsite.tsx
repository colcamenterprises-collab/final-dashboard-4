import { Link, Navigate } from "react-router-dom";
import "./PublicWebsite.css";

const headerImage = "https://assets.website-files.com/6424633f5e28ae5f3582e4ec/64248cf05e011405c2824b67_Header-img.png";
const friesImage = "https://assets.website-files.com/6424633f5e28ae5f3582e4ec/6424945a7580c4e4c1368fdc_fries.jpg";
const burgerImage = "https://assets.website-files.com/6424633f5e28ae5f3582e4ec/642497dad1c7c739c55cc3c6_burger-img.jpg";

function Header() {
  return (
    <header className="bh-header">
      <Link className="bh-logo" to="/">Burger Heaven</Link>
      <nav className="bh-nav" aria-label="Primary navigation">
        <Link to="/#about">About</Link>
        <Link to="/menu">Menu</Link>
        <Link className="bh-nav-button" to="/order">Order Online</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bh-footer">
      <div className="bh-footer-card">
        <div className="bh-footer-brand">Burger<br />Heaven</div>
        <div className="bh-footer-col">
          <h3>More</h3>
          <Link to="/#about">About</Link>
          <Link to="/menu">Menu</Link>
          <Link to="/#locations">Locations</Link>
          <Link to="/#privacy">Privacy</Link>
        </div>
        <div className="bh-footer-col">
          <h3>Hours</h3>
          <p>Open From</p>
          <p>11AM to</p>
          <p>11PM daily</p>
        </div>
        <div className="bh-newsletter">
          <h3>Join Our Newsletter</h3>
          <form>
            <input aria-label="Join Our Newsletter" />
            <button type="button">Submit</button>
          </form>
        </div>
        <p className="bh-copyright">Copyright Burger Heaven &amp; Flux Academy</p>
        <p className="bh-developed">Developed by ideapeel</p>
      </div>
    </footer>
  );
}

function SampleHome() {
  return (
    <main className="bh-page">
      <section className="bh-hero">
        <Header />
        <div className="bh-hero-inner">
          <h1>NEW YORK’S FAVORITE ORGANIC HAMBURGER JOINT</h1>
          <img className="bh-hero-burger" src={headerImage} alt="Burger Heaven hamburgers" />
        </div>
      </section>

      <section id="about" className="bh-about">
        <div>
          <h2>the burger above all burgers</h2>
        </div>
        <div className="bh-about-copy">
          <p>Lorem ipsum dolor sit amet, consectetur<br />adipiscing elit. Aenean nec ornare neque.</p>
          <Link to="/#about">About us</Link>
        </div>
      </section>

      <section className="bh-products">
        <Link className="bh-product bh-fries" to="/order">
          <img src={friesImage} alt="salt & Vinegar french fries" />
          <div className="bh-product-label">
            <h3>salt &amp; Vinegar<br />french fries</h3>
            <span>Order Online</span>
          </div>
        </Link>
        <Link className="bh-product" to="/order">
          <img src={burgerImage} alt="crispy chicken sandwich" />
          <div className="bh-product-label">
            <h3>crispy chicken<br />sandwich</h3>
            <span>Order Online</span>
          </div>
        </Link>
      </section>

      <section className="bh-marquee" aria-label="Customer quote">
        <span>“ the best burger i’ve ever had “</span>
        <span>“ the best burger i’ve ever had “</span>
      </section>


      <section className="bh-order-cta">
        <h2>order online or<br />come visit us today</h2>
        <Link to="/order">Get started</Link>
      </section>

      <Footer />
    </main>
  );
}

export function PublicHome() { return <SampleHome />; }
export function PublicMenu() { return <SampleHome />; }
export function PublicMembership() { return <SampleHome />; }
export function StaffEntry() { return <Navigate to="/login" replace />; }
