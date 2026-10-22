/** Contracts for future integrations. No fake authentication, prices, or checkout. */
export type AuthProvider = "email" | "google" | "apple";
export interface AccountSession {
  userId: string;
  email: string;
  expiresAt: string;
}
export interface AuthAdapter {
  signIn(
    provider: AuthProvider,
    returnTo: string,
  ): Promise<{ redirectUrl: string }>;
  getSession(): Promise<AccountSession | null>;
  signOut(): Promise<void>;
}
export type Retailer = "home-depot" | "lowes" | "menards";
export interface RetailerQuote {
  retailer: Retailer;
  sku: string;
  unitPrice: number;
  currency: string;
  storeId: string;
  checkedAt: string;
}
export interface RetailerAdapter {
  getQuotes(query: string, postalCode: string): Promise<RetailerQuote[]>;
  createCart(
    items: { sku: string; quantity: number }[],
  ): Promise<{ url: string }>;
}
