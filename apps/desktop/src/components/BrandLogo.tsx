type BrandLogoProps = {
  className?: string;
};

/** Fitspo wordmark with hanger (fitspohanger.png). Sized via CSS height; width stays proportional. */
export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo${className ? ` ${className}` : ""}`}
      src="/fitspohanger.png"
      alt="Fitspo"
      width={1211}
      height={577}
      decoding="async"
    />
  );
}
