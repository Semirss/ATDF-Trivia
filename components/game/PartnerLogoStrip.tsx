import Image from "next/image";

const partnerLogos = [
  {
    src: "/Logos/atdf-ribbon-logo-transparent-v1.png",
    alt: "ATDF",
    width: 1254,
    height: 1254
  },
  {
    src: "/Logos/flawless-events.svg",
    alt: "Flawless Events",
    width: 320,
    height: 180
  }
];

export function PartnerLogoStrip({ variant = "home" }: { variant?: "home" | "splash" }) {
  return (
    <div className={`partner-logo-strip partner-logo-strip-${variant}`} aria-label="Partners">
      {partnerLogos.map((logo) => (
        <div
          key={logo.src}
          className="partner-logo-tile"
          aria-label={logo.alt}
        >
          <Image
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            sizes={variant === "splash" ? "96px" : "72px"}
            className="partner-logo-image"
          />
        </div>
      ))}
    </div>
  );
}
