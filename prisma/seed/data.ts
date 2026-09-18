/**
 * Demo catalogue.
 *
 * Every brand, product name and description here is invented for this project.
 * Imagery is generated vector art (see src/server/media/placeholder.ts) so the
 * demo carries no third-party licensing obligations. Real production content is
 * created through the admin panel.
 */

import type { Archetype, PALETTES } from "../../src/server/media/placeholder";

export type PaletteKey = keyof typeof PALETTES;

export type CategorySeed = {
  slug: string;
  name: string;
  description: string;
  children: Array<{ slug: string; name: string; description?: string }>;
  palette: PaletteKey;
  featured?: boolean;
};

export const CATEGORIES: CategorySeed[] = [
  {
    slug: "fashion",
    name: "Fashion",
    description: "Considered wardrobe staples, cut from materials chosen to outlast a season.",
    palette: "sand",
    featured: true,
    children: [
      { slug: "outerwear", name: "Outerwear", description: "Coats and jackets built for weather and wear." },
      { slug: "knitwear", name: "Knitwear", description: "Wool, cashmere and cotton knits." },
      { slug: "shirts-tops", name: "Shirts & Tops" },
      { slug: "trousers", name: "Trousers" },
      { slug: "footwear", name: "Footwear" },
    ],
  },
  {
    slug: "electronics",
    name: "Electronics",
    description: "Audio, computing and connected devices, selected for build quality over spec sheets.",
    palette: "slate",
    featured: true,
    children: [
      { slug: "audio", name: "Audio", description: "Headphones, speakers and turntables." },
      { slug: "computing", name: "Computing" },
      { slug: "mobile-tech", name: "Mobile & Wearables" },
    ],
  },
  {
    slug: "beauty",
    name: "Beauty",
    description: "Skincare, fragrance and hair, formulated with short ingredient lists.",
    palette: "blush",
    featured: true,
    children: [
      { slug: "skincare", name: "Skincare" },
      { slug: "fragrance", name: "Fragrance" },
      { slug: "haircare", name: "Haircare" },
    ],
  },
  {
    slug: "home-living",
    name: "Home & Living",
    description: "The quiet objects you use daily — kitchen, textiles and decor.",
    palette: "oat",
    featured: true,
    children: [
      { slug: "kitchen", name: "Kitchen" },
      { slug: "textiles", name: "Textiles" },
      { slug: "decor", name: "Decor" },
    ],
  },
  {
    slug: "furniture",
    name: "Furniture",
    description: "Seating, tables and lighting made by workshops we can name.",
    palette: "stone",
    featured: true,
    children: [
      { slug: "seating", name: "Seating" },
      { slug: "tables", name: "Tables" },
      { slug: "lighting", name: "Lighting" },
    ],
  },
  {
    slug: "sport",
    name: "Sport",
    description: "Kit for running, training and going outside in bad weather.",
    palette: "forest",
    featured: true,
    children: [
      { slug: "running", name: "Running" },
      { slug: "training", name: "Training" },
      { slug: "outdoor", name: "Outdoor" },
    ],
  },
  {
    slug: "accessories",
    name: "Accessories",
    description: "Bags, watches and eyewear that finish an outfit.",
    palette: "clay",
    featured: true,
    children: [
      { slug: "bags", name: "Bags" },
      { slug: "watches", name: "Watches" },
      { slug: "eyewear", name: "Eyewear" },
    ],
  },
  {
    slug: "food-drink",
    name: "Food & Drink",
    description: "Coffee, tea and pantry staples from small producers.",
    palette: "amber",
    children: [
      { slug: "coffee-tea", name: "Coffee & Tea" },
      { slug: "pantry", name: "Pantry" },
    ],
  },
  {
    slug: "toys-play",
    name: "Toys & Play",
    description: "Open-ended toys and games that survive a childhood.",
    palette: "olive",
    children: [
      { slug: "building-play", name: "Building & Play" },
      { slug: "games", name: "Games" },
    ],
  },
  {
    slug: "office",
    name: "Office",
    description: "Desk objects and stationery for people who still write things down.",
    palette: "ink",
    children: [
      { slug: "desk", name: "Desk" },
      { slug: "stationery", name: "Stationery" },
    ],
  },
  {
    slug: "automotive",
    name: "Automotive",
    description: "Care and interior accessories for looking after a car properly.",
    palette: "slate",
    children: [
      { slug: "car-care", name: "Car Care" },
      { slug: "car-interior", name: "Car Interior" },
    ],
  },
];

export type BrandSeed = { slug: string; name: string; description: string; featured?: boolean };

export const BRANDS: BrandSeed[] = [
  { slug: "ashcroft", name: "Ashcroft", description: "Outerwear made in a single British workshop since the studio's founding.", featured: true },
  { slug: "fenwick-park", name: "Fenwick Park", description: "Knitwear and shirting in long-staple cotton and lambswool.", featured: true },
  { slug: "tidal", name: "Tidal", description: "Running and training kit developed with coastal club runners." },
  { slug: "nocturne-audio", name: "Nocturne Audio", description: "Headphones and speakers tuned for long listening, not loud demos.", featured: true },
  { slug: "orrery", name: "Orrery", description: "Computing accessories in machined aluminium and recycled polymer." },
  { slug: "meridian-skin", name: "Meridian Skin", description: "Short-formula skincare, fragrance-free unless fragrance is the point.", featured: true },
  { slug: "bramble-co", name: "Bramble & Co", description: "Haircare and fragrance blended in small batches." },
  { slug: "kestrel", name: "Kestrel", description: "Solid timber seating and tables from a family workshop." },
  { slug: "halstead", name: "Halstead", description: "Lighting and decor with a preference for warm, low light.", featured: true },
  { slug: "northbay", name: "Northbay", description: "Kitchen and table goods built for daily use." },
  { slug: "verdant", name: "Verdant", description: "Coffee, tea and pantry staples traded directly with growers." },
  { slug: "cobalt-row", name: "Cobalt Row", description: "Bags, watches and eyewear with a hardware obsession." },
  { slug: "petra-stone", name: "Petra Stone", description: "Toys, games and desk objects designed to be handed down." },
  { slug: "carrow", name: "Carrow", description: "Car care and interior accessories for people who wash by hand." },
];

