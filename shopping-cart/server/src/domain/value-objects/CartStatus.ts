export type CartStatus = 'active' | 'checking_out' | 'checked_out' | 'handed_off' | 'expired';

const VALID_TRANSITIONS: Record<CartStatus, CartStatus[]> = {
  active: ['checking_out', 'expired'],
  checking_out: ['checked_out', 'active'],
  checked_out: ['handed_off'],
  handed_off: [],
  expired: [],
};

export function canTransition(from: CartStatus, to: CartStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
