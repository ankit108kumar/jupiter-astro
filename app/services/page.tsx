import BookingForm from "@/components/BookingForm";

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white pb-24">
      
      {/* Page Header */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-20">
        <div className="flex items-center justify-center gap-4 mb-6 animate-fade-in-up">
          <span className="h-px w-12 bg-orange-200"></span>
          <h1 className="text-orange-700 font-bold tracking-[0.2em] uppercase text-xs">
            Our Offerings
          </h1>
          <span className="h-px w-12 bg-orange-200"></span>
        </div>
        
        {/* Single-line sleek heading */}
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight mb-6 animate-fade-in-up delay-100">
          Find clarity in the <span className="text-orange-700 font-light italic">stars above.</span>
        </h2>
        
        {/* Shortened, punchy description */}
        <p className="text-lg text-gray-500 max-w-2xl mx-auto font-light leading-relaxed animate-fade-in-up delay-200">
          Expert astrological readings tailored to illuminate your career, relationships, and ultimate life path.
        </p>
      </section>

      {/* Main Content Grid: Services Left, Form Right */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* LEFT COLUMN: Services List */}
          <div className="lg:col-span-7 space-y-16">
            
            {/* Service 1 */}
            <div className="group">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-700 flex items-center justify-center mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Birth Chart Analysis</h3>
              <p className="text-gray-500 leading-relaxed font-light mb-4">
                A profound deep-dive into your cosmic blueprint. We analyze the precise planetary alignments at the moment of your birth to uncover your core personality, hidden strengths, and ultimate destiny path.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 font-light">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span> Ascendant & Moon Sign profiling</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span> Dasha period analysis</li>
              </ul>
            </div>

            {/* Service 2 */}
            <div className="group border-t border-gray-100 pt-16">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-700 flex items-center justify-center mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Career & Finances</h3>
              <p className="text-gray-500 leading-relaxed font-light mb-4">
                Strategic guidance for professional growth. We identify periods of financial abundance, optimal times for career transitions, and the sectors where you are most likely to find success.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 font-light">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span> 10th House professional reading</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-700"></span> Wealth accumulation timelines</li>
              </ul>
            </div>

          </div>

          {/* RIGHT COLUMN: Sticky Booking Form */}
          <div className="lg:col-span-5 relative">
            {/* sticky top-32 ensures the form floats alongside the content as you scroll */}
            <div className="sticky top-32">
              <BookingForm />
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}