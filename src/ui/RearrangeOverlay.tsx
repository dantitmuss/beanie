interface Props {
  children: React.ReactNode;
  active: boolean;
}

export default function RearrangeOverlay({ children, active }: Props) {
  return (
    <div className="relative">
      {active && (
        <div
          className="absolute inset-0 rounded-xl ring-2 ring-[#6366F1] ring-inset pointer-events-none z-10"
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}
