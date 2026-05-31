import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8 text-gray-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Top Grid Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          
          {/* Column 1: Brand */}
          <div className="space-y-6">
            <Link href="/" className="flex items-center gap-3">
              <Image 
                src="/logos/logo.png" 
                alt="Jupiter Astro Logo" 
                width={160} 
                height={60} 
                className="h-10 w-auto object-contain"
              />
              <span className="text-xl font-bold text-gray-900 tracking-tight">
                Jupiter Astro
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500">
              Your trusted guide for accurate birth chart analysis, career forecasts, and personalized cosmic remedies. Align with your destiny today.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-gray-900 font-bold mb-6 uppercase tracking-wider text-sm">Quick Links</h3>
            <ul className="space-y-4 text-sm">
              <li><Link href="/" className="hover:text-orange-700 transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-orange-700 transition-colors">About Our Astrologers</Link></li>
              <li><Link href="/blog" className="hover:text-orange-700 transition-colors">Astrology Blog</Link></li>
              <li><Link href="/#book" className="hover:text-orange-700 transition-colors">Book Consultation</Link></li>
            </ul>
          </div>

          {/* Column 3: Services */}
          <div>
            <h3 className="text-gray-900 font-bold mb-6 uppercase tracking-wider text-sm">Our Services</h3>
            <ul className="space-y-4 text-sm">
              <li><Link href="/services#birth-chart" className="hover:text-orange-700 transition-colors">Birth Chart Analysis</Link></li>
              <li><Link href="/services#career" className="hover:text-orange-700 transition-colors">Career Guidance</Link></li>
              <li><Link href="/services#marriage" className="hover:text-orange-700 transition-colors">Marriage Matching</Link></li>
              <li><Link href="/services#remedies" className="hover:text-orange-700 transition-colors">Lal Kitab Remedies</Link></li>
            </ul>
          </div>

          {/* Column 4: Contact & Legal */}
          <div>
            <h3 className="text-gray-900 font-bold mb-6 uppercase tracking-wider text-sm">Connect</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:consult@jupiterastrology108.com" className="hover:text-orange-700 transition-colors">consult@jupiterastrology108.com</a>
              </li>
              <li className="flex items-center gap-3">
                <svg className="w-5 h-5 text-orange-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
                <a href="#" className="hover:text-orange-700 transition-colors">Join our WhatsApp Group</a>
              </li>
            </ul>
            <div className="mt-8 space-y-2 text-xs text-gray-400">
              <p><Link href="/privacy" className="hover:text-orange-700 transition-colors">Privacy Policy</Link></p>
              <p><Link href="/terms" className="hover:text-orange-700 transition-colors">Terms of Service</Link></p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© {currentYear} Jupiter Astro. All rights reserved.</p>
          <p>Designed for cosmic clarity.</p>
        </div>

      </div>
    </footer>
  );
}