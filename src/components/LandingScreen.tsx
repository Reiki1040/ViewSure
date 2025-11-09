import { useMemo } from 'react';
import logoWhite from '../assets/ViewSureIconWhite.png';
import { useAuth } from '../context/AuthContext';

type LandingScreenProps = {
  onStart: () => void;
};

const LandingScreen = ({ onStart }: LandingScreenProps) => {
  const { status, user, error, signInWithGoogle } = useAuth();

  const buttonLabel = useMemo(() => {
    if (status === 'signingIn') {
      return 'サインイン中...';
    }
    if (user) {
      return 'ViewSure を始める';
    }
    return 'Google でサインアップ';
  }, [status, user]);

  const handleCtaClick = async () => {
    if (user) {
      onStart();
      return;
    }

    try {
      const profile = await signInWithGoogle();
      if (profile) {
        onStart();
      }
    } catch (signInError) {
      console.error('Google サインインに失敗しました', signInError);
    }
  };

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
        <button
          type="button"
          className="landing__header-cta"
          onClick={() => {
            onStart();
          }}
        >
          ViewSure を試してみる
        </button>
      </header>
      <main className="landing__hero">
        <img src={logoWhite} alt="ViewSure" className="landing__hero-logo" />
        <div className="landing__eyebrow">Projection Copilot</div>
        <h1 className="landing__title">ViewSureでプロジェクター映えする資料へ</h1>
        <p className="landing__description">
          スライドを WCAG に基づき最適化。プロジェクター環境でのシミュレーションを実行。仕上がりをワンランク上へ。
        </p>
        <div className="landing__cta-group">
          <button type="button" className="landing__cta" onClick={() => onStart()}>
            サインインせずに試す
          </button>
          <button type="button" className="landing__cta landing__cta--primary" onClick={handleCtaClick}>
            <span className="landing__cta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M21.35 11.1h-9.17v2.98h5.27c-.23 1.2-.93 2.21-1.98 2.88v2.37h3.2c1.88-1.73 2.96-4.28 2.96-7.15 0-.69-.06-1.36-.17-2.03z"
                  fill="#4285F4"
                />
                <path
                  d="M12.18 22c2.7 0 4.96-.9 6.61-2.47l-3.2-2.37c-.89.6-2.04.96-3.4.96-2.61 0-4.82-1.76-5.6-4.16H3.24v2.49c1.63 3.24 4.98 5.55 8.94 5.55z"
                  fill="#34A853"
                />
                <path
                  d="M6.58 13.96c-.2-.6-.32-1.25-.32-1.91 0-.66.12-1.31.32-1.91V7.65H3.24A9.83 9.83 0 0 0 2.18 12c0 1.54.37 3 .99 4.35l3.41-2.39z"
                  fill="#FBBC05"
                />
                <path
                  d="M12.18 6.21c1.47 0 2.79.51 3.82 1.52l2.83-2.83C17.13 2.94 14.87 2 12.18 2 8.22 2 4.87 4.31 3.24 7.65l3.42 2.49c.78-2.4 2.99-4.16 5.52-4.16z"
                  fill="#EA4335"
                />
              </svg>
            </span>
            {buttonLabel}
          </button>
          <div id="google-signin-parent" />
        </div>
        {error ? <div className="landing__error">{error}</div> : null}
      </main>
    </div>
  );
};

export default LandingScreen;
