import sentinelLogo from '../assets/sentinel_logo.png';

export default function AppLoader() {
  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col items-center justify-center z-[9999]">
      <div className="flex flex-col items-center gap-6">
        <img
          src={sentinelLogo}
          alt="Sentinel"
          className="h-16 w-auto animate-logoPulse"
          style={{ filter: 'drop-shadow(0 0 16px rgba(74,170,74,0.5))' }}
        />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-pine-500"
              style={{ animation: `logoPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
