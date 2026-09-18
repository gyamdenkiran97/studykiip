/** Serialisable product shape handed from the server page to client components. */

export type VariantView = {
  id: string;
  sku: string;
  title: string;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  available: number;
  allowBackorder: boolean;
  isLowStock: boolean;
  optionValueIds: string[];
  imageUrls: string[];
};

export type OptionView = {
  id: string;
  name: string;
  values: Array<{ id: string; value: string; swatchHex: string | null }>;
};

export type GalleryImage = {
  url: string;
  alt: string;
  variantId: string | null;
  /** Option values this image represents (e.g. a colourway), empty for shared shots. */
  optionValueIds: string[];
};
