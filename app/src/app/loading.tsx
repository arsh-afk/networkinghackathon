export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading page"
      style={{
        minHeight: "100dvh",
        background: "var(--ink-950)",
        padding: "24px 20px calc(88px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="skeleton" style={{ width: 150, height: 14, marginBottom: 24 }} />
      <section className="card" style={{ padding: 20, display: "grid", gap: 16 }}>
        <div className="skeleton" style={{ width: "45%", height: 20 }} />
        <div className="skeleton" style={{ width: "70%", height: 36 }} />
        <div className="skeleton" style={{ width: "100%", height: 100 }} />
        <div className="skeleton" style={{ width: "100%", height: 48 }} />
      </section>
      <div className="skeleton" style={{ position: "fixed", bottom: 12, left: 20, right: 20, height: 52 }} />
    </main>
  );
}
