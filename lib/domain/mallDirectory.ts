// Elmina Lakeside Mall's directory (feedback round 2, spec §5): the 99 shops and units on Sime Darby Property's own page
// as of 18 Oct 2026 (the page loads more on demand, so a few may be missing), with our categories, and where each unit
// is on SDP's official layout plan (public/malls/elmina-lakeside-mall-plan.webp). The mall is one level, so one plan.

export const SHOP_CATEGORIES = ['food', 'groceries', 'fashion', 'beauty', 'home', 'kids', 'sports', 'services'] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];
export type Shop = { name: string; units: string[]; category: ShopCategory };
/** A spot on the plan, in its pixels from the top left. */
export type Point = readonly [x: number, y: number];

export const PLAN = { src: '/malls/elmina-lakeside-mall-plan.webp', width: 3000, height: 1769 } as const;

const shop = (name: string, units: string, category: ShopCategory): Shop => ({ name, units: units.split(' '), category });

export const ELMINA_SHOPS: readonly Shop[] = [
  shop('Jaya Grocer', 'GF-29', 'groceries'),
  shop('Creative Lab', 'GF-90 GF-91 GF-92', 'kids'),
  shop('Harvey Norman', 'GF-88 GF-89', 'home'),
  shop('Meija', 'GF-55', 'fashion'),
  shop('Mr D.I.Y.', 'GF-25', 'home'),
  shop("D'Special Day", 'GF-51', 'services'),
  shop('Happy Fish', 'GF-57', 'kids'),
  shop('Pets Wonderland', 'GF-41 GF-42', 'services'),
  shop('The Bike Artisans', 'GF-81', 'sports'),
  shop('Aula', 'GF-46', 'fashion'),
  shop('Bayu Somerset', 'GF-66', 'fashion'),
  shop('F.O.S.', 'GF-56', 'fashion'),
  shop('Icahfa', 'GF-67A', 'fashion'),
  shop('Matase Sutera', 'GF-45', 'fashion'),
  shop('Onura Atelier', 'GF-67B', 'fashion'),
  shop('Siti Khadijah', 'GF-02', 'fashion'),
  shop('Sorella', 'GF-53', 'fashion'),
  shop('Teera Bellesa', 'GF-63', 'fashion'),
  shop('Ali, Muthu & Ah Hock', 'GF-43A', 'food'),
  shop('Annie1', 'GF-07', 'food'),
  shop('BHC Chicken', 'GF-69', 'food'),
  shop('Boost Juice Bars', 'GK-01', 'food'),
  shop('Buah', 'GF-22', 'food'),
  shop('Bukuh Express', 'GF-37 GF-38', 'food'),
  shop('Burger King', 'DT-02', 'food'),
  shop('Chagee', 'GF-85', 'food'),
  shop('ChaTraMue', 'GF-16', 'food'),
  shop('Chica Bonita', 'GF-79', 'food'),
  shop("McDonald's", 'GK-02', 'food'),
  shop('Mr Muruku', 'GK-03', 'food'),
  shop("D'Aroma Sajian", 'GF-70', 'food'),
  shop("Diana's Premium Cakes", 'GF-32', 'food'),
  shop('Dolly Dim Sum', 'GF-68', 'food'),
  shop('Famous Amos', 'GK-03A', 'food'),
  shop('Fifbites', 'GK-08', 'food'),
  shop('Fish & Co.', 'GF-71', 'food'),
  shop("Gula Petite x Arieni's Roti Jala", 'GF-65', 'food'),
  shop('Potato Corner', 'GF-30', 'food'),
  shop('Hot & Roll', 'GF-33', 'food'),
  shop('Inari Express', 'GK-09', 'food'),
  shop('Inside Scoop', 'GF-13A', 'food'),
  shop('Serai', 'GF-75', 'food'),
  shop('Kenangan Coffee (coming soon)', 'GK-10', 'food'),
  shop('Kenny Hills Bakers', 'GF-77 GF-78', 'food'),
  shop('Koffie Macroy', 'GF-43', 'food'),
  shop('Krispy Kreme', 'GF-31', 'food'),
  shop('Lavender', 'GF-18 GF-19', 'food'),
  shop('llaollao', 'GF-23', 'food'),
  shop('Mee Hiris China Muslim', 'GF-08', 'food'),
  shop('Nak Nak', 'DT-03', 'food'),
  shop('Nyonya Colors', 'GF-53A', 'food'),
  shop('Ole-Ole Bali', 'GF-80', 'food'),
  shop('ParaThai', 'GF-73', 'food'),
  shop('Rollti', 'GK-03 GK-03A', 'food'),
  shop('Rotiboy', 'GF-33A', 'food'),
  shop('Subway', 'GF-21', 'food'),
  shop('Super Saigon', 'GF-73A', 'food'),
  shop('Sushi Zanmai', 'GF-82 GF-83', 'food'),
  shop('Taffy Gelato', 'GK-11', 'food'),
  shop('Tealive', 'GF-17', 'food'),
  shop('The Coffee Bean & Tea Leaf', 'GF-20', 'food'),
  shop('Tutti Fruitti', 'GF-39', 'food'),
  shop('ZUS Coffee', 'GF-95 GF-96', 'food'),
  shop('CASE', 'GF-27', 'home'),
  shop('Gadget C Store', 'GF-11', 'home'),
  shop('Machines', 'GF-01', 'home'),
  shop('7-Eleven', 'GF-83A', 'groceries'),
  shop('Big Eye', 'GF-93 GF-93A', 'services'),
  shop('myNews', 'GF-06', 'groceries'),
  shop('Swift Bike', 'GF-35 GF-36', 'sports'),
  shop('Typical Lux & Bag Services', 'GF-13', 'services'),
  shop('Wax Zone (coming soon)', 'P-01', 'beauty'),
  shop('Skechers', 'GF-86', 'fashion'),
  shop('A-Look', 'GF-05', 'beauty'),
  shop("Jac's Optometry", 'GF-50', 'beauty'),
  shop('The BabyLoft', 'GF-67', 'kids'),
  shop('Toys "R" Us', 'GF-58 GF-59', 'kids'),
  shop('Twigs Bookshop', 'GF-63A', 'kids'),
  shop('Caring Pharmacy', 'GF-52', 'beauty'),
  shop('Velvet Vanity', 'GF-15', 'beauty'),
  shop('NIMROC', 'GF-12', 'fashion'),
  shop('Thai Odyssey', 'GF-23A', 'beauty'),
  shop('Watsons', 'GF-03 GF-03A', 'beauty'),
  shop('Gong Cha', 'GK-07', 'food'),
  shop('The Perfume Factory', 'GF-60 GF-61', 'beauty'),
  shop('TiQaco', 'GF-09 GF-10', 'fashion'),
  shop('LG PuriCare', 'GF-26', 'home'),
  shop('Anytime Fitness', 'GF-87A', 'sports'),
  shop('Littlefoot (indoor playground)', 'GF-87B', 'kids'),
  shop('Penang Chendul', 'GK-05 GK-06', 'food'),
  shop('W Gallery', 'GF-62', 'home'),
  shop('18 Lab by KLGCC (sales gallery)', 'SALES', 'services'),
  shop('Al-Ikhsan Sports', 'GF-47 GF-48 GF-49', 'sports'),
  shop('Ediya Coffee', 'DT-01', 'food'),
  shop('Ohcha Matcha', 'GF-39A', 'food'),
  shop('Banglo 289', 'GF-76', 'food'),
  shop('Decathlon', 'GF-97', 'sports'),
  shop("Nando's", 'GF-72', 'food'),
  shop('The Nail Place', 'GF-28', 'beauty'),
];

