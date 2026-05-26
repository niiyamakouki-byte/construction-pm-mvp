type Props = {
  address: string;
};

const NEARBY_SEARCHES = [
  { label: "建材店", query: "建材店" },
  { label: "コンビニ", query: "コンビニ" },
  { label: "駐車場", query: "駐車場" },
  { label: "ホームセンター", query: "ホームセンター" },
] as const;

export function ProjectMapEmbed({ address }: Props) {
  const normalizedAddress = address.trim();

  if (!normalizedAddress) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 shadow-sm text-center text-sm text-slate-400">
        住所未登録
      </div>
    );
  }

  const encoded = encodeURIComponent(normalizedAddress);
  const mapSrc = `https://www.google.com/maps?q=${encoded}&output=embed`;
  const routeUrl = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encoded}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <iframe
        title="現場地図"
        src={mapSrc}
        width="100%"
        height="400"
        className="block w-full"
        style={{ height: "400px" }}
        sandbox="allow-scripts allow-same-origin allow-popups"
        referrerPolicy="no-referrer-when-downgrade"
        loading="lazy"
      />

      <div className="px-4 py-3 flex flex-wrap gap-2">
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          ルート案内
        </a>
        <a
          href={streetViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          ストリートビュー
        </a>
        {NEARBY_SEARCHES.map(({ label, query }) => (
          <a
            key={label}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} ${normalizedAddress}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
