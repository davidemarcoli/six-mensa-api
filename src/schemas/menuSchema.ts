import { Schema, Type } from "@google/genai";
import { MenuItem, DailyMenu } from '../types';

export const menuItemSchema: Schema = {
    type: Type.OBJECT,
    description: "Information about a menu",
    properties: {
        title: {
            type: Type.STRING,
            description: "The title of the menu"
        },
        description: {
            type: Type.STRING,
            description: "The description of the menu"
        },
        type: {
            type: Type.STRING,
            description: "The type of the menu (e.g. Local, Vegi, Globetrotter, Buffet, Global, Pizza & Pasta)",
            example: ["Local", "Vegi", "Globetrotter", "Buffet", "Global", "Pizza & Pasta"]
        },
        dietaryType: {
            type: Type.STRING,
            description: "Indicates if the menu is meat-based, vegetarian, or vegan",
            enum: ["meat", "vegetarian", "vegan"],
            example: "meat"
        },
        price: {
            type: Type.OBJECT,
            description: "The price of the menu",
            properties: {
                intern: {
                    type: Type.NUMBER,
                    description: "The price for employees",
                    example: 7.40
                },
                extern: {
                    type: Type.NUMBER,
                    description: "The price for guests",
                    example: 12.40
                }
            },
            required: ["intern", "extern"]
        },
        origin: {
            type: Type.STRING,
            description: "The origin of the menu",
            example: ["Fleisch: Schwein; Schweiz", "Fleisch: Schweiz", "Fisch: Norwegen"],
        },
        allergens: {
            type: Type.ARRAY,
            items: {
                type: Type.STRING,
                description: "The allergens present in the menu",
                example: ["Gluten", "Fisch", "Sesam"]
            }
        }
    },
    required: ["title", "description", "type", "dietaryType", "price", "origin", "allergens"]
};

export const menuSchema: Schema = {
    type: Type.ARRAY,
    description: "Array of daily menus, with exactly one object per day",
    items: {
        type: Type.OBJECT,
        description: "All the menus of a specific day (only if there is at least one menu)",
        properties: {
            day: {
                type: Type.STRING,
                example: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"],
                description: "The day of the week"
            },
            date: {
                type: Type.STRING,
                description: "The date of the menu",
                example: ["14. April", "15. September"]
            },
            menues: {
                type: Type.ARRAY,
                items: menuItemSchema,
                description: "Array of menues available for that day",
            }
        },
        required: ["day", "date", "menues"]
    }
};