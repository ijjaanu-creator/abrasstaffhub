import { cn } from "@/lib/utils";
import abrasLogo from "@/assets/abras-logo.png";

interface BrandLogoProps {
  size?: number;
  className?: string;
  alt?: string;
}

export function BrandLogo({
  size = 40,
  className,
  alt = "Abras Natural Spices logo",
}: BrandLogoProps) {
  return (
    <img
      src={abrasLogo}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      alt={alt}
      className={cn("block object-contain", className)}
    />
  );
}
