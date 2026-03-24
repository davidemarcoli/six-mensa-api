import express, { Request, Response } from 'express';
import { listJsonFiles } from '../services/fileService';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';
import { DailyMenu, RestaurantId } from '../types';

const router = express.Router();

interface HistoryEntry {
    restaurant: string;
    year: number;
    month: number;
    week: number;
    data: DailyMenu[];
}

function parseFileName(name: string): { restaurant: string; year: number; month: number; week: number; type: string } | null {
    const match = name.match(/^(htp|ht201)_(\d{4})_(\d{2})_week(\d+)_(translated|parsed)\.json$/);
    if (!match) return null;
    return {
        restaurant: match[1],
        year: parseInt(match[2]),
        month: parseInt(match[3]),
        week: parseInt(match[4]),
        type: match[5],
    };
}

function loadHistoryData(restaurantFilter?: string, from?: string, to?: string): HistoryEntry[] {
    const processedDir = path.join(process.cwd(), 'processed');
    let files: string[];

    try {
        files = readdirSync(processedDir).filter(f => f.endsWith('.json'));
    } catch {
        return [];
    }

    // Group files by base name (prefer translated over parsed)
    const fileMap = new Map<string, string>();
    for (const file of files) {
        const parsed = parseFileName(file);
        if (!parsed) continue;

        const key = `${parsed.restaurant}_${parsed.year}_${String(parsed.month).padStart(2, '0')}_week${parsed.week}`;

        if (parsed.type === 'translated') {
            fileMap.set(key, file);
        } else if (!fileMap.has(key)) {
            fileMap.set(key, file);
        }
    }

    const results: HistoryEntry[] = [];

    for (const [, fileName] of fileMap) {
        const parsed = parseFileName(fileName);
        if (!parsed) continue;

        if (restaurantFilter && parsed.restaurant !== restaurantFilter) continue;

        // Date range filter (format: "YYYY-MM")
        if (from) {
            const fileDate = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
            if (fileDate < from) continue;
        }
        if (to) {
            const fileDate = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`;
            if (fileDate > to) continue;
        }

        try {
            const content = readFileSync(path.join(processedDir, fileName), 'utf8');
            const data = JSON.parse(content) as DailyMenu[];
            results.push({
                restaurant: parsed.restaurant,
                year: parsed.year,
                month: parsed.month,
                week: parsed.week,
                data,
            });
        } catch (error) {
            console.error(`Error reading ${fileName}:`, error);
        }
    }

    // Sort by date
    results.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.week - b.week;
    });

    return results;
}

router.get('/processed', (req: Request, res: Response) => {
    try {
        const processedDataDir = path.join(process.cwd(), 'processed');
        const jsonFiles = listJsonFiles(processedDataDir);
        res.json(jsonFiles);
    } catch (error) {
        console.error('Error listing processed data files:', error);
        res.status(500).send('Error listing processed data files');
    }
});

router.get('/history/:restaurant?', (req: Request, res: Response) => {
    const { restaurant } = req.params;
    const { from, to } = req.query;

    if (restaurant && restaurant !== 'htp' && restaurant !== 'ht201') {
        res.status(400).json({ error: 'Invalid restaurant. Use "htp" or "ht201".' });
        return;
    }

    const data = loadHistoryData(
        restaurant,
        from as string | undefined,
        to as string | undefined
    );

    res.json(data);
});

export default router;
