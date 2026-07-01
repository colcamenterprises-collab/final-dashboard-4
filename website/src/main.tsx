import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Lock, MapPin, Menu as MenuIcon, ShoppingBag, Star } from "lucide-react";
import { motion } from "framer-motion";
import "./styles.css";

const STAFF_LOGIN_URL = "https://app.smashbrothersburgers.com";
const ORDER_URL = "/order-now";
const navItems = ["Menu", "About", "Membership", "Contact"];
const ingredientLayers = ["Top Bun", "Cheese", "Tomato", "Onion", "Bacon", "Patty", "Lettuce", "Bottom Bun"];

function Button({ children, href, variant = "primary", icon }: { children: React.ReactNode; href: string; variant?: "primary" | "outline" | "dark"; icon?: React.ReactNode }) {
  return <motion.a whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className={`button button--${variant}`} href={href}>{icon}<span>{children}</span></motion.a>;
}

function Logo() {
  return <span className="logo"><span className="logo__mark"><MenuIcon size={23} strokeWidth={3.5} /></span><span className="logo__text">Smash<br />Brothers<br />Burgers</span></span>;
}

function BurgerArt({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return <div className={`burger-art ${compact ? "burger-art--compact" : ""} ${className}`} aria-hidden="true">
    <span className="bun bun--top" /><span className="lettuce" /><span className="tomato" /><span className="bacon" /><span className="cheese" /><span className="patty" /><span className="sauce" /><span className="onion" /><span className="bun bun--bottom" />
  </div>;
}

function AngusBadge() {
  return <div className="angus" aria-label="100 percent Angus beef"><Star size={14} fill="currentColor" /><strong>100%</strong><span>Angus</span><span>Beef</span></div>;
}

function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <header className={`navigation ${scrolled ? "navigation--solid" : ""}`}><div className="nav-shell">
    <a className="brand" href="#home" aria-label="Smash Brothers Burgers home"><Logo /></a>
    <nav className="nav-links" aria-label="Website navigation">{navItems.map((item) => <a key={item} href={`#${item.toLowerCase()}`}>{item}</a>)}<Button href={ORDER_URL} icon={<ShoppingBag size={14} />}>Order Now</Button><Button href={STAFF_LOGIN_URL} variant="outline" icon={<Lock size={14} />}>Staff Login</Button></nav>
  </div></header>;
}

function Hero() {
  return <section id="home" className="hero"><div className="hero__inner">
    <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="hero__type" aria-hidden="true"><span>SMOKY</span><span>CHEESY</span><span>BURGERS</span></motion.div>
    <motion.div className="hero__burger" animate={{ y: [0, -22, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}><BurgerArt /><AngusBadge /></motion.div>
    <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="hero__actions"><Button href={ORDER_URL} icon={<ShoppingBag size={15} />}>Order Now</Button><Button href="#menu" variant="dark" icon={<MenuIcon size={16} />}>View Menu</Button></motion.div>
  </div></section>;
}

function Flavor() {
  return <section id="about" className="section section--black"><motion.article initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flavor-card card-yellow"><BurgerArt compact /><div><h2>FLAVOUR THAT MAKES HISTORY</h2><p>Every bite is bold, smoky, and unforgettable. Built hot, pressed hard, and served with Smash Brothers confidence.</p></div></motion.article></section>;
}

function Promotions() {
  return <section id="menu" className="section section--black promo-grid"><motion.article whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 28 }} viewport={{ once: true }} className="promo-card promo-card--dark"><h3>FREE FRIES<br />WITH EVERY<br />BURGER</h3><div className="burst">HOT</div><div className="fries" aria-hidden="true"><i /><i /><i /><i /><i /><b /></div></motion.article><motion.article whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 28 }} viewport={{ once: true }} className="promo-card card-yellow"><h3>REAL<br />SMASH<br />BURGERS</h3><BurgerArt compact /></motion.article></section>;
}

function IngredientStack() {
  return <section className="ingredient-section"><div className="stack-type" aria-hidden="true">THE BEST<br />SMASH<br />BURGER<br />IN<br />PHUKET</div><div className="ingredient-stack" aria-label="Exploded burger ingredients">{ingredientLayers.map((layer, index) => <motion.div key={layer} className={`layer layer--${index + 1}`} animate={{ y: [0, index % 2 ? 16 : -16, 0] }} transition={{ duration: 4 + index * .18, repeat: Infinity, ease: "easeInOut" }}><span>{layer}</span></motion.div>)}</div></section>;
}

function Testimonials() {
  return <section className="section section--black"><article className="testimonial card-yellow"><div className="customer" aria-label="Customer enjoying a burger" /><div className="quote"><div className="stars">★★★★★</div><p>“Hands down, the best burger I’ve ever had! Perfectly grilled and bursting with flavor.”</p><strong>– Kristen Stewart</strong><div className="dots"><span /><span /><span /><span /></div></div><b>1/5</b></article></section>;
}

function Gallery() {
  return <section id="membership" className="gallery section--black"><h2>Crispy golden<br />fries included<br />always.</h2><div className="gallery__masonry"><div><BurgerArt compact /></div><div className="photo photo--tall" /><div className="photo photo--wide" /><div className="photo photo--small" /></div><div className="gallery__actions"><Button href="#menu" variant="dark" icon={<MenuIcon size={15} />}>Menu</Button><Button href={ORDER_URL} icon={<ShoppingBag size={15} />}>Order Now</Button></div></section>;
}

function Footer() {
  return <footer id="contact" className="footer"><div className="footer__grid"><div><Logo /></div><div><h3>Quick Links</h3><a href="#home">Home</a><a href="#menu">Menu</a><a href={ORDER_URL}>Order Online</a><a href="#membership">Membership</a><a href="#contact">Contact</a></div><div><h3>Follow Us</h3><p className="social">◎ f ♪</p></div><div><h3>Hours</h3><p>Mon – Thu&nbsp;&nbsp; 11:00 – 23:00</p><p>Fri – Sat&nbsp;&nbsp; 11:00 – 01:00</p><p>Sunday&nbsp;&nbsp; 11:00 – 22:00</p></div></div><div className="footer__bar"><span>© Smash Brothers Burgers. All rights reserved.</span><span><MapPin size={14} fill="currentColor" /> Phuket, Thailand</span><Button href={ORDER_URL}>Order</Button></div></footer>;
}

function App() { return <><Navigation /><main><Hero /><Flavor /><Promotions /><IngredientStack /><Testimonials /><Gallery /></main><Footer /></>; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
