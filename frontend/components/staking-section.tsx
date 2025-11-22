'use client';

export function StakingSection() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
        <div className="text-center py-12">
          <div className="mb-6">
            <svg className="w-24 h-24 mx-auto text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4 drop-shadow-lg">
            Staking
          </h2>
          <p className="text-white/80 text-lg">
            Coming soon! This section will allow you to stake your tokens and earn rewards.
          </p>
        </div>
      </div>
    </div>
  );
}