export type AttributeDefSeed = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT";
  unit?: string;
  options?: string[];
  categorySlug?: string;
  filterable?: boolean;
};

/**
 * Attribute definitions are data, not code. An administrator adds a row here
 * (through the admin panel in production) and a whole new product type becomes
 * describable and filterable without a migration.
 */
export const ATTRIBUTE_DEFINITIONS: AttributeDefSeed[] = [
  { key: "material", label: "Material", type: "TEXT", filterable: true },
  { key: "care", label: "Care", type: "TEXT" },
  { key: "origin", label: "Made in", type: "TEXT", filterable: true },
  { key: "fit", label: "Fit", type: "SELECT", options: ["Slim", "Regular", "Relaxed", "Oversized"], categorySlug: "fashion", filterable: true },
  { key: "driver-size", label: "Driver size", type: "NUMBER", unit: "mm", categorySlug: "electronics" },
  { key: "battery-life", label: "Battery life", type: "NUMBER", unit: "hours", categorySlug: "electronics", filterable: true },
  { key: "connectivity", label: "Connectivity", type: "SELECT", options: ["Bluetooth 5.3", "USB-C", "3.5mm", "Wi-Fi"], categorySlug: "electronics", filterable: true },
  { key: "skin-type", label: "Skin type", type: "SELECT", options: ["All", "Dry", "Oily", "Combination", "Sensitive"], categorySlug: "beauty", filterable: true },
  { key: "volume", label: "Volume", type: "NUMBER", unit: "ml", categorySlug: "beauty" },
  { key: "fragrance-free", label: "Fragrance free", type: "BOOLEAN", categorySlug: "beauty", filterable: true },
  { key: "seat-height", label: "Seat height", type: "NUMBER", unit: "cm", categorySlug: "furniture" },
  { key: "assembly", label: "Assembly required", type: "BOOLEAN", categorySlug: "furniture" },
  { key: "bulb-fitting", label: "Bulb fitting", type: "SELECT", options: ["E27", "E14", "GU10", "Integrated LED"], categorySlug: "furniture", filterable: true },
  { key: "drop", label: "Drop", type: "NUMBER", unit: "mm", categorySlug: "sport" },
  { key: "waterproof", label: "Waterproof", type: "BOOLEAN", categorySlug: "sport", filterable: true },
  { key: "roast", label: "Roast", type: "SELECT", options: ["Light", "Medium", "Dark"], categorySlug: "food-drink", filterable: true },
  { key: "weight-net", label: "Net weight", type: "NUMBER", unit: "g", categorySlug: "food-drink" },
  { key: "age-range", label: "Age range", type: "SELECT", options: ["0–2", "3–5", "6–9", "10+"], categorySlug: "toys-play", filterable: true },
  { key: "player-count", label: "Players", type: "TEXT", categorySlug: "toys-play" },
  { key: "water-resistance", label: "Water resistance", type: "TEXT", categorySlug: "accessories" },
  { key: "capacity", label: "Capacity", type: "NUMBER", unit: "litres", categorySlug: "accessories", filterable: true },
  { key: "refillable", label: "Refillable", type: "BOOLEAN", categorySlug: "office" },
  { key: "vehicle-fit", label: "Vehicle fit", type: "TEXT", categorySlug: "automotive" },
];

export type OptionSeed = { name: string; values: Array<{ value: string; swatchHex?: string }> };

export type ProductSeed = {
  slug: string;
  title: string;
  brand: string;
  category: string;
  /** Extra categories the product also belongs to. */
  alsoIn?: string[];
  archetype: Archetype;
  palette: PaletteKey;
  short: string;
  description: string;
  priceCents: number;
  salePriceCents?: number;
  costPriceCents: number;
  weightGrams?: number;
  tags: string[];
  options?: OptionSeed[];
  /** Stock per variant; a single number applies to every variant. */
  stock: number | number[];
  featured?: boolean;
  lowStockThreshold?: number;
  taxClass?: "standard" | "zero";
  attributes?: Record<string, string>;
  /** Marks the product as having a 3D model for the interactive viewer. */
  has3d?: boolean;
};

const SIZES_APPAREL: OptionSeed = {
  name: "Size",
  values: [{ value: "XS" }, { value: "S" }, { value: "M" }, { value: "L" }, { value: "XL" }],
};

const SIZES_SHOE: OptionSeed = {
  name: "Size",
  values: [{ value: "UK 6" }, { value: "UK 7" }, { value: "UK 8" }, { value: "UK 9" }, { value: "UK 10" }, { value: "UK 11" }],
};

