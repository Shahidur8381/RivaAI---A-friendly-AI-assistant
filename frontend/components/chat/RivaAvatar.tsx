"use client";

export default function RivaAvatar({
  size = "md",
  animate = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  animate?: boolean;
}) {
  const sizeMap = { sm: 32, md: 48, lg: 80, xl: 160 };
  const s = sizeMap[size];

  return (
    <div
      className={`relative flex-shrink-0 ${animate ? "animate-fade-in" : ""}`}
      style={{ width: s, height: s }}
      aria-hidden="true"
    >
      <img
        src="/RIVA.png"
        alt="Riva AI"
        width={s}
        height={s}
        className="w-full h-full object-contain"
        loading="lazy"
      />
    </div>
  );
}
