"use client";

import { useState, useCallback } from "react";
import PhoneInput from "react-phone-number-input";
import DatePicker from "react-datepicker";
import dynamic from "next/dynamic";

import "react-phone-number-input/style.css";
import "react-datepicker/dist/react-datepicker.css";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LatLng { lat: number; lng: number; }

// ── Icons ─────────────────────────────────────────────────────────────────────
const I = {
  user:    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  clock:   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  star:    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
  chat:    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  pin:     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  check:   <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  close:   <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  send:    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  spin:    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/></svg>,
  success: <svg className="w-14 h-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>,
};

const SERVICES = [
  { label: "Birth Chart Analysis",    emoji: "🔭" },
  { label: "Career & Finances",       emoji: "💼" },
  { label: "Relationship & Marriage", emoji: "💑" },
  { label: "Matchmaking",             emoji: "💍" },
  { label: "Education & Exams",       emoji: "📚" },
  { label: "Varshaphal Reading",      emoji: "📅" },
  { label: "Muhurta Selection",       emoji: "🕐" },
  { label: "Other",                   emoji: "✏️" },
];

// ── Lazy MapPicker ────────────────────────────────────────────────────────────
// ── Lazy MapPicker ────────────────────────────────────────────────────────────
// ── Lazy MapPicker ────────────────────────────────────────────────────────────
const MapPicker = dynamic(() => import("@/components/lib/mappicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">Loading map…</div>
  ),
});

// ── Internal Form Components ─────────────────────────────────────────────────
function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-[10px] font-bold uppercase tracking-[0.09em] text-gray-700 dark:text-gray-500">{label}</label>}
      {children}
      {hint && <p className="text-[11px] text-gray-500 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-[#fc4c02]">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700 dark:text-gray-500 whitespace-nowrap">{title}</span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-white/[0.07]" />
    </div>
  );
}

function SuccessScreen({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-8 gap-5">
      <div className="text-[#fc4c02]">{I.success}</div>
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Request Sent!</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
          Thank you for reaching out. We've received your consultation request and will contact you shortly.
        </p>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="mt-2 px-6 py-2.5 rounded-xl border border-gray-300 dark:border-white/10 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition"
      >
        Submit another request
      </button>
    </div>
  );
}