// Unit centres, read off the plan (to within a unit's width).
export const UNIT_PINS: Readonly<Record<string, Point>> = {
  'GF-87A': [404, 392], 'GF-87B': [404, 470], 'P-01': [826, 422], 'DT-01': [1104, 416], 'DT-02': [1290, 416],
  'DT-03': [1514, 416], 'GF-97': [510, 626], 'GF-95': [510, 720], SALES: [444, 1104], 'GF-81': [804, 960],
  'GF-82': [964, 954], 'GF-83A': [1130, 952], 'GF-85': [1194, 952], 'GF-86': [1280, 952], 'GF-80': [828, 1298],
  'GF-79': [904, 1298], 'GF-77': [1050, 1290], 'GF-76': [1172, 1286], 'GF-75': [1250, 1286], 'GF-73A': [1348, 1290],
  'GF-73': [1398, 1290], 'GF-72': [1444, 1290], 'GF-71': [1494, 1290], 'GF-70': [1548, 1290], 'GF-69': [1604, 1290],
  'GF-68': [1716, 1268], 'GF-67B': [1796, 1254], 'GF-67A': [1852, 1246], 'GF-67': [1906, 1240], 'GF-66': [1978, 1234],
  'GF-65': [2074, 1214], 'GF-63A': [2142, 1172], 'GF-63': [2126, 1098], 'GF-62': [2156, 1086], 'GF-60': [2190, 1080],
  'GF-58': [2236, 1126], 'GF-57': [2372, 1082], 'GF-01': [1462, 996], 'GF-02': [1462, 1060], 'GF-03': [1536, 996],
  'GF-05': [1594, 1074], 'GF-06': [1674, 972], 'GF-07': [1680, 1032], 'GF-08': [1736, 974], 'GF-09': [1784, 1018],
  'GF-11': [1794, 982], 'GF-12': [1796, 952], 'GF-13': [1806, 912], 'GF-13A': [1764, 904], 'GF-15': [1806, 888],
  'GF-16': [1806, 864], 'GF-17': [1764, 848], 'GF-18': [1778, 796], 'GF-20': [1778, 692], 'GF-21': [1778, 646],
  'GF-22': [1778, 616], 'GF-23': [1778, 580], 'GF-23A': [1778, 526], 'GF-25': [1814, 422], 'GF-26': [1916, 540],
  'GF-27': [1916, 568], 'GF-28': [1916, 596], 'GF-29': [2030, 490], 'GF-30': [2036, 656], 'GF-31': [2064, 656],
  'GF-32': [2092, 656], 'GF-33': [2120, 656], 'GF-33A': [2148, 656], 'GF-35': [2202, 600], 'GF-37': [2202, 652],
  'GF-39': [2202, 776], 'GF-39A': [2156, 780], 'GF-41': [2202, 814], 'GF-43': [2202, 904], 'GF-43A': [2180, 964],
  'GF-45': [2092, 992], 'GF-46': [2064, 992], 'GF-47': [2008, 992], 'GF-50': [1924, 1012], 'GF-51': [1924, 974],
  'GF-52': [1956, 928], 'GF-53': [1944, 870], 'GF-53A': [1926, 806], 'GF-55': [1990, 806], 'GF-56': [2060, 822],
  'GF-88': [2510, 838], 'GF-90': [2330, 942], 'GF-93': [2330, 1000], 'GK-01': [1988, 716], 'GK-02': [2016, 716],
  'GK-03': [2044, 716], 'GK-03A': [2072, 716], 'GK-05': [2174, 714], 'GK-07': [1914, 1068], 'GK-08': [1914, 1090],
  'GK-09': [1914, 1114], 'GK-10': [1702, 1126], 'GK-11': [1502, 1162],
};

