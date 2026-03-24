// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');
import { DailyMenu, MenuItem, RestaurantId } from '../types';

const DAY_REGEX = /(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s*\d{1,2}\.\s*[A-Za-z\u00e4]+\s*([\s\S]*?)(?=(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|$))/g;
const PRICE_REGEX = /(?:\d+\.\d+\s*Intern|Intern\s*(\d+\.\d+))\s*\/\s*(?:\d+\.\d+\s*Extern|Extern\s*(\d+\.\d+))/g;
const ORIGIN_REGEX = /(((F|C):)|(?:Fleisch|Fisch|Meeresfrüchte|Geflügel)(?:\b|(?!\w)):?)\s*([^,\n]+)(?:,\s*([^,\n]+))?(\n(((F|C):)|(?:Fleisch|Fisch|Meeresfrüchte|Geflügel)(?:\b|(?!\w)):?)\s*([^,\n]+)(?:,\s*([^,\n]+))?)*\s*/;

const RESTAURANT_CATEGORIES: Record<RestaurantId, string[]> = {
    htp: ['Local', 'Vegi', 'Globetrotter', 'Buffet'],
    ht201: ['Local', 'Vegi', 'Global', 'Pizza & Pasta'],
};

function cleanMenu(menu: string): { title: string; description: string } | undefined {
    menu = menu.replace(/^(\d*[.,;]?\s?)+/, '').trim();

    if (!menu || menu.startsWith("Geschlossen") || menu.startsWith('Öffnungszeiten') || menu.includes('Für Fragen zu den einzelnen Gerichten')) {
        return undefined;
    }

    const splitMenu = menu.split('\n');
    const title = splitMenu[0].replace(/\s+/g, ' ').trim();
    if (!title) return undefined;

    const rest = splitMenu.splice(1).map(item => item.trim());
    const description = rest.length > 0
        ? rest.join('\n').replace(/(\r\n|\n|\r)/gm, ', ').replace(/ ,/g, ',').replace(/&,/g, '&').replace(/,\s?,/g, ',').replace(/\s+/g, ' ').trim()
        : '';

    return { title, description };
}

function inferDietaryType(category: string, title: string, description: string): 'meat' | 'vegetarian' | 'vegan' {
    const combined = `${category} ${title} ${description}`.toLowerCase();
    if (combined.includes('vegan')) return 'vegan';
    if (category.toLowerCase().includes('vegi') || category.toLowerCase().includes('veggie') || category.toLowerCase().includes('vegetar')) return 'vegetarian';
    return 'meat';
}

function extractMenuFromText(text: string, menuCategories: string[]): DailyMenu[] {
    let match;
    const menus: DailyMenu[] = [];

    // Reset regex state
    DAY_REGEX.lastIndex = 0;

    while ((match = DAY_REGEX.exec(text)) !== null) {
        const dayMenu = match[2];
        const splitItems = dayMenu.split(PRICE_REGEX);
        const items: string[] = [];
        const prices: (string | undefined)[] = [];

        for (let i = 0; i < splitItems.length; i++) {
            if (i % 3 === 0) {
                items.push(splitItems[i]);
            } else {
                prices.push(splitItems[i]);
            }
        }

        const dailyMenuItems: MenuItem[] = [];
        let itemIndex = 0;

        menuCategories.forEach((category, index) => {
            if (index === menuCategories.length - 2 && !items[index + 1] && items.length < 4) {
                return;
            }

            let item = items[itemIndex] ? items[itemIndex].trim() : '';
            let origin: string | undefined;

            if (itemIndex < items.length - 1 && ORIGIN_REGEX.test(items[itemIndex + 1])) {
                const originMatch = ORIGIN_REGEX.exec(items[itemIndex + 1]);
                origin = originMatch ? originMatch[0].trim() : undefined;
                if (origin?.startsWith('Für Fragen zu den einzelnen Gerichten')) {
                    origin = undefined;
                } else if (origin) {
                    origin = origin.replace(/(\d+[.,;]?\s?)+$/, '').trim();
                    origin = origin.replace(/([/.,;]\s?)+$/, '').trim();
                    items[itemIndex + 1] = items[itemIndex + 1].replace(ORIGIN_REGEX, '').trim();
                }
            }

            if (itemIndex < items.length - 1 && items[itemIndex + 1].match(/(\d+[.,;]?)+/)) {
                items[itemIndex + 1] = items[itemIndex + 1].replace(/(\d+[.,;]?\s?)+/, '').trim();
            }

            const cleanItem = cleanMenu(item);

            if (cleanItem) {
                const internPrice = prices[itemIndex * 2] ? parseFloat(prices[itemIndex * 2]!) : 0;
                const externPrice = prices[itemIndex * 2 + 1] ? parseFloat(prices[itemIndex * 2 + 1]!) : 0;

                dailyMenuItems.push({
                    title: cleanItem.title,
                    description: cleanItem.description,
                    type: category,
                    dietaryType: inferDietaryType(category, cleanItem.title, cleanItem.description),
                    price: { intern: internPrice, extern: externPrice },
                    origin: origin || '',
                    allergens: [],
                });
            }

            itemIndex++;
        });

        if (dailyMenuItems.length === 0) continue;

        menus.push({
            day: match[1],
            date: match[0].split("\n")[1].trim(),
            menues: dailyMenuItems,
        });
    }

    return menus;
}

export async function extractMenusFromPdfRegex(pdfContent: ArrayBuffer, restaurant: RestaurantId): Promise<DailyMenu[]> {
    const buffer = Buffer.from(pdfContent);
    const data = await pdf(buffer);
    const categories = RESTAURANT_CATEGORIES[restaurant];
    return extractMenuFromText(data.text, categories);
}
