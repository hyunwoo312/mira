export function matchByConcept(options: string[], value: string, userLocation?: string): number {
  const v = value.toLowerCase().trim();
  const isPositive =
    /^(yes|true|i am|i do|i have|i will|i can|i consent|authorized|i identify|u\.?s\.?\s*person)$/i.test(
      v,
    );
  const isNegative =
    /^(no|false|i am not|i do not|i don't|i will not|i have not|not|none|decline|prefer not|foreign\s*person)$/i.test(
      v,
    );

  if (!isPositive && !isNegative) return -1;

  const normed = options.map((o) => o.toLowerCase().trim());

  // For positive matches on location-dependent options, check if user is local
  if (isPositive && userLocation) {
    const locParts = userLocation
      .toLowerCase()
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length >= 2);

    // Find which positive options mention a specific location
    const localIdx: number[] = [];
    const relocateIdx: number[] = [];
    for (let i = 0; i < normed.length; i++) {
      const opt = normed[i]!;
      if (!/^yes\b/.test(opt) && !/\bi am\b|\bi will\b|\bi can\b/.test(opt)) continue;
      if (/\bnot\b|\bno\b|\bnever\b/.test(opt)) continue;
      if (/\blocal\b|\bcurrently live\b|\bcurrently reside\b|\balready live\b/.test(opt)) {
        localIdx.push(i);
      } else if (/\brelocat|\bopen to\b|\bwilling\b|\bneed to move\b/.test(opt)) {
        relocateIdx.push(i);
      }
    }

    // If we found both local and relocate options, pick based on location match
    if (localIdx.length > 0 && relocateIdx.length > 0) {
      const isLocal = localIdx.some((idx) => locParts.some((part) => normed[idx]!.includes(part)));
      return isLocal ? localIdx[0]! : relocateIdx[0]!;
    }
  }

  for (let i = 0; i < normed.length; i++) {
    const opt = normed[i]!;
    if (isPositive) {
      if (
        /^yes\b/.test(opt) ||
        /\bi am\b|\bi do\b|\bi will\b|\bi have\b|\bi can\b|\bi consent\b|\bauthorized\b|\backnowledge\b|\bconfirm\b|\baccept\b|\bagree\b/.test(
          opt,
        )
      ) {
        if (!/\bnot\b|\bno\b|\bnever\b/.test(opt)) {
          if (/\bcurrently live\b|\bcurrently reside\b|\balready live\b/.test(opt)) {
            const betterIdx = normed.findIndex(
              (o2, j) =>
                j > i &&
                /^yes\b/.test(o2) &&
                /\brelocat|\bopen to\b|\bwilling\b/.test(o2) &&
                !/\bnot\b/.test(o2),
            );
            if (betterIdx >= 0) continue;
          }
          return i;
        }
      }
    }
    if (isNegative) {
      if (
        /^no\b/.test(opt) ||
        /\bi am not\b|\bi do not\b|\bi will not\b|\bi have not\b|\bnot a\b|\bdecline\b|\bprefer not\b/.test(
          opt,
        )
      ) {
        return i;
      }
    }
  }
  return -1;
}
