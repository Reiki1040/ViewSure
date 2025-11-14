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
    </div>
  );
};

export default LandingScreen;
