import { createImageId } from '../services/imageService';
import { DailyMenu } from '../types';

export function addImagePaths(menuData: DailyMenu[]): DailyMenu[] {
    return menuData.map(menu => {
        menu.menues = menu.menues.map(menuItem => {
            menuItem.imagePath = "image/" + createImageId(menuItem.title, menuItem.description);
            return menuItem;
        });
        return menu;
    });
}