'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/navbar';
import { LendingSection } from '@/components/lending-section';
import { StakingSection } from '@/components/staking-section';
import { DemoSection } from '@/components/demo-section';
import { MeshGradient } from '@paper-design/shaders-react';

export default function Home() {
  const [activeSection, setActiveSection] = useState<'lending' | 'staking' | 'demo'>('demo');
  const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* MeshGradient Background */}
      <div className="fixed inset-0 z-0 w-full h-full">
        <div className="w-full h-full">
          <MeshGradient
            width={dimensions.width}
            height={dimensions.height}
            colors={["#e0eaff", "#121eca", "#f75092", "#9f50d3"]}
            distortion={0.8}
            swirl={0.13}
            grainMixer={0}
            grainOverlay={0}
            speed={0.48}
          />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Navbar */}
        <Navbar 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
        />

        {/* Main Content */}
        <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
          {activeSection === 'lending' && <LendingSection />}
          {activeSection === 'staking' && <StakingSection />}
          {activeSection === 'demo' && <DemoSection />}
        </main>
      </div>
    </div>
  );
}