// ── BookingForm Component ────────────────────────────────────────────────────
export default function BookingForm() {
  const [phone,     setPhone]     = useState<string | undefined>();
  const [dob,       setDob]       = useState<Date | null>(null);
  const [tob,       setTob]       = useState<Date | null>(null);
  const [pob,       setPob]       = useState("");
  const [coords,    setCoords]    = useState<LatLng | null>(null);
  const [showMap,   setShowMap]   = useState(false);
  const [service,   setService]   = useState("");
  const [customSvc, setCustomSvc] = useState("");
  const [pending,   setPending]   = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleMapSelect = useCallback((latlng: LatLng, name: string) => {
    setCoords(latlng);
    setPob(name);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    fd.set("phone",   phone   ?? "");
    fd.set("dob",     dob     ? dob.toISOString() : "");
    fd.set("tob",     tob     ? tob.toISOString() : "");
    fd.set("pob",     pob);
    fd.set("lat",     String(coords?.lat ?? ""));
    fd.set("lng",     String(coords?.lng ?? ""));
    fd.set("service", service === "Other" ? customSvc : service);
    try {
      await new Promise(r => setTimeout(r, 1200)); // simulated delay
      setSubmitted(true);
    } catch {
      alert("Something went wrong. Please try again.");
    }
    setPending(false);
  };

  const reset = () => {
    setPhone(undefined); setDob(null); setTob(null); setPob(""); setCoords(null);
    setShowMap(false); setService(""); setCustomSvc(""); setSubmitted(false);
  };

  const inp =
    "w-full px-3.5 py-2.5 rounded-xl text-sm transition " +
    "bg-gray-100 dark:bg-[#1a1a1a] " +
    "border border-gray-300 dark:border-white/[0.08] " +
    "text-gray-950 dark:text-gray-100 " +
    "placeholder:text-gray-500 dark:placeholder:text-gray-600 " +
    "outline-none focus:ring-2 focus:ring-[#fc4c02]/20 focus:border-[#fc4c02]/40";

  return (
    <>
      <style>{`
        .react-datepicker-wrapper{width:100%}
        .react-datepicker__input-container input{width:100%}
        .react-datepicker{font-family:inherit;border-radius:12px!important;border:1px solid #e5e7eb!important;box-shadow:0 8px 24px rgba(0,0,0,.08)!important}
        .react-datepicker__header{border-bottom:1px solid #f3f4f6!important;border-radius:12px 12px 0 0!important;background:#fff!important}
        .react-datepicker__day:hover{background:#fc4c02!important;color:#fff!important;border-radius:6px!important}
        .react-datepicker__day--selected,.react-datepicker__day--keyboard-selected{background:#fc4c02!important;color:#fff!important;border-radius:6px!important}
        .react-datepicker__time-list-item:hover{background:#fc4c02!important;color:#fff!important}
        .react-datepicker__time-list-item--selected{background:#fc4c02!important;color:#fff!important;font-weight:600!important}
        .react-datepicker__time-container{width:110px!important}
        .dark .react-datepicker{background:#1a1a1a!important;border:1px solid rgba(255,255,255,.08)!important}
        .dark .react-datepicker__header{background:#1a1a1a!important;border-bottom:1px solid rgba(255,255,255,.06)!important}
        .dark .react-datepicker__current-month,.dark .react-datepicker-time__header,.dark .react-datepicker__day-name{color:#aaa!important}
        .dark .react-datepicker__day{color:#ccc!important;border-radius:6px!important}
        .dark .react-datepicker__navigation-icon::before{border-color:#555!important}
        .dark .react-datepicker__year-dropdown{background:#1a1a1a!important;border:1px solid rgba(255,255,255,.08)!important;border-radius:10px}
        .dark .react-datepicker__year-option{color:#ccc!important}
        .dark .react-datepicker__year-option:hover{background:#fc4c02!important;color:#fff!important}
        .dark .react-datepicker__time,.dark .react-datepicker__time-list{background:#1a1a1a!important}
        .dark .react-datepicker__time-container{border-left:1px solid rgba(255,255,255,.06)!important}
        .dark .react-datepicker__time-list-item{color:#ccc!important;border-radius:4px!important}
        .PhoneInput{display:flex;align-items:center;gap:8px}
        .PhoneInputInput{flex:1;background:transparent;border:none;outline:none;font-size:14px;color:inherit}
        .PhoneInputCountrySelect{background:transparent;border:none;outline:none;font-size:14px;color:inherit;cursor:pointer}
        .dark .PhoneInputCountrySelect{background:#1a1a1a}
        .dark select option{background:#1a1a1a;color:#e5e5e5}
      `}</style>

      {/* Container — blended background, no border/shadow */}
      <div className="w-full max-w-5xl mx-auto overflow-hidden">

        {/* Header */}
        <div className="px-6 md:px-10 py-5">
          <h2 className="text-xl md:text-2xl font-bold text-gray-950 dark:text-white">Book Your Session</h2>
          <p className="text-sm text-gray-600 dark:text-gray-500 mt-0.5">Fill in your details to begin your cosmic journey.</p>
        </div>

        {submitted ? (
          <SuccessScreen onReset={reset} />
        ) : (
          <form onSubmit={handleSubmit}>
            <input type="text" name="website" className="hidden" tabIndex={-1} autoComplete="off" />

            <div className="grid lg:grid-cols-2">

              {/* ══ LEFT ══ */}
              <div className="p-6 md:p-8 space-y-6">

                {/* Personal */}
                <div>
                  <Section icon={I.user} title="Personal Information" />
                  <div className="space-y-3">
                    <Field label="Full Name">
                      <input name="name" required placeholder="e.g. Arjun Sharma" className={inp} />
                    </Field>

                    <Field label="WhatsApp Number" hint="We'll contact you on WhatsApp.">
                      <div className={`${inp} !px-3 !py-2`}>
                        <PhoneInput
                          defaultCountry="IN"
                          international
                          countryCallingCodeEditable={false}
                          value={phone}
                          onChange={setPhone}
                          placeholder="Phone number"
                        />
                      </div>
                    </Field>

                    <Field label="Country">
                      <select name="country" defaultValue="India" className={inp}>
                        <option value="India">🇮🇳 India</option>
                        <option value="United States">🇺🇸 United States</option>
                        <option value="Other">🌍 Other</option>
                      </select>
                    </Field>
                  </div>
                </div>

                {/* Birth */}
                <div>
                  <Section icon={I.clock} title="Birth Information" />
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Date of Birth">
                        <DatePicker
                          selected={dob}
                          onChange={d => setDob(d)}
                          showYearDropdown
                          scrollableYearDropdown
                          yearDropdownItemNumber={120}
                          maxDate={new Date()}
                          placeholderText="Select date"
                          className={inp}
                        />
                      </Field>
                      <Field label="Time of Birth" hint="Leave blank if unknown.">
                        <DatePicker
                          selected={tob}
                          onChange={d => setTob(d)}
                          showTimeSelect
                          showTimeSelectOnly
                          timeIntervals={5}
                          timeCaption="Time"
                          dateFormat="h:mm aa"
                          placeholderText="Select time"
                          className={inp}
                        />
                      </Field>
                    </div>

                    <Field label="Place of Birth">
                      <div className="flex gap-2">
                        <input
                          value={pob}
                          onChange={e => setPob(e.target.value)}
                          placeholder="City or town"
                          className={inp}
                        />
                        <button
                          type="button"
                          onClick={() => setShowMap(v => !v)}
                          title="Pick on map"
                          className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${
                            showMap
                              ? "bg-[#fc4c02] border-[#fc4c02] text-white shadow-lg shadow-[#fc4c02]/30"
                              : "border-gray-300 dark:border-white/10 text-gray-500 hover:border-[#fc4c02]/50 hover:text-[#fc4c02]"
                          }`}
                        >
                          {I.pin}
                        </button>
                      </div>
                      {coords && (
                        <p className="text-[11px] text-gray-600 dark:text-gray-500 mt-1">
                          📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}{pob && ` — ${pob}`}
                        </p>
                      )}
                    </Field>
                  </div>
                </div>
              </div>

              {/* ══ RIGHT ══ */}
              <div className="p-6 md:p-8 flex flex-col gap-5 relative lg:border-l lg:border-gray-200 lg:dark:border-white/[0.06]">

                {showMap ? (
                  <div className="flex flex-col flex-1 gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-700 dark:text-gray-500 flex items-center gap-1.5">
                        {I.pin} Select Birthplace on Map
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowMap(false)}
                        className="flex items-center gap-1 text-xs font-medium text-[#fc4c02] hover:text-[#e04400] transition"
                      >
                        {I.close} Done
                      </button>
                    </div>
                    <div className="flex-1 min-h-[360px] rounded-xl overflow-hidden border border-gray-300 dark:border-white/[0.08]">
                      <MapPicker
                        initialCoords={coords ?? { lat: 20.5937, lng: 78.9629 }}
                        onSelect={handleMapSelect}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Consultation type */}
                    <div>
                      <Section icon={I.star} title="Consultation Type" />
                      <div className="grid grid-cols-2 gap-2">
                        {SERVICES.map(s => (
                          <button
                            key={s.label}
                            type="button"
                            onClick={() => setService(s.label)}
                            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                              service === s.label
                                ? "border-[#fc4c02] bg-[#fc4c02]/8 text-[#fc4c02]"
                                : "border-gray-300 dark:border-white/[0.08] bg-gray-100 dark:bg-white/[0.02] text-gray-800 dark:text-gray-300 hover:border-[#fc4c02]/40"
                            }`}
                          >
                            <span className="text-base flex-shrink-0">{s.emoji}</span>
                            <span className="text-xs font-medium leading-snug flex-1">{s.label}</span>
                            {service === s.label && <span className="text-[#fc4c02] flex-shrink-0">{I.check}</span>}
                          </button>
                        ))}
                      </div>
                      {service === "Other" && (
                        <input
                          value={customSvc}
                          onChange={e => setCustomSvc(e.target.value)}
                          placeholder="Describe your consultation type…"
                          className={`${inp} mt-3`}
                          required
                        />
                      )}
                    </div>

                    {/* Concern */}
                    <div className="flex flex-col flex-1">
                      <Section icon={I.chat} title="Your Concern" />
                      <textarea
                        name="problem"
                        required
                        rows={4}
                        placeholder="Tell us about your question or concern…"
                        className={`${inp} resize-none flex-1 min-h-[100px]`}
                      />
                    </div>

                    {/* Submit */}
                    <div className="space-y-2">
                      <button
                        type="submit"
                        disabled={pending}
                        className={`w-full py-3.5 rounded-xl font-semibold text-white text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                          pending
                            ? "bg-[#fc4c02]/50 cursor-not-allowed"
                            : "bg-[#fc4c02] hover:bg-[#e04400] hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-[#fc4c02]/20"
                        }`}
                      >
                        {pending ? I.spin : I.send}
                        {pending ? "Sending…" : "Request Consultation"}
                      </button>
                      <p className="text-[11px] text-center text-gray-600 dark:text-gray-600">
                        We'll reach out to confirm your session details.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}