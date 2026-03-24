export interface MenuItem {
  title: string;
  description: string;
  type: string;
  dietaryType: 'meat' | 'vegetarian' | 'vegan';
  price: {
    intern: number;
    extern: number;
  };
  origin: string;
  allergens: string[];
  imagePath?: string;
}

export interface DailyMenu {
  day: string;
  date: string;
  menues: MenuItem[];
}

export interface RestaurantData {
  htp: DailyMenu[];
  ht201: DailyMenu[];
}

export interface MenuImage {
  path: string;
  mimeType: string;
  menuTitle: string;
  menuType: string;
  day?: string;
}

export interface MenuImagesMap {
  [key: string]: MenuImage;
}

export interface GenerateImageResult {
  id: string;
  path: string;
  exists?: boolean;
  generated?: boolean;
}

export type RestaurantId = 'htp' | 'ht201';

export interface DateComponents {
  year: number;
  month: string;
  week: number;
}

export interface PdfLinks {
  [key: string]: string;
}

export interface FileInfo {
  name: string;
  size: number;
  lastModified: Date;
  url?: string;
}