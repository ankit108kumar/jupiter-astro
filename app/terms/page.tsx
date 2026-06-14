export default function TermsOfService() {
  return (
    <main className="min-h-screen pt-40 pb-24 px-6 bg-white dark:bg-[#07090f] text-gray-600 dark:text-gray-400 font-sans">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-16 tracking-tight">Terms of Service</h1>
        
        <div className="space-y-16">
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">The Nature of Guidance</h2>
            <p className="leading-relaxed">
              Jupiter Astro provides astrological insights intended for personal reflection, spiritual growth, and clarity. Our readings are not a substitute for professional legal, medical, or financial advice. We encourage you to use our guidance as a tool for empowerment, while retaining personal responsibility for your life choices.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Service Etiquette</h2>
            <p className="leading-relaxed">
              By accessing our services, you agree to treat our expert astrologers with respect. We strive for excellence in every reading, and in turn, we ask for open-mindedness and clear communication from our seekers.
            </p>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Appointments & Cancellations</h2>
            <p className="leading-relaxed">
              To respect the time of both our astrologers and our clients, we require appointment changes or cancellations to be made at least 24 hours in advance. This ensures we can continue to provide dedicated focus to every seeker in our community.
            </p>
          </section>
        </div>

        <p className="mt-20 pt-8 border-t border-gray-100 dark:border-white/10 text-sm">Last updated: June 14, 2026</p>
      </div>
    </main>
  );
}