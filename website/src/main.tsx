import React from "react";
import { createRoot } from "react-dom/client";
import { MapPin, Phone, Star } from "lucide-react";
import "./styles.css";

const STAFF_LOGIN_URL = "https://app.smashbrosburgers.com";
const ORDER_URL = "/order-now";

const menuSections = [
  { title: "Signature Smash Burgers", items: ["Single Smash", "Double Smash", "Super Double", "Triple Smash"] },
  { title: "Chicken", items: ["Karaage Chicken Burger", "Crispy Chicken Burger", "Chicken Loaded Fries"] },
  { title: "Sides", items: ["House Fries", "Dirty Fries", "Cheese Fries", "Onion Rings"] },
  { title: "Drinks", items: ["Soft Drinks", "Water", "Milkshakes", "Seasonal Specials"] },
];

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="Smash Brothers Burgers home">Smash Brothers Burgers</a>
      <nav aria-label="Public website navigation">
        <a href="#menu">Menu</a>
        <a href="#about">About</a>
        <a href="#location">Location / Contact</a>
        <a href="#membership">Membership</a>
        <a className="nav-order" href={ORDER_URL}>Order Now</a>
        <a className="staff-login" href={STAFF_LOGIN_URL}>Staff Login</a>
      </nav>
    </header>
  );
}

function Home() {
  return (
    <section id="home" className="hero section-grid">
      <div className="hero-copy">
        <p className="eyebrow">Fresh smashed burgers, cooked to order</p>
        <h1>Smash Brothers Burgers</h1>
        <p className="lead">A public customer website for Smash Brothers Burgers menu, ordering, location details, and membership updates.</p>
        <div className="actions">
          <a className="primary-button" href={ORDER_URL}>Order Now</a>
          <a className="secondary-button" href="#menu">View Menu</a>
        </div>
      </div>
      <img className="hero-image" src="/assets/sbb-burger-hero.svg" alt="Smash Brothers Burgers meal" />
    </section>
  );
}

function Menu() {
  return (
    <section id="menu" className="content-section">
      <p className="eyebrow">Menu</p>
      <h2>Smash classics and customer favourites</h2>
      <div className="menu-grid">
        {menuSections.map((section) => (
          <article className="menu-card" key={section.title}>
            <h3>{section.title}</h3>
            <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="split-section">
      <div>
        <p className="eyebrow">About</p>
        <h2>Built around hot grills, crisp edges, and straightforward service.</h2>
      </div>
      <p>Smash Brothers Burgers serves seared-to-order burgers, loaded sides, chicken favourites, and drinks for customers who want a clear menu and a fast ordering path.</p>
    </section>
  );
}

function LocationContact() {
  return (
    <section id="location" className="content-section location-panel">
      <p className="eyebrow">Location / Contact</p>
      <h2>Visit or contact Smash Brothers Burgers</h2>
      <div className="contact-grid">
        <div><MapPin aria-hidden="true" /><span>Location details coming soon.</span></div>
        <div><Phone aria-hidden="true" /><span>Contact details coming soon.</span></div>
      </div>
    </section>
  );
}

function Membership() {
  return (
    <section id="membership" className="split-section membership">
      <div>
        <p className="eyebrow">Membership</p>
        <h2>Smash Club membership</h2>
      </div>
      <div>
        <p>Membership details are coming soon. Customers can check back for future offers, rewards, and updates.</p>
        <a className="secondary-button" href={ORDER_URL}><Star aria-hidden="true" /> Order while you wait</a>
      </div>
    </section>
  );
}

function OrderNow() {
  return (
    <section id="order-now" className="order-band">
      <h2>Ready to eat?</h2>
      <p>Use this public website for customer-facing content only. Staff tools remain at the admin dashboard.</p>
      <a className="primary-button" href={ORDER_URL}>Order Now</a>
    </section>
  );
}

function Footer() {
  return <footer><strong>Smash Brothers Burgers</strong><a href={STAFF_LOGIN_URL}>Staff Login</a></footer>;
}

function App() {
  return <><Header /><main><Home /><Menu /><About /><LocationContact /><Membership /><OrderNow /></main><Footer /></>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
