import { useState } from 'react';
import BeanieLogo from './BeanieLogo';
import { useMpStore } from '../multiplayer/store';
import { leaveRoom, startGame } from '../multiplayer/client';
import { MAX_PLAYERS } from '../../party/messages';

export default function LobbyScreen() {
  const { code, players, selfId, hostId, connection } = useMpStore();
  const [copied, setCopied] = useState(false);
  const isHost = selfId !== null && selfId === hostId;
  const canStart = players.length >= 2;

  function handleCopy() {
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center p-8 gap-10">
      <div className="flex flex-col items-center gap-4">
        <BeanieLogo size={48} />
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide">
            Room code
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy room code"
            className="flex items-baseline gap-3 px-5 py-2 rounded-xl border border-[#E4E4E7] bg-white hover:border-[#6366F1] transition-colors"
          >
            <span className="text-4xl font-bold font-mono tracking-[0.3em] text-[#0A0A0A]">
              {code}
            </span>
            <span className="text-xs text-[#6366F1] font-medium">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
          <p className="text-xs text-[#71717A] mt-1">Share this code with your friends</p>
        </div>
      </div>

      {connection === 'reconnecting' && (
        <p className="text-sm text-[#D97706] animate-pulse">Reconnecting…</p>
      )}

      <div className="w-full max-w-xs flex flex-col gap-2">
        <span className="text-xs font-medium text-[#71717A] uppercase tracking-wide text-center">
          Players ({players.length}/{MAX_PLAYERS})
        </span>
        <ul className="flex flex-col rounded-lg border border-[#E4E4E7] bg-white overflow-hidden divide-y divide-[#E4E4E7]">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 px-4 py-3">
              <span
                className={
                  p.connected
                    ? 'text-sm font-medium text-[#0A0A0A]'
                    : 'text-sm font-medium text-[#A1A1AA]'
                }
              >
                {p.name}
                {p.id === selfId && <span className="text-[#71717A] font-normal"> (you)</span>}
              </span>
              {!p.connected && (
                <span className="text-xs text-[#A1A1AA] italic">disconnected</span>
              )}
              {p.id === hostId && (
                <span className="ml-auto text-[10px] bg-[#EEF2FF] text-[#6366F1] rounded px-1.5 py-0.5 font-medium uppercase tracking-wide">
                  host
                </span>
              )}
            </li>
          ))}
          {players.length < MAX_PLAYERS && (
            <li className="px-4 py-3 text-sm text-[#A1A1AA] italic">waiting for players…</li>
          )}
        </ul>
      </div>

      <div className="w-full max-w-xs flex flex-col items-center gap-3">
        {isHost ? (
          <>
            <button
              type="button"
              onClick={startGame}
              disabled={!canStart}
              className="w-full py-3 bg-[#6366F1] text-white rounded-lg font-semibold text-base hover:bg-[#4F46E5] disabled:opacity-40 transition-colors"
            >
              Start game
            </button>
            {!canStart && (
              <p className="text-xs text-[#71717A]">Need at least 2 players to start</p>
            )}
          </>
        ) : (
          <p className="text-sm text-[#71717A] animate-pulse">Waiting for host to start…</p>
        )}
        <button
          type="button"
          onClick={leaveRoom}
          className="text-sm text-[#71717A] hover:text-[#DC2626] transition-colors"
        >
          Leave room
        </button>
      </div>
    </div>
  );
}
