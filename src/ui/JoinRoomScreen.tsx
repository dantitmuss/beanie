import { useState } from 'react';
import BeanieLogo from './BeanieLogo';
import { useMpStore } from '../multiplayer/store';
import { joinRoom } from '../multiplayer/client';
import { getDisplayName, setDisplayName } from '../multiplayer/session';

export default function JoinRoomScreen() {
  const [name, setName] = useState(getDisplayName());
  const [code, setCode] = useState('');
  const { connection, joinError, setScreen } = useMpStore();
  const busy = connection === 'connecting';
  const valid = name.trim().length > 0 && /^\d{4}$/.test(code);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const trimmed = name.trim();
    setDisplayName(trimmed);
    joinRoom(code, trimmed.slice(0, 16));
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8 gap-12">
      <div className="flex flex-col items-center gap-4">
        <BeanieLogo size={64} />
        <h1 className="text-3xl font-bold tracking-tight text-[#0A0A0A] leading-none">
          Join room
        </h1>
      </div>

      <form onSubmit={handleJoin} className="flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="flex flex-col gap-2 w-full">
          <label
            htmlFor="display-name"
            className="text-xs font-medium text-[#71717A] uppercase tracking-wide text-center"
          >
            Your name
          </label>
          <input
            id="display-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={16}
            autoFocus={!getDisplayName()}
            placeholder="e.g. Aria"
            className="w-full px-4 py-3 rounded-lg border border-[#E4E4E7] bg-white text-[#0A0A0A] text-center focus:outline-none focus:border-[#6366F1]"
          />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <label
            htmlFor="room-code"
            className="text-xs font-medium text-[#71717A] uppercase tracking-wide text-center"
          >
            Room code
          </label>
          <input
            id="room-code"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            autoFocus={!!getDisplayName()}
            placeholder="0000"
            className="w-full px-4 py-3 rounded-lg border border-[#E4E4E7] bg-white text-[#0A0A0A] text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:border-[#6366F1]"
          />
        </div>

        {joinError && <p className="text-sm text-[#DC2626] text-center">{joinError}</p>}

        <button
          type="submit"
          disabled={!valid || busy}
          className="w-full py-3 bg-[#6366F1] text-white rounded-lg font-semibold text-base hover:bg-[#4F46E5] disabled:opacity-40 transition-colors"
        >
          {busy ? 'Joining…' : 'Join'}
        </button>
        <button
          type="button"
          onClick={() => setScreen('menu')}
          className="text-sm text-[#71717A] hover:text-[#0A0A0A] transition-colors"
        >
          ← Back
        </button>
      </form>
    </div>
  );
}