export const PRODUCTS: ProductSeed[] = [
  // ---------------------------------------------------------------- fashion
  {
    slug: "ashcroft-storm-overcoat",
    title: "Storm Overcoat",
    brand: "ashcroft",
    category: "outerwear",
    archetype: "outerwear",
    palette: "sand",
    short: "A double-faced wool overcoat with a storm collar and a dropped shoulder.",
    description:
      "Cut from a double-faced wool that needs no lining, the Storm Overcoat holds its shape through a winter of being pushed into the back of a car. The collar stands when you need it to and falls flat when you do not. Seams are taped by hand at the shoulder, which is why each one takes the workshop the better part of a day.",
    priceCents: 42_000,
    costPriceCents: 18_500,
    weightGrams: 1800,
    tags: ["wool", "winter", "coat", "outerwear"],
    options: [
      { name: "Colour", values: [{ value: "Bark", swatchHex: "#6E5843" }, { value: "Slate", swatchHex: "#4A5257" }] },
      SIZES_APPAREL,
    ],
    stock: [4, 9, 12, 8, 3, 2, 7, 11, 6, 1],
    featured: true,
    attributes: { material: "Double-faced wool", care: "Dry clean only", origin: "United Kingdom", fit: "Relaxed" },
  },
  {
    slug: "ashcroft-field-jacket",
    title: "Waxed Field Jacket",
    brand: "ashcroft",
    category: "outerwear",
    archetype: "outerwear",
    palette: "olive",
    short: "Waxed cotton, four pockets, and a cuff that closes over a glove.",
    description:
      "A field jacket that improves with neglect. The waxed cotton darkens where you fold it and lightens where you do not, and after a year it looks like yours rather than ours. Re-waxing instructions are printed inside the placket rather than on a card you will lose.",
    priceCents: 31_500,
    salePriceCents: 23_600,
    costPriceCents: 13_200,
    weightGrams: 1400,
    tags: ["waxed cotton", "jacket", "sale"],
    options: [SIZES_APPAREL],
    stock: [2, 6, 0, 4, 5],
    attributes: { material: "Waxed cotton", care: "Re-wax annually; do not machine wash", origin: "Portugal", fit: "Regular" },
  },
  {
    slug: "fenwick-lambswool-crew",
    title: "Lambswool Crew Neck",
    brand: "fenwick-park",
    category: "knitwear",
    archetype: "garment",
    palette: "oat",
    short: "A five-gauge lambswool crew that keeps its neck.",
    description:
      "Knitted in five-gauge lambswool with a doubled neck trim, because the neck is the first thing to go. Fully fashioned, so the panels are knitted to shape rather than cut from a sheet — more yarn, less waste, and a shoulder seam that sits where your shoulder is.",
    priceCents: 14_500,
    costPriceCents: 5_900,
    weightGrams: 520,
    tags: ["lambswool", "knit", "jumper"],
    options: [
      { name: "Colour", values: [{ value: "Oat", swatchHex: "#D8CDB8" }, { value: "Forest", swatchHex: "#2F5548" }, { value: "Clay", swatchHex: "#B5654A" }] },
      SIZES_APPAREL,
    ],
    stock: 14,
    featured: true,
    attributes: { material: "100% lambswool", care: "Hand wash cold, dry flat", origin: "Scotland", fit: "Regular" },
  },
  {
    slug: "fenwick-oxford-shirt",
    title: "Heavy Oxford Shirt",
    brand: "fenwick-park",
    category: "shirts-tops",
    archetype: "garment",
    palette: "stone",
    short: "A 160gsm oxford with a collar that stands without fusing.",
    description:
      "The collar is constructed from three layers of the same cloth rather than glued to interfacing, so it softens rather than bubbles. The body is a heavy 160gsm oxford that takes a season to break in and then behaves for years.",
    priceCents: 9_500,
    costPriceCents: 3_400,
    weightGrams: 380,
    tags: ["cotton", "shirt", "oxford"],
    options: [
      { name: "Colour", values: [{ value: "White", swatchHex: "#F5F2EC" }, { value: "Sky", swatchHex: "#B9C7D3" }] },
      SIZES_APPAREL,
    ],
    stock: 22,
    attributes: { material: "160gsm cotton oxford", care: "Machine wash 30°", origin: "Portugal", fit: "Regular" },
  },
  {
    slug: "fenwick-pleated-trouser",
    title: "Pleated Wide Trouser",
    brand: "fenwick-park",
    category: "trousers",
    archetype: "garment",
    palette: "ink",
    short: "A single-pleat trouser in a dry wool twill.",
    description:
      "One pleat, not two — enough room to sit down in without the volume reading as costume. The waistband is curtained and can be let out twice, which is a quiet acknowledgement of how bodies work.",
    priceCents: 16_500,
    costPriceCents: 6_800,
    tags: ["wool", "trouser", "tailoring"],
    options: [SIZES_APPAREL],
    stock: [3, 7, 9, 5, 2],
    attributes: { material: "Wool twill", care: "Dry clean", origin: "Italy", fit: "Relaxed" },
  },
  {
    slug: "tidal-coastal-runner",
    title: "Coastal Runner",
    brand: "tidal",
    category: "footwear",
    alsoIn: ["running"],
    archetype: "shoe",
    palette: "forest",
    short: "A daily trainer with a 6mm drop and an outsole that grips wet stone.",
    description:
      "Developed with a club that runs a sea wall in February. The outsole compound stays pliable in the cold, the upper drains rather than holds water, and the midsole is a single-density foam that does not collapse into a favourite side after 200 kilometres.",
    priceCents: 13_500,
    costPriceCents: 5_200,
    weightGrams: 560,
    tags: ["running", "trainer", "waterproof"],
    options: [SIZES_SHOE],
    stock: [6, 12, 15, 11, 4, 0],
    featured: true,
    has3d: true,
    attributes: { material: "Recycled mesh upper", drop: "6", waterproof: "true", origin: "Vietnam" },
  },

  // ------------------------------------------------------------ electronics
  {
    slug: "nocturne-over-ear-headphones",
    title: "Nocturne One Over-Ear",
    brand: "nocturne-audio",
    category: "audio",
    archetype: "headphones",
    palette: "slate",
    short: "Closed-back over-ears tuned flat, with 40 hours between charges.",
    description:
      "Tuned to sit close to flat, which sounds unremarkable for thirty seconds and then correct for the rest of the day. The earpads are replaceable with a twist, the headband is steel rather than filled nylon, and the battery is rated for 40 hours with the noise cancelling on.",
    priceCents: 27_900,
    costPriceCents: 11_400,
    weightGrams: 310,
    tags: ["headphones", "audio", "noise cancelling"],
    options: [{ name: "Colour", values: [{ value: "Graphite", swatchHex: "#3A4044" }, { value: "Bone", swatchHex: "#E8E2D6" }] }],
    stock: [18, 6],
    featured: true,
    has3d: true,
    attributes: { "driver-size": "40", "battery-life": "40", connectivity: "Bluetooth 5.3", material: "Steel and recycled polymer" },
  },
  {
    slug: "nocturne-shelf-speaker",
    title: "Nocturne Shelf Speaker",
    brand: "nocturne-audio",
    category: "audio",
    archetype: "speaker",
    palette: "ink",
    short: "A sealed two-way shelf speaker that does not need a subwoofer to sound whole.",
    description:
      "A sealed cabinet in 18mm birch ply, which costs more than MDF and sounds like it. Paired with a soft-dome tweeter crossed over low enough that voices sit in one place rather than two.",
    priceCents: 49_500,
    costPriceCents: 21_000,
    weightGrams: 6200,
    tags: ["speaker", "audio", "hifi"],
    stock: 5,
    lowStockThreshold: 6,
    attributes: { connectivity: "Wi-Fi", material: "Birch ply" },
  },
  {
    slug: "orrery-aluminium-stand",
    title: "Machined Laptop Stand",
    brand: "orrery",
    category: "computing",
    archetype: "laptop",
    palette: "stone",
    short: "One piece of machined aluminium; no hinges to work loose.",
    description:
      "Cut from a single billet, anodised, and finished with a cork pad that does not mark a lid. There is nothing to adjust, which is the point: the height is the height that stops you looking down.",
    priceCents: 8_900,
    salePriceCents: 6_700,
    costPriceCents: 3_100,
    weightGrams: 1100,
    tags: ["desk", "aluminium", "sale"],
    stock: 26,
    attributes: { material: "6063 aluminium", origin: "Germany" },
  },
  {
    slug: "orrery-travel-charger",
    title: "Three-Port Travel Charger",
    brand: "orrery",
    category: "mobile-tech",
    archetype: "device",
    palette: "slate",
    short: "65W across three ports, with folding pins.",
    description:
      "Gallium nitride internals mean 65W in something the size of a matchbox, and the pins fold so it does not tear a bag lining. Two USB-C ports and one USB-A, because the world has not quite finished changing over.",
    priceCents: 5_500,
    costPriceCents: 2_000,
    weightGrams: 150,
    tags: ["charger", "travel", "usb-c"],
    stock: 42,
    attributes: { connectivity: "USB-C", "battery-life": "0" },
  },
  {
    slug: "orrery-field-watch-band",
    title: "Woven Watch Band",
    brand: "orrery",
    category: "mobile-tech",
    alsoIn: ["watches"],
    archetype: "watch",
    palette: "clay",
    short: "A woven band with a machined clasp, in three widths.",
    description:
      "Woven from a recycled yarn that stays soft when wet, finished with a machined clasp rather than a stamped one. Quick-release pins mean you can change it without a tool you do not own.",
    priceCents: 4_500,
    costPriceCents: 1_400,
    tags: ["watch", "band", "accessory"],
    options: [{ name: "Width", values: [{ value: "20mm" }, { value: "22mm" }] }],
    stock: [15, 9],
    attributes: { material: "Recycled yarn", "water-resistance": "Splash resistant" },
  },

  // ----------------------------------------------------------------- beauty
  {
    slug: "meridian-barrier-serum",
    title: "Barrier Repair Serum",
    brand: "meridian-skin",
    category: "skincare",
    archetype: "bottle",
    palette: "blush",
    short: "Nine ingredients, no fragrance, 30ml.",
    description:
      "A serum with a deliberately short ingredient list: ceramides, glycerin, and the smallest amount of preservative that keeps it safe. Fragrance-free because fragrance is the most common reason a serum stings.",
    priceCents: 3_800,
    costPriceCents: 1_100,
    tags: ["skincare", "serum", "fragrance free"],
    options: [{ name: "Size", values: [{ value: "30ml" }, { value: "50ml" }] }],
    stock: [40, 18],
    featured: true,
    attributes: { "skin-type": "Sensitive", volume: "30", "fragrance-free": "true", origin: "United Kingdom" },
  },
  {
    slug: "meridian-day-cream",
    title: "Everyday Moisturiser SPF 30",
    brand: "meridian-skin",
    category: "skincare",
    archetype: "jar",
    palette: "blush",
    short: "A daily moisturiser with mineral SPF that does not leave a cast.",
    description:
      "Mineral sunscreen usually means a grey cast; this one is milled fine enough to avoid it on most skin tones. Thick enough for winter, light enough that you will actually wear it.",
    priceCents: 2_900,
    costPriceCents: 900,
    tags: ["skincare", "spf", "moisturiser"],
    stock: 0,
    attributes: { "skin-type": "All", volume: "50", "fragrance-free": "true" },
  },
  {
    slug: "bramble-cedar-eau",
    title: "Cedar & Sea Salt Eau de Parfum",
    brand: "bramble-co",
    category: "fragrance",
    archetype: "bottle",
    palette: "amber",
    short: "Cedar, salt and a little smoke. 50ml, refillable.",
    description:
      "Built around a cedar that reads dry rather than sweet, with salt over the top and a thread of smoke underneath. Blended in batches of two hundred, which is why the reference number on the base changes.",
    priceCents: 8_200,
    costPriceCents: 2_600,
    tags: ["fragrance", "unisex", "refillable"],
    stock: 12,
    featured: true,
    attributes: { volume: "50", "fragrance-free": "false" },
  },
  {
    slug: "bramble-repair-shampoo",
    title: "Repair Shampoo",
    brand: "bramble-co",
    category: "haircare",
    archetype: "bottle",
    palette: "olive",
    short: "A low-foam shampoo for hair that is washed often.",
    description:
      "Low-foam is not a compromise — foam is mostly theatre. This washes without stripping, and the bottle is designed to be refilled from the litre pouch rather than replaced.",
    priceCents: 2_200,
    salePriceCents: 1_760,
    costPriceCents: 700,
    tags: ["haircare", "shampoo", "sale"],
    stock: 33,
    attributes: { volume: "300", "fragrance-free": "false" },
  },

  // ----------------------------------------------------------- home & living
  {
    slug: "northbay-stoneware-mug",
    title: "Stoneware Mug",
    brand: "northbay",
    category: "kitchen",
    archetype: "mug",
    palette: "stone",
    short: "A 350ml stoneware mug with a handle wide enough for two fingers.",
    description:
      "Thrown in stoneware and glazed inside and out, so it does not stain with tea. The handle takes two fingers, which is the difference between a mug you reach for and one you do not.",
    priceCents: 1_800,
    costPriceCents: 550,
    weightGrams: 420,
    tags: ["kitchen", "ceramic", "mug"],
    options: [{ name: "Glaze", values: [{ value: "Chalk", swatchHex: "#E9E4DA" }, { value: "Ink", swatchHex: "#2A2724" }, { value: "Clay", swatchHex: "#B5654A" }] }],
    stock: [30, 24, 2],
    attributes: { material: "Stoneware", care: "Dishwasher safe", origin: "Portugal" },
  },
  {
    slug: "northbay-chef-knife",
    title: "Carbon Steel Chef Knife",
    brand: "northbay",
    category: "kitchen",
    archetype: "pen",
    palette: "slate",
    short: "A 20cm carbon steel blade that takes a proper edge.",
    description:
      "Carbon steel rusts if you leave it wet and takes an edge that stainless cannot. It will develop a patina within a month and that is the intended outcome, not a fault.",
    priceCents: 11_500,
    costPriceCents: 4_200,
    weightGrams: 240,
    tags: ["kitchen", "knife", "carbon steel"],
    stock: 8,
    attributes: { material: "Carbon steel", care: "Hand wash and dry immediately", origin: "Japan" },
  },
  {
    slug: "northbay-linen-throw",
    title: "Washed Linen Throw",
    brand: "northbay",
    category: "textiles",
    archetype: "garment",
    palette: "oat",
    short: "Stonewashed linen, 130 × 180cm, softer each wash.",
    description:
      "European flax, stonewashed so it arrives soft rather than requiring a year of use. Wide enough to cover two people on a sofa, which is the only specification that matters.",
    priceCents: 8_500,
    costPriceCents: 3_100,
    weightGrams: 900,
    tags: ["linen", "throw", "textiles"],
    options: [{ name: "Colour", values: [{ value: "Oat", swatchHex: "#D8CDB8" }, { value: "Sage", swatchHex: "#98A187" }] }],
    stock: [11, 7],
    featured: true,
    attributes: { material: "100% European flax linen", care: "Machine wash 40°", origin: "Lithuania" },
  },
  {
    slug: "halstead-ceramic-vase",
    title: "Tall Ceramic Vase",
    brand: "halstead",
    category: "decor",
    archetype: "vase",
    palette: "clay",
    short: "A 34cm vase with a neck narrow enough for three stems.",
    description:
      "Most vases are too wide, and flowers fall to the sides. This one has a neck that holds three stems upright, which is the arrangement most people actually buy.",
    priceCents: 6_500,
    costPriceCents: 2_300,
    weightGrams: 1600,
    tags: ["decor", "ceramic", "vase"],
    stock: 3,
    lowStockThreshold: 5,
    attributes: { material: "Glazed ceramic", origin: "Portugal" },
  },

  // -------------------------------------------------------------- furniture
  {
    slug: "kestrel-lounge-chair",
    title: "Kestrel Lounge Chair",
    brand: "kestrel",
    category: "seating",
    archetype: "chair",
    palette: "oat",
    short: "Solid oak frame, webbed seat, no visible fixings.",
    description:
      "The frame is solid oak jointed with dowels rather than screws, so there is nothing to work loose and nothing to cover with a plastic cap. The seat is webbed and re-tensionable; the workshop will send the webbing kit for the cost of postage.",
    priceCents: 78_000,
    costPriceCents: 34_000,
    weightGrams: 9500,
    tags: ["furniture", "oak", "chair"],
    options: [{ name: "Finish", values: [{ value: "Natural oak", swatchHex: "#D8C39A" }, { value: "Smoked oak", swatchHex: "#6B563E" }] }],
    stock: [4, 2],
    featured: true,
    has3d: true,
    attributes: { material: "Solid oak", "seat-height": "42", assembly: "true", origin: "Denmark" },
  },
  {
    slug: "kestrel-two-seat-sofa",
    title: "Kestrel Two-Seat Sofa",
    brand: "kestrel",
    category: "seating",
    archetype: "sofa",
    palette: "stone",
    short: "A two-seater with a removable, washable cover.",
    description:
      "A frame that can be reupholstered rather than replaced, with covers that unzip and go in a domestic machine. The cushions are feather-wrapped foam, which holds shape but still takes an imprint — that is what a sofa should do.",
    priceCents: 145_000,
    salePriceCents: 116_000,
    costPriceCents: 62_000,
    tags: ["furniture", "sofa", "sale"],
    options: [{ name: "Cover", values: [{ value: "Stone", swatchHex: "#9A958C" }, { value: "Forest", swatchHex: "#2F5548" }] }],
    stock: [2, 1],
    lowStockThreshold: 3,
    attributes: { material: "Kiln-dried hardwood frame", assembly: "true" },
  },
  {
    slug: "halstead-table-lamp",
    title: "Halstead Table Lamp",
    brand: "halstead",
    category: "lighting",
    archetype: "lamp",
    palette: "amber",
    short: "A brass-stemmed lamp with a linen shade and a dimmer in the flex.",
    description:
      "The dimmer is in the flex where your hand already is, rather than on the base behind the thing you put in front of it. The shade is linen over a steel frame, so the light is warm without being yellow.",
    priceCents: 18_500,
    costPriceCents: 7_400,
    weightGrams: 2400,
    tags: ["lighting", "brass", "lamp"],
    stock: 9,
    featured: true,
    attributes: { material: "Brass and linen", "bulb-fitting": "E27", origin: "United Kingdom" },
  },

  // ------------------------------------------------------------------ sport
  {
    slug: "tidal-training-short",
    title: "Training Short",
    brand: "tidal",
    category: "training",
    archetype: "garment",
    palette: "forest",
    short: "A five-inch short with a zip pocket that holds a phone still.",
    description:
      "The pocket sits at the back of the waistband and is cut on the bias, so a phone stays flat instead of slapping. Liner is optional and removable, which is a debate we decided not to have on your behalf.",
    priceCents: 4_500,
    costPriceCents: 1_500,
    tags: ["training", "shorts", "running"],
    options: [SIZES_APPAREL],
    stock: [8, 16, 20, 14, 6],
    attributes: { material: "Recycled polyamide", waterproof: "false" },
  },
  {
    slug: "tidal-insulated-flask",
    title: "Insulated Flask 750ml",
    brand: "tidal",
    category: "outdoor",
    archetype: "bottle-sport",
    palette: "slate",
    short: "Holds heat for twelve hours; fits a bike cage.",
    description:
      "Vacuum-insulated steel with a lid that opens one-handed and does not leak when it is upside down in a bag. Sized to fit a standard bottle cage, which is surprisingly rare.",
    priceCents: 3_200,
    costPriceCents: 1_000,
    weightGrams: 420,
    tags: ["flask", "outdoor", "steel"],
    options: [{ name: "Colour", values: [{ value: "Slate", swatchHex: "#4A5257" }, { value: "Clay", swatchHex: "#B5654A" }, { value: "Bone", swatchHex: "#E8E2D6" }] }],
    stock: [25, 18, 4],
    attributes: { material: "18/8 stainless steel", capacity: "0.75", waterproof: "true" },
  },
  {
    slug: "tidal-club-football",
    title: "Club Match Ball",
    brand: "tidal",
    category: "training",
    archetype: "ball",
    palette: "amber",
    short: "A hand-stitched match ball that keeps its shape in the wet.",
    description:
      "Hand-stitched with a latex bladder and a textured surface that stays predictable when it is soaked. Size five, and it holds pressure for a fortnight rather than a session.",
    priceCents: 4_800,
    costPriceCents: 1_800,
    weightGrams: 430,
    tags: ["football", "training", "ball"],
    stock: 17,
    attributes: { material: "Hand-stitched PU", waterproof: "true" },
  },

  // ------------------------------------------------------------ accessories
  {
    slug: "cobalt-weekend-bag",
    title: "Weekend Holdall",
    brand: "cobalt-row",
    category: "bags",
    archetype: "bag",
    palette: "clay",
    short: "A 40-litre holdall in waxed canvas with a leather base.",
    description:
      "Forty litres, which is two nights without editing what you take. The base is a single piece of vegetable-tanned leather, so the part that meets the floor is the part that lasts longest.",
    priceCents: 22_500,
    costPriceCents: 9_000,
    weightGrams: 1600,
    tags: ["bag", "travel", "leather"],
    options: [{ name: "Colour", values: [{ value: "Tan", swatchHex: "#A9784F" }, { value: "Black", swatchHex: "#2A2724" }] }],
    stock: [6, 9],
    featured: true,
    attributes: { material: "Waxed canvas and vegetable-tanned leather", capacity: "40", origin: "Spain" },
  },
  {
    slug: "cobalt-field-watch",
    title: "Field Watch 38mm",
    brand: "cobalt-row",
    category: "watches",
    archetype: "watch",
    palette: "ink",
    short: "A 38mm automatic with a sapphire crystal and 100m water resistance.",
    description:
      "Thirty-eight millimetres, because a field watch should fit under a cuff. Automatic movement, sapphire crystal, screw-down crown, and a case back you can open with a tool rather than a press.",
    priceCents: 39_500,
    costPriceCents: 16_500,
    tags: ["watch", "automatic", "sapphire"],
    options: [{ name: "Dial", values: [{ value: "Black", swatchHex: "#1A1A1A" }, { value: "Cream", swatchHex: "#E8DFC8" }] }],
    stock: [3, 5],
    featured: true,
    has3d: true,
    attributes: { material: "316L stainless steel", "water-resistance": "100m" },
  },
  {
    slug: "cobalt-acetate-sunglasses",
    title: "Acetate Sunglasses",
    brand: "cobalt-row",
    category: "eyewear",
    archetype: "generic",
    palette: "sand",
    short: "Hand-polished acetate with polarised lenses.",
    description:
      "Acetate that has been tumbled for three days rather than three hours, which is why the edges feel finished. Lenses are polarised and replaceable by any optician.",
    priceCents: 12_500,
    salePriceCents: 8_750,
    costPriceCents: 4_100,
    tags: ["sunglasses", "acetate", "sale"],
    stock: 14,
    attributes: { material: "Italian acetate", "water-resistance": "Not water resistant" },
  },

  // ------------------------------------------------------------- food & drink
  {
    slug: "verdant-house-espresso",
    title: "House Espresso 250g",
    brand: "verdant",
    category: "coffee-tea",
    archetype: "jar",
    palette: "amber",
    short: "A medium roast for milk, roasted weekly.",
    description:
      "A blend built to hold up in milk without turning to caramel — cocoa and dried fruit, with enough acidity left to taste like coffee. Roasted on Mondays and shipped the same week.",
    priceCents: 1_150,
    costPriceCents: 420,
    weightGrams: 250,
    tags: ["coffee", "espresso", "roast"],
    options: [{ name: "Grind", values: [{ value: "Whole bean" }, { value: "Espresso" }, { value: "Filter" }] }],
    stock: [60, 34, 22],
    taxClass: "zero",
    attributes: { roast: "Medium", "weight-net": "250", origin: "Colombia and Brazil" },
  },
  {
    slug: "verdant-breakfast-tea",
    title: "Breakfast Tea 125g",
    brand: "verdant",
    category: "coffee-tea",
    archetype: "jar",
    palette: "olive",
    short: "A brisk Assam-led blend, loose leaf.",
    description:
      "Assam-led and brisk enough to take milk, in a loose leaf that does not turn to dust in the tin. The tin is the refill; the pouch is the cheaper repeat.",
    priceCents: 950,
    costPriceCents: 320,
    weightGrams: 125,
    tags: ["tea", "loose leaf"],
    stock: 45,
    taxClass: "zero",
    attributes: { "weight-net": "125", origin: "India" },
  },
  {
    slug: "verdant-olive-oil",
    title: "Cold-Pressed Olive Oil 500ml",
    brand: "verdant",
    category: "pantry",
    archetype: "bottle",
    palette: "olive",
    short: "Single-estate, pressed within four hours of picking.",
    description:
      "Pressed within four hours of picking, which is why it tastes green rather than flat. Peppery at the back of the throat — that is the polyphenols, and it fades over the year, so the harvest date is on the front.",
    priceCents: 1_650,
    costPriceCents: 620,
    weightGrams: 900,
    tags: ["oil", "pantry", "single estate"],
    stock: 28,
    taxClass: "zero",
    attributes: { "weight-net": "500", origin: "Greece" },
  },

  // ------------------------------------------------------------- toys & play
  {
    slug: "petra-timber-blocks",
    title: "Timber Block Set",
    brand: "petra-stone",
    category: "building-play",
    archetype: "blocks",
    palette: "sand",
    short: "Forty beech blocks in six shapes, unfinished.",
    description:
      "Unfinished beech, sanded to a radius that does not splinter. Six shapes and forty pieces, which is enough to build something and not so many that tidying up becomes the activity.",
    priceCents: 5_500,
    costPriceCents: 1_900,
    weightGrams: 2200,
    tags: ["toys", "wooden", "blocks"],
    stock: 19,
    featured: true,
    attributes: { material: "FSC beech", "age-range": "3–5", origin: "Germany" },
  },
  {
    slug: "petra-strategy-game",
    title: "Harbour Strategy Game",
    brand: "petra-stone",
    category: "games",
    archetype: "book",
    palette: "forest",
    short: "A 45-minute tile game for two to four players.",
    description:
      "Forty-five minutes, two to four players, and rules that fit on two sides of card. The tiles are 2mm board rather than 1.5mm, which sounds like nothing until you shuffle them for the hundredth time.",
    priceCents: 3_400,
    costPriceCents: 1_200,
    tags: ["game", "board game", "family"],
    stock: 24,
    attributes: { "age-range": "10+", "player-count": "2–4" },
  },

  // ----------------------------------------------------------------- office
  {
    slug: "petra-brass-pen",
    title: "Solid Brass Pen",
    brand: "petra-stone",
    category: "stationery",
    archetype: "pen",
    palette: "amber",
    short: "Machined brass, takes a standard refill.",
    description:
      "Machined from solid brass so it has the weight to write without being gripped. It takes the refill you can buy in any stationer, because a pen that needs a proprietary cartridge is a subscription.",
    priceCents: 4_200,
    costPriceCents: 1_400,
    weightGrams: 60,
    tags: ["pen", "brass", "stationery"],
    stock: 31,
    attributes: { material: "Solid brass", refillable: "true", origin: "United Kingdom" },
  },
  {
    slug: "petra-desk-notebook",
    title: "Threadbound Notebook A5",
    brand: "petra-stone",
    category: "stationery",
    archetype: "book",
    palette: "ink",
    short: "100gsm paper, sewn so it lies flat.",
    description:
      "Section-sewn rather than glued, so it opens flat on the first page instead of the fiftieth. The 100gsm paper takes fountain ink without ghosting.",
    priceCents: 1_600,
    costPriceCents: 480,
    tags: ["notebook", "paper", "stationery"],
    options: [{ name: "Ruling", values: [{ value: "Ruled" }, { value: "Dotted" }, { value: "Plain" }] }],
    stock: [40, 52, 18],
    attributes: { material: "100gsm uncoated paper", refillable: "false" },
  },
  {
    slug: "orrery-desk-organiser",
    title: "Desk Organiser",
    brand: "orrery",
    category: "desk",
    archetype: "generic",
    palette: "stone",
    short: "A weighted tray for the things that end up on a desk anyway.",
    description:
      "A weighted base so it does not travel when you drop keys into it, and a felt liner so that dropping keys into it is not loud. Three compartments, which is two fewer than most and the right number.",
    priceCents: 3_900,
    costPriceCents: 1_300,
    weightGrams: 800,
    tags: ["desk", "organiser", "office"],
    stock: 16,
    attributes: { material: "Powder-coated steel and wool felt" },
  },

  // ------------------------------------------------------------- automotive
  {
    slug: "carrow-wash-kit",
    title: "Two-Bucket Wash Kit",
    brand: "carrow",
    category: "car-care",
    archetype: "bottle",
    palette: "slate",
    short: "pH-neutral shampoo, two grit guards and a lambswool mitt.",
    description:
      "The two-bucket method exists because one bucket grinds the dirt back into the paint. This is the shampoo, the guards and the mitt, and a card explaining the order to do it in.",
    priceCents: 4_900,
    costPriceCents: 1_700,
    weightGrams: 2800,
    tags: ["car care", "cleaning", "kit"],
    stock: 13,
    attributes: { "vehicle-fit": "Universal", material: "Lambswool mitt" },
  },
  {
    slug: "carrow-boot-liner",
    title: "Moulded Boot Liner",
    brand: "carrow",
    category: "car-interior",
    archetype: "generic",
    palette: "ink",
    short: "A raised-lip liner that keeps a wet dog out of the carpet.",
    description:
      "A raised lip on all four sides, which is the only feature that matters when something spills. Moulded rather than cut, so it sits flat instead of curling at the corners.",
    priceCents: 6_900,
    salePriceCents: 5_500,
    costPriceCents: 2_400,
    weightGrams: 3400,
    tags: ["car", "interior", "sale"],
    options: [{ name: "Size", values: [{ value: "Estate" }, { value: "Hatchback" }, { value: "SUV" }] }],
    stock: [7, 11, 0],
    attributes: { "vehicle-fit": "Check model list before ordering", material: "Recycled TPE" },
  },
  {
    slug: "carrow-tyre-gauge",
    title: "Brass Tyre Gauge",
    brand: "carrow",
    category: "car-care",
    archetype: "tyre",
    palette: "amber",
    short: "A mechanical gauge with no battery to go flat.",
    description:
      "Mechanical, brass-bodied, and accurate to 0.1 bar. It has no battery, no app and no firmware, so it will work in ten years without anyone's permission.",
    priceCents: 2_800,
    costPriceCents: 950,
    weightGrams: 180,
    tags: ["tyre", "gauge", "tools"],
    stock: 21,
    attributes: { material: "Brass", "vehicle-fit": "Universal" },
  },
];

