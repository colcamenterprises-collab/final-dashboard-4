import React from "react";
import { createRoot } from "react-dom/client";
import { Lock, Menu as MenuIcon, ShoppingBag, Star } from "lucide-react";
import "./styles.css";

const STAFF_LOGIN_URL = "https://app.smashbrosburgers.com";
const ORDER_URL = "/order-now";

const navItems = ["Menu", "About", "Membership", "Contact"];
const placeholders = {
  feature: ["Placeholder feature", "Placeholder story"],
  promos: ["Placeholder promo one", "Placeholder promo two"],
  burgers: ["Placeholder burger one", "Placeholder burger two", "Placeholder burger three"],
  reasons: ["Placeholder reason one", "Placeholder reason two", "Placeholder reason three"],
  gallery: ["Placeholder image one", "Placeholder image two", "Placeholder image three", "Placeholder image four"],
  testimonials: ["Placeholder quote one", "Placeholder quote two", "Placeholder quote three"],
};

type ButtonProps = {
  children: React.ReactNode;
  href: string;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
};

function Button({ children, href, variant = "primary", icon }: ButtonProps) {
  return (
    <a className={`button button--${variant}`} href={href}>
      {icon}
      <span>{children}</span>
    </a>
  );
}

function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`container ${className}`}>{children}</div>;
}

function Section({ id, tone = "dark", children, className = "" }: { id?: string; tone?: "dark" | "light" | "yellow" | "black"; children: React.ReactNode; className?: string }) {
  return <section id={id} className={`section section--${tone} ${className}`}>{children}</section>;
}

function Heading({ eyebrow, title, align = "left" }: { eyebrow?: string; title: string; align?: "left" | "center" }) {
  return (
    <div className={`heading heading--${align}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
    </div>
  );
}

function Grid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid ${className}`}>{children}</div>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <article className={`card ${className}`}>{children}</article>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <div className="badge"><Star aria-hidden="true" size={18} fill="currentColor" />{children}</div>;
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}

function Navigation() {
  return (
    <header className="navigation">
      <Container className="navigation__inner">
        <a className="brand" href="#home" aria-label="Smash Brothers Burgers home">
          <span className="brand__mark"><MenuIcon size={24} aria-hidden="true" /></span>
          <span>Smash<br />Brothers<br />Burgers</span>
        </a>
        <nav className="navigation__links" aria-label="Public website navigation">
          {navItems.map((item) => <a key={item} href={`#${item.toLowerCase()}`}>{item}</a>)}
          <Button href={ORDER_URL} icon={<ShoppingBag size={16} aria-hidden="true" />}>Order Now</Button>
          <Button href={STAFF_LOGIN_URL} variant="secondary" icon={<Lock size={16} aria-hidden="true" />}>Staff Login</Button>
        </nav>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section id="home" className="hero">
      <Container className="hero__grid">
        <div className="hero__copy">
          <Tag>Placeholder badge</Tag>
          <h1>Smash Brothers Burgers</h1>
          <p>Placeholder customer-facing copy for a premium public website framework.</p>
          <div className="hero__actions">
            <Button href={ORDER_URL} icon={<ShoppingBag size={16} aria-hidden="true" />}>Order Now</Button>
            <Button href="#menu" variant="secondary" icon={<MenuIcon size={16} aria-hidden="true" />}>Menu</Button>
          </div>
        </div>
        <div className="hero__visual" aria-label="Burger placeholder">
          <div className="burger-placeholder" />
          <Badge>100% placeholder</Badge>
        </div>
      </Container>
    </section>
  );
}

function Feature() {
  return (
    <Section id="feature" tone="yellow">
      <Container>
        <Grid className="feature-grid">
          <Card className="feature-card feature-card--wide"><Tag>Feature</Tag><h3>Placeholder feature block</h3><p>Short placeholder copy.</p></Card>
          {placeholders.feature.map((item) => <Card className="feature-card" key={item}><h3>{item}</h3><p>Placeholder copy.</p></Card>)}
        </Grid>
      </Container>
    </Section>
  );
}

function Promotions() {
  return <Section id="promotions"><Container><Heading eyebrow="Promotions" title="Placeholder promotion system" /><Grid className="two-card-grid">{placeholders.promos.map((item) => <Card className="promo-card" key={item}><Tag>Promo</Tag><h3>{item}</h3></Card>)}</Grid></Container></Section>;
}

function About() {
  return <Section id="about"><Container><Grid className="split-grid"><Heading eyebrow="About" title="Placeholder brand story layout" /><Card className="text-card"><p>Short placeholder paragraph reserved for future Smash Brothers Burgers content.</p></Card></Grid></Container></Section>;
}

function SignatureBurgers() {
  return <Section id="menu" tone="light"><Container><Heading eyebrow="Signature Burgers" title="Reusable burger card grid" /><Grid className="card-grid">{placeholders.burgers.map((item) => <Card className="burger-card" key={item}><div className="image-placeholder" /><h3>{item}</h3><p>Placeholder description.</p></Card>)}</Grid></Container></Section>;
}

function WhyChooseUs() {
  return <Section id="membership"><Container><Heading eyebrow="Why Choose Us" title="Placeholder reasons to believe" /><Grid className="card-grid">{placeholders.reasons.map((item, index) => <Card className="reason-card" key={item}><Badge>0{index + 1}</Badge><h3>{item}</h3><p>Placeholder support copy.</p></Card>)}</Grid></Container></Section>;
}

function Gallery() {
  return <Section id="gallery" tone="yellow"><Container><Heading eyebrow="Gallery" title="Placeholder gallery framework" /><Grid className="gallery-grid">{placeholders.gallery.map((item) => <Card className="gallery-card" key={item}><div className="image-placeholder" /><h3>{item}</h3></Card>)}</Grid></Container></Section>;
}

function Testimonials() {
  return <Section id="testimonials"><Container><Heading eyebrow="Testimonials" title="Placeholder quote carousel" /><Grid className="card-grid">{placeholders.testimonials.map((item) => <Card className="testimonial-card" key={item}><p>“{item} reserved for future customer proof.”</p><Tag>Placeholder name</Tag></Card>)}</Grid></Container></Section>;
}

function OrderCta() {
  return <Section id="contact" tone="black"><Container><Card className="cta-banner"><Heading eyebrow="Order CTA" title="Placeholder final conversion banner" align="center" /><div className="hero__actions"><Button href={ORDER_URL}>Order Now</Button><Button href="#menu" variant="secondary">View Menu</Button></div></Card></Container></Section>;
}

function Footer() {
  return <footer className="footer"><Container><Grid className="footer__grid">{["Brand", "Menu", "Membership", "Contact"].map((item) => <div key={item}><h3>{item}</h3><p>Placeholder footer content.</p></div>)}</Grid></Container></footer>;
}

function App() {
  return <><Navigation /><main><Hero /><Feature /><Promotions /><About /><SignatureBurgers /><WhyChooseUs /><Gallery /><Testimonials /><OrderCta /></main><Footer /></>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
