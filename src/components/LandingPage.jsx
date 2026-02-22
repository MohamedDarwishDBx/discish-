export default function LandingPage({ onOpenApp }) {
  return (
    <div className="landing">
      <div className="landing-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />
        <div className="blob blob-5" />
      </div>

      <nav className="landing-nav">
        <div className="landing-logo"><img src="/logo.png" alt="" className="landing-logo-icon" />Discish</div>
        <div className="landing-links">
          <a href="#features">Features</a>
          <a href="#safety">Safety</a>
          <a href="#support">Support</a>
        </div>
        <button type="button" className="landing-login-btn" onClick={onOpenApp}>
          Login
        </button>
      </nav>

      <section className="landing-hero">
        <div className="hero-content">
        <h1 className="landing-headline">
          Discish —<br />
          Discord El<br />
          Ghalaba 🇪🇬
        </h1>
        <p className="landing-subtitle">
          Discish is great for playing games and chilling with friends, or even
          building a worldwide community. Customize your own space to talk,
          play, and hang out.
        </p>
          <div className="landing-ctas">
            <button type="button" className="landing-btn secondary" onClick={onOpenApp}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11V3H8v6H2v12h20V11h-6Zm-6-6h4v14h-4V5ZM4 11h4v8H4v-8Zm16 8h-4v-6h4v6Z" /></svg>
              Explore Discish
            </button>
            <button type="button" className="landing-btn primary" onClick={onOpenApp}>
              Open Discish in your browser
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-logo-card">
            <img src="/logo.png" alt="Discish" className="discish-logo-img" />
          </div>
          <div className="hero-founder">
            <img src="/founder.jpg" alt="Mohamed Darwish — Founder" className="founder-photo" />
            <div className="founder-label">
              <span className="founder-name">Mohamed Darwish</span>
              <span className="founder-role">Founder</span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="landing-features">
        <div className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2Zm0 14H6l-2 2V4h16v12Z" /></svg>
          </div>
          <h3>Text Channels</h3>
          <p>Organize conversations by topic. Create as many channels as you need — from #general to #gaming.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 16a7 7 0 1 1 7-7 7 7 0 0 1-7 7Zm3-8h-2V9a1 1 0 0 0-2 0v3a1 1 0 0 0 1 1h3a1 1 0 0 0 0-2Z" /></svg>
          </div>
          <h3>Voice Chat</h3>
          <p>Jump into a voice channel and talk in real time. Low latency, crystal clear audio powered by LiveKit.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" /></svg>
          </div>
          <h3>Communities</h3>
          <p>Create your own server, invite friends with a link, and build your community from the ground up.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-logo"><img src="/logo.png" alt="" className="landing-logo-icon" />Discish</div>
        <p>A Discord-inspired chat platform. Built for fun.</p>
      </footer>
    </div>
  );
}
