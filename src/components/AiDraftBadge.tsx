/**
 * AI生成物であることを明示するラベル (ai-product-ux: Disclosure パターン)。
 * genbahub-ui のタグ/バッジ規約: pill + 淡セージ背景 + 大文字 + letter-spacing。
 */
export function AiDraftBadge({ label = "AI下書き" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase"
      style={{ background: "#EDF3EC", color: "#346538", letterSpacing: "0.05em" }}
    >
      {label}
    </span>
  );
}
