import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DateComponents, RestaurantId } from '../types';

// Make sure all required directories exist
export function initializeDirectories(): void {
    const directories = [
        path.join(process.cwd(), 'images'),
        path.join(process.cwd(), 'pdfs'),
        path.join(process.cwd(), 'processed')
    ];

    directories.forEach(dir => {
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    });
}

// Utility to get current date-based filename components
export function getDateComponents(): DateComponents {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const week = Math.ceil(date.getDate() / 7);
    
    return { year, month, week };
}

// Validate restaurant parameter
export function validateRestaurant(restaurant: string): RestaurantId {
    if (!['htp', 'ht201'].includes(restaurant)) {
        throw new Error('Invalid restaurant');
    }
    return restaurant as RestaurantId;
}