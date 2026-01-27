import React, { useRef } from 'react';
import ViewSureLogo from '../assets/ViewSureIconWhite.png'; // ロゴアセットを確認して調整
import importIcon from '../assets/import.png';

type LandingScreenProps = {
  onStart: () => void;
};

const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // App.tsx側でファイルを処理するロジックが必要だが、
    // ここではまず「始める」ボタンとして onStart を呼ぶフローにするか、
    // あるいはFileUploaderを内包するか検討が必要。
    // 今回はシンプルに「始める」でアプリ画面へ遷移させる。
    if (event.target.files && event.target.files.length > 0) {
      onStart();
    }
  };

  return (
    <div className="landing">
      <header className="landing__header">
        <div className="landing__brand">
          <img src={ViewSureLogo} alt="ViewSure" className="landing__logo" />
          <span className="landing__brand-text">ViewSure</span>
        </div>
        <nav className="landing__nav">
          <a href="#features">特徴</a>
          <a href="#usage">使い方</a>
        </nav>
        <div className="landing__header-actions">
          <button className="landing__header-cta" onClick={onStart}>
            アプリを起動
          </button>
        </div>
      </header>

      <main className="landing__main">
        <section className="landing__hero">
          <div className="landing__hero-text">
            <span className="landing__eyebrow">Projection Checker</span>
            <h1 className="landing__title">
              ViewSureで 見やすい資料へ
            </h1>
            <p className="landing__description">
              ViewSureは、プロジェクター投影時の「見にくさ」をシミュレーション。<br />
              コントラスト低下や色飛びを事前にチェックし、<br />
              誰にでも伝わるプレゼンテーション資料作成をサポートします。
            </p>
            
            <div className="landing__cta-group">
              <button className="landing__cta landing__cta--primary" onClick={onStart}>
                Start
              </button>
            </div>

          </div>
        </section>

        <section id="features" className="landing__features">
          <div className="landing__features-header">
            <p>FEATURES</p>
            <h2>ViewSureの3つの特徴</h2>
          </div>
          <div className="landing__feature-grid">
            <div className="landing__feature-card">
              <div className="landing__feature-accent">01</div>
              <h3>リアルな投影シミュレーション</h3>
              <p>実際のプロジェクターのコントラスト比や色域を再現。会場の環境に合わせた資料の視認性を事前に確認できます。</p>
            </div>
            <div className="landing__feature-card">
              <div className="landing__feature-accent">02</div>
              <h3>アクセシビリティ・チェック</h3>
              <p>WCAG 2.1の指標に基づき、配色バランスやコントラスト、文字サイズを自動で解析し、視認性の目安を提示します。</p>
            </div>
            <div className="landing__feature-card">
              <div className="landing__feature-accent">03</div>
              <h3>改善アドバイス</h3>
              <p>解析結果から「文字サイズ」「コントラスト」などの修正ポイントを提示。迷わず資料の品質を向上させることができます。</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <div className="landing__footer-links">
          <span>team-1000Bar</span>
        </div>
        <p>&copy; 2026 ViewSure Project.</p>
      </footer>
    </div>
  );
};

export default LandingScreen;
