type BrandLogoProps = {
  className?: string;
};

/** Wide Fitspo wordmark (fitspo2.png). Sized via CSS height; width stays proportional. */
export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo${className ? ` ${className}` : ""}`}
      src="/fitspo2.png"
      alt="Fitspo"
      width={1323}
      height={315}
      decoding="async"
    />
  );
}
