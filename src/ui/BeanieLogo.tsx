interface Props {
  size?: number;
  variant?: 'dark' | 'light';
}

export default function BeanieLogo({ size = 24, variant = 'dark' }: Props) {
  const color = variant === 'light' ? '#FAFAFA' : '#6366F1';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill={color} />
      <path
        d="M16.5 2.5 L21.5 2.5 L21.5 7.5 Z"
        fill={variant === 'light' ? '#6366F1' : '#FAFAFA'}
      />
    </svg>
  );
}
