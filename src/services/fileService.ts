import { existsSync, writeFileSync, readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { getDateComponents } from '../utils/helpers';
import { RestaurantId, DailyMenu, FileInfo } from '../types';

export function saveProcessedMenu(restaurant: RestaurantId, data: DailyMenu[], isTranslated = false): boolean {
    const { year, month, week } = getDateComponents();
    const suffix = isTranslated ? 'translated' : 'parsed';
    const fileName = `${restaurant}_${year}_${month}_week${week}_${suffix}.json`;
    const filePath = path.join(process.cwd(), 'processed', fileName);
    
    try {
        writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`Saved ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant} to ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Error saving ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant}:`, error);
        return false;
    }
}

export function loadProcessedMenu(restaurant: RestaurantId, isTranslated = false): DailyMenu[] | null {
    const { year, month, week } = getDateComponents();
    const suffix = isTranslated ? 'translated' : 'parsed';
    const fileName = `${restaurant}_${year}_${month}_week${week}_${suffix}.json`;
    const filePath = path.join(process.cwd(), 'processed', fileName);
    
    if (!existsSync(filePath)) {
        console.log(`No saved ${isTranslated ? 'translated' : 'parsed'} menu data found for ${restaurant}`);
        return null;
    }
    
    try {
        const data = readFileSync(filePath, 'utf8');
        const parsedData = JSON.parse(data) as DailyMenu[];
        console.log(`Loaded ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant} from ${filePath}`);
        return parsedData;
    } catch (error) {
        console.error(`Error loading ${isTranslated ? 'translated' : 'parsed'} menu data for ${restaurant}:`, error);
        return null;
    }
}

export function listJsonFiles(directory: string): FileInfo[] {
    try {
        const files = readdirSync(directory);
        return files.filter(file => file.endsWith('.json'))
            .map(file => {
                const stats = statSync(path.join(directory, file));
                return {
                    name: file,
                    size: stats.size,
                    lastModified: stats.mtime
                };
            });
    } catch (error) {
        console.error(`Error listing files in ${directory}:`, error);
        throw error;
    }
}