import Cta from "@/components/home/cta";
import Hero from "@/components/home/hero";
import OpenLetter from "@/components/home/open";
import Services from "@/components/home/service";


export default function Home() {
  return (
    <main className="min-h-screen font-sans">
      <Hero />
      <OpenLetter/>
      <Services />
      <Cta />
    </main>
  );
}