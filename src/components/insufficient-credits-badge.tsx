export type CreditPack = { name: string; credits: number; price_usd: number };

/**
 * The `insufficient_credits` badge, with the arithmetic on hover.
 *
 * "Not enough" on its own makes the user guess how much to buy, so the hover
 * text says what the video needed, what they have, the shortfall, and the
 * smallest pack that covers it. The shortfall is computed against the CURRENT
 * balance, not the balance when the job was gated — so after a purchase the
 * same row tells the truth instead of a stale number.
 *
 * This uses the native `title` tooltip on purpose. The jobs table lives in a
 * horizontally scrollable container, and `overflow-x: auto` also clips the
 * vertical axis, so an absolutely-positioned tooltip gets cut off on the last
 * row. Making a styled one survive that needs a portal; the native tooltip is
 * never clipped and costs nothing.
 */
export function insufficientCreditsHint(
  requiredCredits: number | null,
  balance: number,
  packs: CreditPack[],
): string {
  if (requiredCredits === null) {
    return '這支影片需要的點數比你當時的餘額多，所以沒有轉錄。加購後重新送出即可。';
  }

  const shortfall = Math.max(0, Math.ceil(requiredCredits - balance));
  const head = `這支影片需要 ${requiredCredits} 點，你目前有 ${balance} 點`;

  if (shortfall === 0) {
    return `${head}。點數已經夠了 — 重新送出這支影片就會開始轉錄。`;
  }

  // Smallest pack that clears the shortfall; if none does, the biggest one.
  const sorted = [...packs].sort((a, b) => a.credits - b.credits);
  const suggestion = sorted.find((p) => p.credits >= shortfall) ?? sorted[sorted.length - 1];

  if (!suggestion) return `${head}，還差 ${shortfall} 點。`;

  const covers = suggestion.credits >= shortfall;
  return (
    `${head}，還差 ${shortfall} 點。\n` +
    `最接近的方案：${suggestion.name} — $${suggestion.price_usd.toFixed(0)} 換 ${suggestion.credits} 點` +
    (covers ? '，買這檔就夠了。' : '（這是最大的一檔，仍需再加購）。')
  );
}

export default function InsufficientCreditsBadge({
  requiredCredits,
  balance,
  packs,
}: {
  requiredCredits: number | null;
  balance: number;
  packs: CreditPack[];
}) {
  return (
    <span
      title={insufficientCreditsHint(requiredCredits, balance, packs)}
      tabIndex={0}
      className="inline-block shrink-0 cursor-help rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-800 underline decoration-amber-700/30 decoration-dotted underline-offset-4 outline-none ring-amber-600/30 focus-visible:ring-2"
    >
      點數不足 Insufficient credits
    </span>
  );
}
