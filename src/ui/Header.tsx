import BeanieLogo from './BeanieLogo';

interface Props {
  onRulesClick?: () => void;
  onRestartClick?: () => void;
  aiThinking?: boolean;
}

export default function Header({ onRulesClick, onRestartClick, aiThinking = false }: Props) {
  return (
    <header className="flex items-center justify-between px-4 h-12 border-b border-[#E4E4E7] bg-white shrink-0">
      <div className="flex items-center gap-2">
        <BeanieLogo size={24} />
        <span className="text-[#0A0A0A] font-semibold tracking-tight text-lg leading-none">
          beanie
        </span>
        {aiThinking && (
          <span className="text-xs text-[#71717A] italic animate-pulse ml-1">
            thinking…
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onRulesClick}
          aria-label="Show rules"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] transition-colors text-sm font-semibold border border-[#E4E4E7]"
        >
          ?
        </button>
        <button
          type="button"
          onClick={onRestartClick}
          aria-label="Restart game"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717A] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] transition-colors border border-[#E4E4E7]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M2 7A5 5 0 1 1 7 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M2 4.5 L2 7 L4.5 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
