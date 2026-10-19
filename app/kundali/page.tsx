export default function KundaliPage() {
  return (
    <main style={{ padding: "60px 40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "10px" }}>Generate Kundali</h1>
      <p style={{ color: "#555", marginBottom: "30px" }}>Enter your birth details below to generate your birth chart.</p>

      <div style={{ background: "#f9f9f9", padding: "30px", borderRadius: "8px", border: "1px solid #eee" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "600" }}>Birth Date & Time:</label>
        <input 
          type="datetime-local" 
          style={{ padding: "10px", marginBottom: "20px", width: "100%", maxWidth: "350px", display: "block", border: "1px solid #ccc", borderRadius: "4px" }} 
        />
        
        <button style={{ padding: "12px 24px", background: "#000", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "600" }}>
          Generate Kundali
        </button>
      </div>
    </main>
  );
}
