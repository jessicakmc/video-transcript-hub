import Link from 'next/link';

export type CreditPack = { name: string; credits: number; price_usd: number };

/**
 * The `insufficient_credits` badge, with the arithmetic underneath it.
 *
 * "Not enough" on its own makes the user guess how much to buy, so the row also
 * says what the video needed, the shortfall, and the smallest pack that covers
 * it, linked straight to /credits. The shortfall is computed against the CURRENT
 * balance, not the balance when the job was gated — so after a purchase the
 * same row tells the truth instead of a stale number.
 *
 * The shortfall is rendered inline, under the badge, rather than in a tooltip.
 * A native `title` needs a second of hovering and does not exist on touch, so
 * the first thing a user did was hover, see nothing, and conclude the hint was
 * missing. A styled hover tooltip would not survive either: the table sits in
 * an overflow-x-auto container, which clips the vertical axis too. Something
 * this important should just be on screen.
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
  const shortfall =
    requiredCredits === null ? null : Math.max(0, Math.ceil(requiredCredits - balance));

  const sorted = [...packs].sort((a, b) => a.credits - b.credits);
  const suggestion =
    shortfall && shortfall > 0
      ? (sorted.find((p) => p.credits >= shortfall) ?? sorted[sorted.length - 1])
      : undefined;

  return (
    <span
      className="inline-block"
      title={insufficientCreditsHint(requiredCredits, balance, packs)}
    >
      <span className="inline-block shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-800">
        點數不足 Insufficient credits
      </span>

      {requiredCredits === null ? null : (
        <span className="mt-1 block whitespace-nowrap text-[11px] text-ink/55">
          {shortfall && shortfall > 0 ? (
            <>
              需要 {requiredCredits} · 還差{' '}
              <strong className="font-semibold text-amber-800">{shortfall}</strong> 點
              {suggestion ? (
                <>
                  {' · '}
                  <Link href="/credits" className="text-chrome-deep underline">
                    加購 {suggestion.name}
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            <>點數已足夠，重新送出即可</>
          )}
        </span>
      )}
    </span>
  );
}
