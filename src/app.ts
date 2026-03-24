import express from 'express';
import { config } from './config/constants';
import { initializeDirectories } from './utils/helpers';
import { loadExistingImages } from './services/imageService';
import { updateMenus } from './services/menuService';

// Import route handlers
import menuRoutes from './routes/menuRoutes';
import pdfRoutes from './routes/pdfRoutes';
import imageRoutes from './routes/imageRoutes';
import dataRoutes from './routes/dataRoutes';
import statusRoutes from './routes/statusRoutes';

const app = express();

// Initialize the application
async function initialize() {
    console.log('Initializing application...');
    
    // Create required directories
    initializeDirectories();
    
    // Load existing images if image generation is enabled
    if (config.ENABLE_IMAGE_GENERATION) {
        loadExistingImages();
    }
    
    // Update menus to check for new data
    await updateMenus();
    
    // Set up periodic updates if enabled
    if (config.ENABLE_AUTO_UPDATE) {
        const updateIntervalMs = config.AUTO_UPDATE_INTERVAL_MINUTES * 60 * 1000;
        console.log(`Auto-update enabled: will update menus every ${config.AUTO_UPDATE_INTERVAL_MINUTES} minutes`);
        setInterval(updateMenus, updateIntervalMs);
    } else {
        console.log('Auto-update disabled via ENABLE_AUTO_UPDATE=false');
    }
}

// Middleware
app.use(express.json());

// Routes — data/pdf/image/status routes BEFORE menu routes (menu uses /:restaurant/:weekday wildcard)
app.use('/', dataRoutes);
app.use('/', pdfRoutes);
app.use('/', imageRoutes);
app.use('/', statusRoutes);
app.use('/', menuRoutes);

// Start server
app.listen(config.PORT, () => {
    console.log(`SIX Mensa API listening on port ${config.PORT}`);
    
    // Log feature status
    console.log('Feature flags:');
    console.log(`- Image Generation: ${config.ENABLE_IMAGE_GENERATION ? 'Enabled' : 'Disabled'}`);
    console.log(`- Menu Translation: ${config.ENABLE_MENU_TRANSLATION ? 'Enabled' : 'Disabled'}`);
    console.log(`- Auto Update: ${config.ENABLE_AUTO_UPDATE ? 'Enabled' : 'Disabled'}`);
    console.log(`- PDF Scraping: ${config.ENABLE_PDF_SCRAPING ? 'Enabled' : 'Disabled'}`);
    console.log(`- Menu Processor: ${config.MENU_PROCESSOR}`);
});

// Initialize the application
initialize()
    .catch(err => {
        console.error('Error during initialization:', err);
        process.exit(1);
    });