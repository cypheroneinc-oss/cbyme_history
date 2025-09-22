'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type ShareActionsProps = {
  typeId: string;
  typeLabel: string;
};

type ShareStatus = 'shared' | 'copied' | 'prompted' | 'idle';

type ShareError = 'failed' | null;

export function ShareActions({ typeId, typeLabel }: ShareActionsProps) {
  const [shareUrl, setShareUrl] = useState('');
  const [supportsWebShare, setSupportsWebShare] = useState(false);
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [error, setError] = useState<ShareError>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('typeId', typeId);
    setShareUrl(currentUrl.toString());
    setSupportsWebShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, [typeId]);

  const lineShareUrl = useMemo(() => {
    if (!shareUrl) {
      return '';
    }
    return `https://line.me/R/msg/text/?${encodeURIComponent(shareUrl)}`;
  }, [shareUrl]);

  const handleShare = useCallback(async () => {
    if (!shareUrl) {
      return;
    }

    setError(null);
    setStatus('idle');
    const shareData = {
      title: '診断結果',
      text: `${typeLabel} の診断結果をチェックしてみましょう。`,
      url: shareUrl,
    };

    if (supportsWebShare && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(shareData);
        setStatus('shared');
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === 'AbortError') {
          return;
        }
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setStatus('copied');
        return;
      } catch {
        // fall through to prompt fallback
      }
    }

    if (typeof window !== 'undefined') {
      window.prompt('このURLをコピーして共有してください', shareUrl);
      setStatus('prompted');
      return;
    }

    setError('failed');
  }, [shareUrl, supportsWebShare, typeLabel]);

  return (
    <section style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <button
        type="button"
        onClick={handleShare}
        disabled={!shareUrl}
        style={{
          padding: '12px 20px',
          fontSize: '16px',
          fontWeight: 600,
          borderRadius: '9999px',
          border: 'none',
          cursor: shareUrl ? 'pointer' : 'not-allowed',
          backgroundColor: '#2563eb',
          color: '#ffffff',
          minWidth: '220px',
        }}
      >
        {supportsWebShare ? '結果をシェア' : '結果URLをコピー'}
      </button>
      <a
        href={lineShareUrl || '#'}
        onClick={(event) => {
          if (!lineShareUrl) {
            event.preventDefault();
          }
        }}
        style={{
          padding: '10px 18px',
          fontSize: '15px',
          borderRadius: '9999px',
          backgroundColor: '#06c755',
          color: '#ffffff',
          textDecoration: 'none',
          fontWeight: 600,
          minWidth: '220px',
          textAlign: 'center',
        }}
        rel="noopener noreferrer"
        target="_blank"
      >
        LINEでシェア
      </a>
      {status === 'shared' && <p style={{ color: '#047857', margin: 0 }}>共有しました！</p>}
      {status === 'copied' && <p style={{ color: '#047857', margin: 0 }}>リンクをコピーしました。</p>}
      {status === 'prompted' && <p style={{ color: '#047857', margin: 0 }}>共有用URLを表示しました。</p>}
      {error === 'failed' && <p style={{ color: '#b91c1c', margin: 0 }}>共有に失敗しました。もう一度お試しください。</p>}
    </section>
  );
}
