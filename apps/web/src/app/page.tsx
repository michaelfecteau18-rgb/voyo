export default function Page() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "linear-gradient(135deg, #0a2540 0%, #072B57 100%)", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px" }}>
      <img src="/voyo-logo.png" alt="VOYO" style={{ width: "200px", filter: "brightness(0) invert(1)" }} />
      <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "18px", margin: 0 }}>Transport scolaire en temps réel</p>
      <a href="/login" style={{ background: "linear-gradient(90deg, #16C7B8, #0ea5e9)", color: "white", padding: "14px 32px", borderRadius: "12px", textDecoration: "none", fontWeight: "600", fontSize: "16px" }}>Accéder au portail</a>
    </div>
  )
}