export const COUPONS = [
  {
    code: "WELCOME10",
    description: "10% off a first order",
    discountType: "PERCENTAGE" as const,
    discountValue: 1000,
    minSubtotalCents: 3_000,
    maxDiscountCents: 5_000,
    usageLimitPerUser: 1,
  },
  {
    code: "MALL20",
    description: "20% off everything, limited run",
    discountType: "PERCENTAGE" as const,
    discountValue: 2000,
    minSubtotalCents: 10_000,
    maxDiscountCents: 20_000,
    usageLimit: 500,
  },
  {
    code: "FREEPOST",
    description: "Free standard delivery",
    discountType: "FREE_SHIPPING" as const,
    discountValue: 0,
    minSubtotalCents: null,
  },
  {
    code: "BEAUTY15",
    description: "£15 off beauty",
    discountType: "FIXED_AMOUNT" as const,
    discountValue: 1_500,
    minSubtotalCents: 5_000,
    scopeCategory: "beauty",
  },
];

export const REVIEW_SNIPPETS: Array<{ rating: number; title: string; body: string }> = [
  { rating: 5, title: "Exactly as described", body: "Arrived quickly and the finish is better than the photographs suggest. Second one I have bought." },
  { rating: 4, title: "Very good, sizing runs large", body: "Quality is excellent. I would size down if you are between sizes — mine is roomier than expected." },
  { rating: 5, title: "Worth the money", body: "I hesitated at the price and then used it every day for three months. No regrets at all." },
  { rating: 3, title: "Good but not perfect", body: "Does the job well. The packaging was more elaborate than it needed to be, which felt at odds with the rest." },
  { rating: 5, title: "Quietly excellent", body: "Nothing flashy about it, which is why I like it. Held up to daily use without complaint." },
  { rating: 4, title: "Happy with it", body: "Took a week to arrive but the wait was fine. Would buy from this brand again." },
];
