import Cta from "@/components/home/cta";
import Hero from "@/components/home/hero";
import OpenLetter from "@/components/home/open";
import Services from "@/components/home/service";

export default function Home() {
  return (
    <main className="min-h-screen font-sans">
      <Hero />
 {/* Add your link here */}
      <div className="text-center py-8">
        <a 
          href="/kundali.html" 
          className="inline-block bg-orange-600 text-white px-6 py-3 rounded-full font-bold"
        >
          Generate Your Kundali
        </a>
      </div>
      <OpenLetter />
      <Services />
     

      <Cta />
    </main>
  );
}
