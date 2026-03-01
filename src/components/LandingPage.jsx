import PrayerCountdown from "./PrayerCountdown";

export default function LandingPage({ onOpenApp, ramadanTheme, onToggleTheme }) {
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
        <div className="landing-logo"><img src="/logo.png" alt="" className="landing-logo-icon" />Discish — Discord El Ghalaba 🇪🇬</div>
        <div className="landing-links">
          <button type="button" className="landing-theme-toggle" onClick={onToggleTheme}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            {ramadanTheme ? "Default" : "Ramadan"}
          </button>
          {ramadanTheme && <PrayerCountdown compact />}
          <button type="button" className="landing-login-btn" onClick={onOpenApp}>
            Login
          </button>
        </div>
      </nav>

      {ramadanTheme && (
        <div className="ramadan-landing-banner">
          <span className="ramadan-star">&#x2728;</span>
          Ramadan Kareem
          <span className="ramadan-star">&#x2728;</span>
        </div>
      )}

      <section className="landing-hero">
        <div className="hero-content">
        <h1 className="landing-headline">
          The People&apos;s<br />
          Discord
        </h1>
        <p className="landing-subtitle">
          Discish is great for playing games and chilling with friends, or even
          building a worldwide community. Customize your own space to talk,
          play, and hang out.
        </p>
          <div className="landing-ctas">
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

      <section id="safety" className="landing-section">
        <h2 className="section-heading">Safety First</h2>
        <p className="section-subtext">
          Your safety matters. Discish gives you and your community the tools to stay in control.
        </p>
        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4Zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8Z" /></svg>
            </div>
            <h3>Block &amp; Report</h3>
            <p>Block anyone instantly and report abuse with one click. Your space, your rules.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2Zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2Zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2Z" /></svg>
            </div>
            <h3>Privacy Controls</h3>
            <p>Control who can message you and manage your DMs. Your conversations stay private.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9Z" /></svg>
            </div>
            <h3>Moderation Tools</h3>
            <p>Server owners get roles, permissions, and the ability to kick or mute members to keep things civil.</p>
          </div>
        </div>
      </section>

      <section id="support" className="landing-section">
        <h2 className="section-heading">We&apos;re Here to Help</h2>
        <p className="section-subtext">
          Got a question or ran into a problem? We&apos;ve got you covered.
        </p>
        <div className="landing-features">
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 18h2v-2h-2v2Zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8Zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4Z" /></svg>
            </div>
            <h3>Help Center</h3>
            <p>Browse FAQs and guides to get started, set up your server, and make the most of Discish.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" /></svg>
            </div>
            <h3>Community</h3>
            <p>Join the official Discish community server to ask questions, share feedback, and meet other users.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2Zm0 4-8 5-8-5V6l8 5 8-5v2Z" /></svg>
            </div>
            <h3>Contact Us</h3>
            <p>Need direct help? Reach out at <a href="mailto:support@discish.app" className="landing-link">support@discish.app</a> and we&apos;ll get back to you.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-logo"><img src="/logo.png" alt="" className="landing-logo-icon" />Discish — Discord El Ghalaba 🇪🇬</div>
        <p>A Discord-inspired chat platform. Built for fun.</p>
      </footer>
    </div>
  );
}
