import { formatUnits } from 'viem';
import type { ListingEntity } from './listings';

export type BoardOrder = 'deadline' | 'reward';
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Presentation only. Inputs have already passed the listing board's chain verification. */
export function orderedListings(entries: readonly ListingEntity[], order: BoardOrder) {
  return [...entries].sort((a,b) => {
    if (order === 'reward') {
      const left = BigInt(a.listing.reward), right = BigInt(b.listing.reward);
      if (left !== right) return left > right ? -1 : 1;
    }
    return a.listing.acceptBefore - b.listing.acceptBefore || a.key.localeCompare(b.key);
  });
}

export function opportunityMarkup(entries: readonly ListingEntity[], order: BoardOrder, live: boolean, tokenSymbol: string) {
  return orderedListings(entries, order).map(({listing}) => {
    const closes = new Date(listing.acceptBefore * 1000);
    const deadline = Number.isNaN(closes.getTime()) ? `<span>Unix time ${listing.acceptBefore}</span>` : `<time datetime="${closes.toISOString()}">${escape(new Intl.DateTimeFormat(undefined, {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(closes))}</time>`;
    return `<article class="listing"><div class="listing-main"><p class="listing-kind">Technical review <span>Task ${escape(listing.jobId)}</span></p><h3>${escape(listing.title)}</h3><p class="listing-deadline">Accept by ${deadline}</p><p class="listing-assurance">Reward funded · Scope verified</p></div><div class="listing-offer"><p class="listing-price"><strong>${formatUnits(BigInt(listing.reward),6)}</strong> <span>${escape(tokenSymbol)}</span></p><button data-view-job="${escape(listing.jobId)}"${live?'':' disabled'}>View verified scope <span aria-hidden="true">↗</span></button></div></article>`;
  }).join('');
}
