const parseBoolEnv = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
};

const parseIntEnv = (value: string | undefined, defaultValue: number): number => {
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

export const config = {
    SIX_MENSA_BASE_URL: process.env.SIX_MENSA_BASE_URL || "https://www.betriebsrestaurants-migros.ch",
    IMAGE_GENERATION_DELAY: parseIntEnv(process.env.IMAGE_GENERATION_DELAY, 20000), // Default: 20 seconds
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    AI_MODEL: process.env.AI_MODEL || "gemini-2.0-flash",
    IMAGE_AI_MODEL: process.env.IMAGE_AI_MODEL || "gemini-2.0-flash-preview-image-generation",
    PORT: parseIntEnv(process.env.PORT, 3000),
    RESTAURANTS: ['htp', 'ht201'] as const,
    
    // Feature flags
    ENABLE_IMAGE_GENERATION: parseBoolEnv(process.env.ENABLE_IMAGE_GENERATION, false),
    ENABLE_MENU_TRANSLATION: parseBoolEnv(process.env.ENABLE_MENU_TRANSLATION, true),
    ENABLE_AUTO_UPDATE: parseBoolEnv(process.env.ENABLE_AUTO_UPDATE, true),
    AUTO_UPDATE_INTERVAL_MINUTES: parseIntEnv(process.env.AUTO_UPDATE_INTERVAL_MINUTES, 60),
    ENABLE_PDF_SCRAPING: parseBoolEnv(process.env.ENABLE_PDF_SCRAPING, true),
};