export type FacilityKind = 'toilet' | 'surau' | 'atm' | 'nursing' | 'playground' | 'info';
export const FACILITIES: readonly { kind: FacilityKind; icon: string; points: Point[] }[] = [
  { kind: 'toilet', icon: '🚻', points: [[2032, 916], [2068, 916], [746, 1242], [746, 1300]] },
  { kind: 'surau', icon: '🕌', points: [[2160, 882]] },
  { kind: 'atm', icon: '🏧', points: [[2132, 976]] },
  { kind: 'nursing', icon: '🍼', points: [[2104, 916]] },
  { kind: 'playground', icon: '🛝', points: [[2000, 1096]] },
  { kind: 'info', icon: 'ℹ️', points: [[1378, 1200]] },
];

/** Shops whose name or unit contains the search, in one category or all, A to Z. */
export function searchShops(shops: readonly Shop[], query: string, category: ShopCategory | 'all'): Shop[] {
  const q = query.trim().toLowerCase();
  return shops
    .filter((s) => category === 'all' || s.category === category)
    .filter((s) => q === '' || s.name.toLowerCase().includes(q) || s.units.some((u) => u.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Where a shop is: the first of its units that is on the plan. */
export function shopPin(shop: Shop): Point | null {
  for (const unit of shop.units) if (UNIT_PINS[unit]) return UNIT_PINS[unit];
  return null;
}
