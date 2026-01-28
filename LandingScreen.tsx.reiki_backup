import React, { useRef, useState } from 'react';
import ViewSureLogo from '../assets/ViewSureIconWhite.png'; // ロゴアセットを確認して調整
import importIcon from '../assets/import.png';

type LandingScreenProps = {
  onStart: () => void;
};

const LandingScreen: React.FC<LandingScreenProps> = ({ onStart }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

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
          <button 
            type="button" 
            onClick={() => setIsAboutOpen(true)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'rgba(215, 224, 255, 0.72)',
              fontSize: '0.98rem',
              fontWeight: 500,
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'inherit'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = 'rgba(153, 178, 255, 0.95)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'rgba(215, 224, 255, 0.72)'}
          >
            About
          </button>
          <a 
            href="https://github.com/Reiki1040/ViewSure" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
        <div className="landing__header-actions">
          <button className="landing__header-cta" onClick={onStart}>
            アプリを起動
          </button>
        </div>
      </header>

      {isAboutOpen && (
        <div className="guide-modal-overlay" onClick={() => setIsAboutOpen(false)}>
          <div className="guide-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="guide-close-button"
              onClick={() => setIsAboutOpen(false)}
              aria-label="閉じる"
            >
              ×
            </button>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', color: '#1f2430' }}>ViewSureについて</h3>
            <p style={{ lineHeight: '1.8', color: '#4b5563', marginBottom: '16px' }}>
              ViewSureは、<strong>「すべてのプレゼンテーションを、もっと見やすく」</strong>という理念のもと開発された、プロジェクター投影シミュレーターです。
            </p>
            <p style={{ lineHeight: '1.8', color: '#4b5563', marginBottom: '16px' }}>
              せっかく作った資料が、会場のプロジェクターで白飛びしてしまったり、後ろの席の人には文字が小さすぎたりして伝わらない——そんな経験はありませんか？
            </p>
            <p style={{ lineHeight: '1.8', color: '#4b5563' }}>
              ViewSureを使えば、実際に投影する前に見え方を確認し、誰にとっても優しいユニバーサルな資料を作成することができます。あなたのアイデアを、確実に届けるために。
            </p>
          </div>
        </div>
      )}

      <main className="landing__main">
        <section className="landing__hero">
          <div className="landing__hero-text">
            <img src={ViewSureLogo} alt="" className="landing__hero-logo" style={{ width: '120px', marginBottom: '24px', opacity: 0.9, display: 'block', margin: '0 auto' }} />
            <span className="landing__eyebrow">Projection Checker</span>
            <h1 className="landing__title">
              ViewSureで 見やすい資料へ
            </h1>
            <p className="landing__description">
              テキストサイズなどをチェックし、見やすい資料作成をサポートします。
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
