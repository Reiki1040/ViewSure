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
        <h1 className="landing__title">ViewSureで見やすい資料へ</h1>
        <p className="landing__description">
          スライドの視認性とアクセシビリティをチェック。プロジェクター環境でのシミュレーションを実行。仕上がりをワンランク上へ。
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
            <h3>読みやすさガイドラインに基づくチェック</h3>
            <p>コントラストや文字サイズ、行間、情報量を自動チェック。問題があるページと箇所をリストアップします。</p>
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
              <p>読みやすさチェックに関する質問や改善要望を受け付けています。メール: e235738@ie.u-ryukyu.ac.jp</p>
            </article>
          <article className="landing__feature-card">
            <h3>フィードバック</h3>
            <p>検出精度や表示内容の改善案があればお知らせください。優先的に反映します。</p>
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
            <p>アップロード画面からPDFをドロップまたは選択。自動でページプレビューが表示されます。</p>
          </article>
          <article className="landing__feature-card">
            <h3>2. プレビューを確認</h3>
            <p>ページ送り・スライダーで閲覧。必要に応じてプロジェクタープレビューモードをオンにできます。</p>
          </article>
          <article className="landing__feature-card">
            <h3>3. 読みにくさをチェック</h3>
            <p>チェックボタンで読みやすさに関する問題点を検出。問題ページと内容をリストで確認し、元の資料を修正してください。</p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default LandingScreen;
