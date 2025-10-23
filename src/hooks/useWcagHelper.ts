import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProjectionAsset } from '../utils/fileLoader';
import { analyzeProjectionAsset, type DocumentAnalysis } from '../utils/wcag/analyzer';

type SlideTextNodes = NonNullable<DocumentAnalysis['slides'][number]['textNodes']>;

export type FontAdjustments = {
  headingScale: number;
  bodyScale: number;
};

export type TextOverlayPayload = {
  nodes: SlideTextNodes;
  baseWidth: number;
  baseHeight: number;
  headingScale: number;
  bodyScale: number;
};

type UseWcagHelperParams = {
  asset: ProjectionAsset | null;
  brightness: number;
  contrast: number;
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  setStatusMessage: (message: string | null) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const useWcagHelper = ({
  asset,
  brightness,
  contrast,
  setBrightness,
  setContrast,
  setStatusMessage
}: UseWcagHelperParams) => {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [fontAdjustments, setFontAdjustments] = useState<FontAdjustments | null>(null);
  const [previousAdjustments, setPreviousAdjustments] = useState<{ brightness: number; contrast: number } | null>(null);

  useEffect(() => {
    if (!asset) {
      setAnalysis(null);
      setAnalysisError(null);
      setIsAnalyzing(false);
      setIsApplying(false);
      setFontAdjustments(null);
      setPreviousAdjustments(null);
      return;
    }

    let cancelled = false;
    setAnalysis(null);
    setAnalysisError(null);
    setFontAdjustments(null);
    setPreviousAdjustments(null);
    setIsAnalyzing(true);

    analyzeProjectionAsset(asset)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setAnalysis(result);
        const issueCount = result.issues.length;
        if (issueCount > 0) {
          setStatusMessage(`WCAG 解析: ${issueCount} 件の改善候補が見つかりました`);
        } else {
          setStatusMessage('WCAG 解析: 主要な問題は検出されませんでした');
        }
      })
      .catch((error) => {
        console.error('WCAG 解析に失敗しました', error);
        if (!cancelled) {
          setAnalysisError(error instanceof Error ? error.message : 'WCAG 解析に失敗しました');
          setStatusMessage('WCAG 解析に失敗しました');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsAnalyzing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [asset, setStatusMessage]);

  const applyAdjustments = useCallback(() => {
    if (!asset) {
      setStatusMessage('まず資料を読み込んでください');
      return;
    }
    if (!analysis) {
      setStatusMessage('WCAG 解析結果を準備中です…');
      return;
    }
    if (isApplying) {
      return;
    }

    setIsApplying(true);
    try {
      setPreviousAdjustments({ brightness, contrast });
      const luminanceAverage =
        analysis.slides.reduce((acc, slide) => acc + slide.averageLuminance, 0) /
        Math.max(analysis.slides.length, 1);

      let targetBrightness = brightness;
      if (Number.isFinite(luminanceAverage)) {
        if (luminanceAverage < 0.45) {
          targetBrightness = clamp(Math.round(100 + (0.45 - luminanceAverage) * 160), 110, 145);
        } else if (luminanceAverage > 0.75) {
          targetBrightness = clamp(Math.round(100 - (luminanceAverage - 0.75) * 160), 70, 95);
        }
      }

      const hasContrastIssue = analysis.issues.some((issue) => issue.rule === 'contrast');
      const severeContrastIssue = analysis.issues.some(
        (issue) => issue.rule === 'contrast' && issue.severity === 'error'
      );

      let targetContrast = contrast;
      if (hasContrastIssue) {
        targetContrast = Math.max(contrast, severeContrastIssue ? 20 : 12);
      }

      const headingScale = analysis.issues.some((issue) => issue.rule === 'font-size' && issue.severity === 'error')
        ? 1.35
        : 1.18;
      const bodyScale = analysis.issues.some((issue) => issue.rule === 'font-size') ? 0.9 : 0.96;

      setBrightness(targetBrightness);
      setContrast(targetContrast);
      setFontAdjustments({ headingScale, bodyScale });

      const fontIssues = analysis.issues.filter((issue) => issue.rule === 'font-size').length;
      const contrastIssues = analysis.issues.filter((issue) => issue.rule === 'contrast').length;

      const issueSummary =
        analysis.issues.length === 0
          ? '主要な課題はありませんでした'
          : [
              contrastIssues > 0 ? `コントラスト ${contrastIssues} 件` : null,
              fontIssues > 0 ? `文字サイズ ${fontIssues} 件` : null
            ]
              .filter(Boolean)
              .join(' / ');

      setStatusMessage(
        `WCAG ガイドラインに沿い明るさを ${targetBrightness}%、コントラストを ${targetContrast}% に調整し、フォントを調整しました（見出し ×${headingScale.toFixed(
          2
        )} / 本文 ×${bodyScale.toFixed(2)} — ${issueSummary}）。`
      );
    } finally {
      setTimeout(() => {
        setIsApplying(false);
      }, 200);
    }
  }, [analysis, asset, brightness, contrast, isApplying, setBrightness, setContrast, setStatusMessage]);

  const clearAdjustments = useCallback(() => {
    if (!fontAdjustments) {
      return;
    }
    if (previousAdjustments) {
      setBrightness(previousAdjustments.brightness);
      setContrast(previousAdjustments.contrast);
    }
    setFontAdjustments(null);
    setPreviousAdjustments(null);
    setStatusMessage('WCAG による調整を解除しました');
  }, [fontAdjustments, previousAdjustments, setBrightness, setContrast, setStatusMessage]);

  const getTextOverlayPayload = useCallback(
    (pageIndex: number): TextOverlayPayload | null => {
      if (!analysis || !fontAdjustments) {
        return null;
      }
      const slide = analysis.slides[pageIndex];
      if (!slide || !slide.textNodes || slide.textNodes.length === 0) {
        return null;
      }
      return {
        nodes: slide.textNodes as SlideTextNodes,
        baseWidth: slide.width,
        baseHeight: slide.height,
        headingScale: fontAdjustments.headingScale,
        bodyScale: fontAdjustments.bodyScale
      };
    },
    [analysis, fontAdjustments]
  );

  const summaryAdjustments = useMemo(() => fontAdjustments, [fontAdjustments]);

  return {
    analysis,
    analysisError,
    isAnalyzing,
    isApplying,
    fontAdjustments: summaryAdjustments,
    applyAdjustments,
    clearAdjustments,
    getTextOverlayPayload
  };
};
