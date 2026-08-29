export function Avatar({
  name,
  url,
  size = 40,
  className = "",
}: {
  name: string;
  url: string | null;
  size?: number;
  className?: string;
}) {
  const dim = `${size}px`;
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        style={{ width: dim, height: dim }}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: dim, height: dim, fontSize: size * 0.4 }}
      className={`flex shrink-0 items-center justify-center rounded-full bg-blush-100 font-semibold text-blush-500 ${className}`}
    >
      {name.trim().slice(0, 1) || "◍"}
    </div>
  );
}
