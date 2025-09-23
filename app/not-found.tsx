export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        textAlign: 'center',
        padding: '0 16px',
      }}
    >
      <h1 style={{ fontSize: '24px', margin: 0 }}>ページが見つかりません</h1>
      <p style={{ margin: 0, color: '#4b5563' }}>指定された診断結果は存在しないようです。URLをご確認ください。</p>
    </main>
  );
}
