export default function KundaliResearchPage() {
  return (
    <main style={{ padding: "60px 40px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      {/* Research Header / Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
        <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em", background: "#E2E8F0", padding: "3px 8px", borderRadius: "4px", fontWeight: "700", color: "#475569" }}>
          Research Mode
        </span>
        <span style={{ fontSize: "0.85rem", color: "#64748B" }}>Ephemeris & Planetary Matrix Engine</span>
      </div>

      <h1 style={{ fontSize: "2.2rem", fontWeight: "bold", marginBottom: "8px", letterSpacing: "-0.02em" }}>
        Kundali Research Workspace
      </h1>
      <p style={{ color: "#64748B", marginBottom: "30px", fontSize: "1.05rem" }}>
        Input precise temporal and spatial coordinates for computational astrology analysis, divisional charts, and transit tracking.
      </p>

      {/* Research Configuration Panel */}
      <div style={{ background: "#F8FAFC", padding: "35px", borderRadius: "12px", border: "1px solid #CBD5E1", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)" }}>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          {/* Subject Name / ID */}
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", color: "#334155" }}>
              Subject / Event Name
            </label>
            <input 
              type="text" 
              placeholder="e.g. New Year 2027 / Subject #01" 
              style={{ padding: "10px 14px", width: "100%", border: "1px solid #94A3B8", borderRadius: "6px", fontSize: "0.95rem", background: "#FFFFFF" }} 
            />
          </div>

          {/* Birth Date & Time */}
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", color: "#334155" }}>
              Birth Date & Time (UTC / Local)
            </label>
            <input 
              type="datetime-local" 
              style={{ padding: "10px 14px", width: "100%", border: "1px solid #94A3B8", borderRadius: "6px", fontSize: "0.95rem", background: "#FFFFFF" }} 
            />
          </div>
        </div>

        {/* Location / Coordinates */}
        <div style={{ marginBottom: "25px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", color: "#334155" }}>
            Place of Birth (Coordinates / City)
          </label>
          <input 
            type="text" 
            placeholder="New Delhi, Delhi, India" 
            style={{ padding: "10px 14px", width: "100%", border: "1px solid #94A3B8", borderRadius: "6px", fontSize: "0.95rem", background: "#FFFFFF" }} 
          />
        </div>

        {/* Advanced Research Options Toggles */}
        <div style={{ display: "flex", gap: "20px", marginBottom: "30px", fontSize: "0.9rem", color: "#475569" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked /> True Node (Ayanamsa Calibration)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input type="checkbox" /> War Time Adjustment
          </label>
        </div>

        {/* Action Button */}
        <button style={{ padding: "12px 28px", background: "linear-gradient(to right, #D97706, #EA580C)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "1rem", boxShadow: "0 2px 4px rgba(234, 88, 12, 0.2)" }}>
          Run Research Analysis 🔬
        </button>
      </div>
    </main>
  );
}
