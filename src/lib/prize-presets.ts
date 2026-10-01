import type { PrizeItem } from './types';

// Crisp SVG data URLs for high-fidelity fallback illustrations
export const PRIZE_ICONS = {
  trophy: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23DC2626" stroke="%23B91C1C" stroke-width="1.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H8c-.55 0-1 .45-1 1v1c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-1c0-.55-.45-1-1-1h-1c-.55 0-1-.45-1-1v-2.34"/><path d="M18 4H6v7a6 6 0 0 0 12 0V4Z"/></svg>`,
  gift: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2315803D" stroke="%23166534" stroke-width="1.5"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>`,
  star: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23EAB308" stroke="%23CA8A04" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  voucher: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23DC2626" stroke="%23991B1B" stroke-width="1.5"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>`,
  tv: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563EB" stroke="%231D4ED8" stroke-width="1.5"><rect width="20" height="15" x="2" y="3" rx="2"/><polyline points="17 21 12 18 7 21"/></svg>`,
  smartphone: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%234F46E5" stroke="%234338CA" stroke-width="1.5"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
  hamper: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23EA580C" stroke="%23C2410C" stroke-width="1.5"><path d="M4 10h16l-1.5 10H5.5L4 10Z"/><path d="M12 4v6"/><path d="M8 6h8"/></svg>`,
};

export interface PrizeTemplate {
  rank: number;
  title: string;
  description: string;
  imageUrl: string;
}

export const TEMPLATE_15_ITEMS: PrizeTemplate[] = [
  {
    rank: 1,
    title: '$2,000 STAR Shopping Spree',
    description: 'Ultimate all-access shopping voucher for any STAR Supermarket',
    imageUrl: PRIZE_ICONS.star,
  },
  {
    rank: 2,
    title: 'Apple iPhone 16 Pro Max',
    description: '256GB Titanium Edition with AppleCare Warranty',
    imageUrl: PRIZE_ICONS.smartphone,
  },
  {
    rank: 3,
    title: '65" 4K Smart OLED Television',
    description: 'Ultra-HD cinematic home entertainment system',
    imageUrl: PRIZE_ICONS.tv,
  },
  {
    rank: 4,
    title: 'Dyson V15 Cordless Vacuum',
    description: 'Laser detect deep cleaning intelligent technology',
    imageUrl: PRIZE_ICONS.hamper,
  },
  {
    rank: 5,
    title: 'De\'Longhi Espresso Machine',
    description: 'Barista quality bean-to-cup automated coffee maker',
    imageUrl: PRIZE_ICONS.gift,
  },
  {
    rank: 6,
    title: '$500 STAR Grocery Gift Card',
    description: 'Redeemable for fresh produce, pantry, and delicacies',
    imageUrl: PRIZE_ICONS.voucher,
  },
  {
    rank: 7,
    title: 'Ninja Foodi Multi-Cooker & Air Fryer',
    description: '14-in-1 multi-functional family pressure cooker',
    imageUrl: PRIZE_ICONS.hamper,
  },
  {
    rank: 8,
    title: 'Bose SoundLink Bluetooth Speaker',
    description: '360-degree high-fidelity portable waterproof audio',
    imageUrl: PRIZE_ICONS.gift,
  },
  {
    rank: 9,
    title: '$250 STAR Supermarket Voucher',
    description: 'Valid across all supermarket bakery, butchery, and aisles',
    imageUrl: PRIZE_ICONS.voucher,
  },
  {
    rank: 10,
    title: 'Gourmet International Gift Hamper',
    description: 'Artisan cheeses, imported chocolates, and fine treats',
    imageUrl: PRIZE_ICONS.hamper,
  },
  {
    rank: 11,
    title: 'NutriBullet High-Speed Blender Set',
    description: 'Powerful extraction system for healthy smoothies',
    imageUrl: PRIZE_ICONS.gift,
  },
  {
    rank: 12,
    title: '$150 Fresh Produce Gift Voucher',
    description: 'Organic farm-fresh fruits, vegetables, and greens',
    imageUrl: PRIZE_ICONS.voucher,
  },
  {
    rank: 13,
    title: 'Premium Cookware Non-Stick Set',
    description: '5-piece granite ceramic stone saucepan collection',
    imageUrl: PRIZE_ICONS.gift,
  },
  {
    rank: 14,
    title: '$100 STAR Supermarket Voucher',
    description: 'Store voucher redeemable for any supermarket essentials',
    imageUrl: PRIZE_ICONS.voucher,
  },
  {
    rank: 15,
    title: 'STAR Deluxe Goodie Basket',
    description: 'Signature supermarket snacks, teas, and specialty biscuits',
    imageUrl: PRIZE_ICONS.hamper,
  },
];

export function create15TierLadder(): PrizeItem[] {
  return TEMPLATE_15_ITEMS.map((item) => ({
    id: `prize-rank-${item.rank}-${Date.now().toString(36)}`,
    rank: item.rank,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
    isDrawn: false,
  }));
}

export function create10TierLadder(): PrizeItem[] {
  return TEMPLATE_15_ITEMS.slice(0, 10).map((item) => ({
    id: `prize-rank-${item.rank}-${Date.now().toString(36)}`,
    rank: item.rank,
    title: item.title,
    description: item.description,
    imageUrl: item.imageUrl,
    isDrawn: false,
  }));
}

/** Short display label for a prize's position in the ladder. */
export function rankLabel(rank: number): string {
  return rank === 1 ? 'Grand prize' : `Prize ${rank}`;
}
