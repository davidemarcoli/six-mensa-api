import express, { Request, Response } from 'express';
import { 
    getProcessedMenus, 
    getTranslatedMenus 
} from '../services/menuService';
import { validateRestaurant } from '../utils/helpers';

const router = express.Router();

router.get('/:restaurant/:weekdayIndex', (req: Request, res: Response) => {
    try {
        const { restaurant, weekdayIndex } = req.params;
        const { language } = req.query;

        const verifiedRestaurant = validateRestaurant(restaurant);
        const restaurantMenus = language === 'en' ? 
            getTranslatedMenus()[verifiedRestaurant] : 
            getProcessedMenus()[verifiedRestaurant];
        
        const retrievedMenus = parseInt(weekdayIndex) === -1 ? 
            restaurantMenus : 
            restaurantMenus[parseInt(weekdayIndex)];
        
        if (retrievedMenus) {
            res.json(retrievedMenus);
        } else {
            res.status(404).send('Menu not found');
        }
    } catch (error) {
        if (error instanceof Error) {
            res.status(400).send(error.message);
        } else {
            res.status(500).send('An unexpected error occurred');
        }
    }
});

export default router;