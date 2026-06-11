import BeanieLogo from './BeanieLogo';
import { useMpStore } from '../multiplayer/store';

export default function MultiplayerMenu() {
  const { setScreen, reset } = useMpStore();

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8 gap-12">
      <div className="flex flex-col items-center gap-4">
        <BeanieLogo size={64} />
        <h1 className="text-5xl font-bold tracking-tight text-[#0A0A0A] leading-none">beanie</h1>
        <p className="text-[#71717A] text-sm text-center max-w-xs">
          Play with friends — share a room code and play from anywhere.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <button
          type="button"
          onClick={() => setScreen('create')}
          className="w-full py-3 bg-[#6366F1] text-white rounded-lg font-semibold text-base hover:bg-[#4F46E5] active:bg-[#4338CA] transition-colors"
        >
          Create room
        </button>
        <button
          type="button"
          onClick={() => setScreen('join')}
          className="w-full py-3 bg-white text-[#0A0A0A] border border-[#E4E4E7] rounded-lg font-semibold text-base hover:bg-[#F4F4F5] transition-colors"
        >
          Join room
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-[#71717A] hover:text-[#0A0A0A] transition-colors mt-2"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
