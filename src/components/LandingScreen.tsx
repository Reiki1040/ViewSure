import logoWhite from '../assets/ViewSureIconWhite.png';

type LandingScreenProps = {
  onStart: () => void;
};

const LandingScreen = ({ onStart }: LandingScreenProps) => {
  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <img src={logoWhite} alt="ViewSure" className="landing__logo" />
          <span className="landing__brand-text">ViewSure</span>
        </div>
        <nav className="landing__nav" aria-label="サイトメニュー">
          <a href="#features">特徴</a>
          <a href="#contact">問い合わせ</a>
          <a href="#help">ヘルプ</a>
        </nav>
      </header>
      <main className="landing__hero">
        <img src={logoWhite} alt="ViewSure" className="landing__hero-logo" />
        <div className="landing__eyebrow">Projection Copilot</div>
        <h1 className="landing__title">ViewSureでプロジェクター映えする資料へ</h1>
        <p className="landing__description">
          スライドを WCAG に基づき最適化。プロジェクター環境でのシミュレーションを実行。仕上がりをワンランク上へ。
        </p>
        <div className="landing__cta-group">
          <button type="button" className="landing__cta landing__cta--primary" onClick={onStart}>
            ViewSure を始める
          </button>
        </div>
      </main>
      <section id="features" className="landing__features" aria-label="特徴">
        <div className="landing__features-header">
          <p>FEATURES</p>
          <h2>特徴</h2>
        </div>
        <div className="landing__feature-grid">
          <article className="landing__feature-card">
            <span className="landing__feature-accent">01</span>
            <h3>WCAGに基づく読みやすさ</h3>
            <p>コントラスト・文字サイズ・見出し構造を自動チェックし、改善案を提示。修正後のプレビューで即確認。</p>
          </article>
          <article className="landing__feature-card">
            <span className="landing__feature-accent">02</span>
            <h3>プロジェクター環境の再現</h3>
            <p>明るさ低下や白かぶりをシミュレーションし、投影時に見えづらい箇所を事前に把握できます。</p>
          </article>
        </div>
      </section>
      <section id="contact" className="landing__features" aria-label="問い合わせ">
        <div className="landing__features-header">
          <p>CONTACT</p>
          <h2>問い合わせ</h2>
        </div>
          <div className="landing__feature-grid">
            <article className="landing__feature-card">
              <h3>サポート窓口</h3>
              <p>導入相談やトライアルのご要望、機能リクエストを受け付けています。メール: e235738@ie.u-ryukyu.ac.jp</p>
            </article>
          <article className="landing__feature-card">
            <h3>フィードバック</h3>
            <p>不具合報告や改善案はアプリ内のフィードバックから。優先的に改善します。</p>
          </article>
        </div>
      </section>
      <section id="help" className="landing__features" aria-label="ヘルプ">
        <div className="landing__features-header">
          <p>HELP</p>
          <h2>使い方</h2>
        </div>
        <div className="landing__feature-grid">
          <article className="landing__feature-card">
            <h3>1. PDFを読み込む</h3>
            <p>アップロード画面からPDFをドロップ。自動でページプレビューが表示されます。</p>
          </article>
          <article className="landing__feature-card">
            <h3>2. プレビューを確認</h3>
            <p>修正ボタンでWCAG補正、プロジェクターボタンで投影シミュレーションを切り替え。</p>
          </article>
          <article className="landing__feature-card">
            <h3>3. 修正を検討</h3>
            <p>コントラストや文字サイズを確認し、必要に応じて再アップロードや別ツールでの編集を実施。</p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default LandingScreen;
