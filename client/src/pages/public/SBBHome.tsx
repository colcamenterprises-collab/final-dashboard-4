import { Link, Navigate } from 'react-router-dom';
import './sbb.css';

const heroImage = '/assets/sbb-burger-hero.svg';
const friesImage = '/assets/sbb-burger-hero.svg';
const doubleSet = '/assets/sbb-burger-hero.svg';
const singleSet = '/assets/sbb-burger-hero.svg';
const tripleSet = '/assets/sbb-burger-hero.svg';
const chickenSet = '/assets/sbb-burger-hero.svg';

const featuredProducts = [
  {
    name: 'Salt & Pepper Smash Fries',
    kicker: 'Loaded fries, burger sauce, cheese, and crunch.',
    image: friesImage,
  },
  {
    name: 'Karaage Chicken Burger',
    kicker: 'Crispy chicken, fries, and cold drink.',
    image: chickenSet,
  },
  {
    name: 'Super Double Set',
    kicker: 'Double smashed patties, cheese, fries, and drink.',
    image: doubleSet,
  },
  {
    name: 'Triple Smash Set',
    kicker: 'Three patties stacked for serious burger people.',
    image: tripleSet,
  },
];

const menuSections = [
  {
    title: 'Signature Smash',
    items: ['Single Smash Set', 'Double Set', 'Super Double Set', 'Triple Smash Set'],
  },
  {
    title: 'Chicken',
    items: ['Karaage Chicken Burger Meal Deal', 'Crispy Chicken Burger', 'Chicken Loaded Fries'],
  },
  { title: 'Sides', items: ['House Fries', 'Dirty Fries', 'Cheese Fries', 'Onion Rings'] },
  { title: 'Drinks', items: ['Soft Drinks', 'Water', 'Milkshakes', 'Seasonal Specials'] },
];

function Header() {
  return (
    <header className="sbw-header">
      <Link className="sbw-brand" to="/" aria-label="Smash Brothers Burgers home">
        SMASH BROTHERS
      </Link>
      <nav className="sbw-nav" aria-label="Public navigation">
        <Link to="/">Home</Link>
        <Link to="/menu">Menu</Link>
        <Link className="sbw-nav-cta" to="/order">
          Order Online
        </Link>
      </nav>
    </header>
  );
}

function ProductCard({
  product,
  tall = false,
}: {
  product: (typeof featuredProducts)[number];
  tall?: boolean;
}) {
  return (
    <Link className={`sbw-product-card ${tall ? 'is-tall' : ''}`} to="/order">
      <img src={product.image} alt={product.name} />
      <div className="sbw-product-copy">
        <h3>{product.name}</h3>
        <p>{product.kicker}</p>
        <span>Order Online</span>
      </div>
    </Link>
  );
}

function Footer() {
  return (
    <footer className="sbw-footer">
      <div className="sbw-footer-card">
        <strong>SMASH BROTHERS</strong>
        <nav>
          <Link to="/menu">Menu</Link>
          <Link to="/order">Order Online</Link>
          <Link to="/staff">Staff Login</Link>
        </nav>
        <div>
          <h2>Join Our Newsletter</h2>
          <button type="button">Submit</button>
        </div>
        <small>Copyright Smash Brothers Burgers</small>
      </div>
    </footer>
  );
}

function BrandPanel() {
  return (
    <section className="sbw-brand-panel">
      <h2>The Smash Above All Burgers</h2>
      <div>
        <p>
          Big sear, soft buns, sharp cheese, crispy sides, and a customer-first online ordering
          flow.
        </p>
        <Link to="/menu">About Us</Link>
      </div>
    </section>
  );
}

export function SBBHome() {
  return (
    <main className="sbw-page">
      <section className="sbw-hero-shell">
        <Header />
        <div className="sbw-hero-copy">
          <h1>Phuket's Favorite Smash Burger Joint</h1>
          <img src={heroImage} alt="Three Smash Brothers burgers" />
        </div>
      </section>
      <BrandPanel />
      <section className="sbw-featured" aria-label="Featured products">
        <div className="sbw-product-grid">
          {featuredProducts.map((product, index) => (
            <ProductCard key={product.name} product={product} tall={index === 0} />
          ))}
        </div>
      </section>
      <section className="sbw-marquee" aria-hidden="true">
        BEST BURGER I'VE EVER HAD
      </section>
      <section className="sbw-visit-band">
        <h2>Order Online or Come Visit Us Today</h2>
        <Link to="/order">Get Started</Link>
      </section>
      <Footer />
    </main>
  );
}

export function SBBMenu() {
  return (
    <main className="sbw-page sbw-menu-page">
      <Header />
      <section className="sbw-menu-hero">
        <h1>Menu</h1>
        <p>
          Premium fast-food sets with bold smash flavor, black-and-yellow presentation, and large
          product photography.
        </p>
      </section>
      <section className="sbw-product-grid sbw-menu-photo-grid">
        {featuredProducts.map((product, index) => (
          <ProductCard key={product.name} product={product} tall={index === 0} />
        ))}
      </section>
      <section className="sbw-menu-list">
        {menuSections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {section.items.map((item) => (
              <Link key={item} to="/order">
                <span>{item}</span>
                <small>Order Online</small>
              </Link>
            ))}
          </article>
        ))}
      </section>
      <Footer />
    </main>
  );
}

export function SBBMembership() {
  return (
    <main className="sbw-page">
      <Header />
      <BrandPanel />
      <section className="sbw-visit-band">
        <h2>Smash Club Coming Soon</h2>
        <Link to="/order">Order Now</Link>
      </section>
      <Footer />
    </main>
  );
}

export function StaffEntry() {
  return <Navigate to="/login" replace />;
}
