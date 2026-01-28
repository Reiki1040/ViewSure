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
            <div className="landing__hero-group">
              <img src={ViewSureLogo} alt="" className="landing__hero-logo" />
              <h1 className="landing__title">ViewSure</h1>
            </div>
            <span className="landing__eyebrow">Projection Checker</span>
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
