// Add the YouTube video ID (not the full URL) and a public HTTPS APK URL when ready.
const YOUTUBE_VIDEO_ID: string = "";
const APK_DOWNLOAD_URL: string = "";

const steps = [
  {
    number: "01",
    title: "Bring your own books.",
    description:
      "Upload your own audiobooks and build a listening library that feels like yours.",
  },
  {
    number: "02",
    title: "Listen in the moment.",
    description:
      "Stay with the story while DODO helps you capture the passages and thoughts worth keeping.",
  },
  {
    number: "03",
    title: "Come back to what matters.",
    description:
      "Find your highlights and notes in one place, ready for the next time inspiration strikes.",
  },
];

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return diagonal
    ? (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 19 19 5M8 5h11v11"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
    : (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 12h15m-6-6 6 6-6 6"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="DODO, back to top">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span>
        DODO<span className="brand-period">.</span>
      </span>
    </a>
  );
}

function App() {
  return (
    <div id="top" className="site-shell">
      <header className="site-header wrap">
        <Brand />
        <nav className="header-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#demo">Demo</a>
          <a href="#features">Why DODO</a>
        </nav>
        <a className="header-link" href="#discover">
          Discover DODO <ArrowIcon diagonal />
        </a>
      </header>

      <main>
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" /> LISTEN CLOSER. REMEMBER MORE.
            </div>
            <h1 id="hero-title">
              A better way to <em>hold onto</em>{" "}
              what you hear<span className="accent-dot">.</span>
            </h1>
            <p className="hero-description">
              The audiobook ends. The ideas don’t have to. DODO is an AI-powered
              listening companion for your own audiobooks, highlights, notes,
              and the thoughts in between.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#how-it-works">
                See how it works <ArrowIcon />
              </a>
              <a className="text-link" href="#features">
                Explore the experience <span aria-hidden="true">↗</span>
              </a>
            </div>
            <div className="hero-footnote">
              <span className="footnote-icon" aria-hidden="true">✳</span>{" "}
              FOR THE STORIES THAT STAY WITH YOU
            </div>
          </div>

          <div
            className="hero-visual"
            aria-label="Illustration of an audiobook with a saved highlight and note"
          >
            <div className="visual-halo" aria-hidden="true" />
            <div className="visual-star star-one" aria-hidden="true">✳</div>
            <div className="visual-star star-two" aria-hidden="true">✳</div>
            <div className="app-preview">
              <div className="preview-topbar">
                <span className="preview-mini-brand">
                  <span className="mini-spark">✳</span>{" "}
                  dodo<span className="brand-period">.</span>
                </span>
                <span className="preview-topbar-right">
                  <span className="live-dot" /> NOW LISTENING
                </span>
              </div>
              <div className="preview-body">
                <div className="cover-art" aria-hidden="true">
                  <span className="cover-overline">AN AUDIOBOOK</span>
                  <span className="cover-sun" />
                  <span className="cover-title">
                    the<br />quiet<br />
                    <i>hours</i>
                  </span>
                  <span className="cover-lines" />
                </div>
                <div className="track-details">
                  <span className="small-label">FROM YOUR LIBRARY</span>
                  <h2>The Quiet Hours</h2>
                  <p>Chapter 04 · The space between</p>
                  <div className="waveform" aria-hidden="true">
                    {Array.from(
                      { length: 39 },
                      (_, index) => (
                        <span
                          key={index}
                          className={index < 17 ? "wave-played" : ""}
                          style={{
                            height: `${
                              8 + ((index * 13 + index * index * 3) % 28)
                            }px`,
                          }}
                        />
                      ),
                    )}
                  </div>
                  <div className="track-times">
                    <span>12:48</span>
                    <span>38:21</span>
                  </div>
                </div>
              </div>
              <div className="preview-divider" />
              <div className="preview-transcript">
                <span className="small-label">A MOMENT WORTH KEEPING</span>
                <p>
                  “Sometimes the smallest moments are the ones that{" "}
                  <mark>change the way we see everything.</mark>”
                </p>
                <div className="transcript-meta">
                  <span className="highlight-symbol" aria-hidden="true">✳</span>
                  {" "}
                  HIGHLIGHT SAVED <span>·</span> 12:48
                </div>
              </div>
            </div>
            <div className="note-card">
              <div className="note-icon" aria-hidden="true">✦</div>
              <div>
                <span className="small-label">A NOTE TO REMEMBER</span>
                <p>Come back to this thought later.</p>
              </div>
              <span className="note-check" aria-hidden="true">✓</span>
            </div>
            <span className="visual-caption">
              YOUR THOUGHTS, IN THE FLOW OF THE STORY.
            </span>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="ticker-inner">
            <span>LISTEN</span>
            <span>✳</span>
            <span>NOTICE</span>
            <span>✳</span>
            <span>REMEMBER</span>
            <span>✳</span>
            <span>REVISIT</span>
            <span>✳</span>
            <span>LISTEN</span>
            <span>✳</span>
            <span>NOTICE</span>
            <span>✳</span>
            <span>REMEMBER</span>
            <span>✳</span>
            <span>REVISIT</span>
          </div>
        </div>

        <section id="how-it-works" className="process-section">
          <div className="wrap">
            <div className="section-heading">
              <div>
                <span className="section-kicker">01 / THE IDEA</span>
                <h2>
                  Listening is just<br />the <em>beginning.</em>
                </h2>
              </div>
              <p>
                Books have a way of meeting us at the right moment. DODO makes
                it easier to keep those moments with you.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map((step) => (
                <article className="step" key={step.number}>
                  <span className="step-number">
                    {step.number} <span aria-hidden="true">↗</span>
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="demo"
          className="demo-section wrap"
          aria-labelledby="demo-title"
        >
          <div className="demo-heading">
            <div>
              <span className="section-kicker">02 / SEE IT IN ACTION</span>
              <h2 id="demo-title">
                A closer <em>look.</em>
              </h2>
            </div>
            <p>
              See what it feels like to listen, highlight, and keep your ideas
              together in DODO.
            </p>
          </div>
          <div className="demo-frame">
            {YOUTUBE_VIDEO_ID
              ? (
                <iframe
                  title="DODO app demo"
                  src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              )
              : (
                <div className="demo-placeholder">
                  <span className="demo-orbit" aria-hidden="true">✳</span>
                  <span className="demo-play" aria-hidden="true">▶</span>
                  <span className="demo-placeholder-label">
                    THE DODO EXPERIENCE
                  </span>
                  <strong>Demo video coming soon.</strong>
                  <span className="demo-placeholder-subtitle">
                    A real look at the app is on its way.
                  </span>
                </div>
              )}
          </div>
          <div className="demo-caption">
            <span>IN THE MOMENT</span>
            <span>LISTEN · HIGHLIGHT · REMEMBER</span>
          </div>
        </section>

        <section id="features" className="features-section wrap">
          <div className="feature-intro">
            <span className="section-kicker">
              03 / MADE FOR THE WAY YOU LISTEN
            </span>
            <h2>
              All ears.<br />
              <em>All yours.</em>
            </h2>
            <p>
              Less friction between hearing something wonderful and making it
              part of your own story.
            </p>
          </div>
          <div className="feature-list">
            <article className="feature-item">
              <span className="feature-icon" aria-hidden="true">◉</span>
              <div>
                <h3>Your books, your space</h3>
                <p>
                  Upload the audiobooks you want to hear into a library built
                  around you.
                </p>
              </div>
              <span className="feature-index">01</span>
            </article>
            <article className="feature-item">
              <span className="feature-icon" aria-hidden="true">✳</span>
              <div>
                <h3>Capture it as you listen</h3>
                <p>
                  Save a highlight or add a note without losing the thread of
                  the story.
                </p>
              </div>
              <span className="feature-index">02</span>
            </article>
            <article className="feature-item">
              <span className="feature-icon" aria-hidden="true">⌁</span>
              <div>
                <h3>A little help from AI</h3>
                <p>
                  Thoughtful assistance helps turn fleeting listening moments
                  into something you can return to.
                </p>
              </div>
              <span className="feature-index">03</span>
            </article>
          </div>
        </section>

        <section id="discover" className="closing-section">
          <div className="wrap closing-content">
            <span className="section-kicker">TAKE THE STORY WITH YOU</span>
            <h2>
              Don’t just finish a book.<br />
              <em>Keep a piece of it.</em>
            </h2>
            <p>
              Make room for the ideas, lines, and little revelations that
              deserve a second listen.
            </p>
            {APK_DOWNLOAD_URL
              ? (
                <a className="button button-dark" href={APK_DOWNLOAD_URL}>
                  Download the Android APK <ArrowIcon diagonal />
                </a>
              )
              : (
                <div className="apk-coming-soon" role="status">
                  <span className="apk-icon" aria-hidden="true">↓</span>
                  <span>
                    <strong>Android APK coming soon</strong>
                    <small>The download will be available here.</small>
                  </span>
                </div>
              )}
            <span className="closing-asterisk" aria-hidden="true">✳</span>
          </div>
        </section>
      </main>

      <footer className="site-footer wrap">
        <Brand />
        <span>Stories stick. Keep them close.</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </div>
  );
}

export default App;
