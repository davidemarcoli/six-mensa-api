# SIX Mensa API

A modern TypeScript API for accessing, translating, and visualizing SIX restaurant menus.

## 🚀 Overview

SIX Mensa API extracts menu data from PDFs of two SIX restaurants (HTP and HT201), processes the data using AI, and provides a REST API for accessing the information. It supports menu translation from German to English and can even generate AI-powered food images.

## ✨ Features

- **PDF Menu Extraction** - Automatically scrapes and parses menu PDFs
- **AI-Powered Menu Processing** - Uses Google's Gemini API to extract structured data
- **Menu Translation** - Translates menus from German to English
- **Food Image Generation** - Creates realistic food images based on menu descriptions
- **Caching System** - Stores processed data to minimize API usage
- **Customizable Schedule** - Configurable auto-update intervals
- **Feature Flags** - Toggle features on/off via environment variables
- **REST API** - Simple endpoints for accessing menu data
- **TypeScript** - Fully typed codebase for better development experience

## 🏗️ Architecture

```
├── config/             # Application configuration
├── schemas/            # AI model schemas  
├── services/           # Core business logic
│   ├── aiService.ts    # AI processing functions
│   ├── fileService.ts  # File system operations
│   ├── imageService.ts # Image generation
│   ├── menuService.ts  # Menu data management
│   └── pdfService.ts   # PDF handling
├── routes/             # API endpoints
├── types/              # TypeScript type definitions
├── utils/              # Helper functions
└── app.ts              # Main application entry point
```

## 🛠️ Setup

### Prerequisites

- Node.js 16+ and npm/yarn
- Google Gemini API key (for menu parsing and image generation)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/davidemarcoli/six-mensa-api.git
   cd six-mensa-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your configuration (see `.env.example` for options):
   ```
   PORT=3000
   GEMINI_API_KEY=your_api_key_here
   ENABLE_IMAGE_GENERATION=false
   ```

4. Build the TypeScript code:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

## ⚙️ Configuration

The application is highly configurable using environment variables:

### Core Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `GEMINI_API_KEY` | Google Gemini API key | *Required* |

### Feature Flags
| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_IMAGE_GENERATION` | Enable AI image generation | `false` |
| `ENABLE_MENU_TRANSLATION` | Enable menu translation | `true` |
| `ENABLE_AUTO_UPDATE` | Enable scheduled updates | `true` |
| `ENABLE_PDF_SCRAPING` | Enable PDF scraping | `true` |
| `AUTO_UPDATE_INTERVAL_MINUTES` | Update interval in minutes | `60` |

### Advanced Configuration
| Variable | Description | Default |
|----------|-------------|---------|
| `REFRESH_INTERVAL` | Refresh interval in ms | `3600000` |
| `IMAGE_GENERATION_DELAY` | Delay between image requests | `20000` |
| `SIX_MENSA_BASE_URL` | Base URL for SIX website | *configured* |
| `AI_MODEL` | Gemini model for text | `gemini-2.0-flash` |
| `IMAGE_AI_MODEL` | Gemini model for images | `gemini-2.0-flash-preview-image-generation` |

## 🌐 API Endpoints

### Menu Endpoints

#### Get menu for a specific restaurant and day
```
GET /:restaurant/:weekdayIndex
```

Parameters:
- `restaurant`: Either `htp` or `ht201`
- `weekdayIndex`: Day index (0 for Monday, 1 for Tuesday, etc., or -1 for all days)

Query Parameters:
- `language`: Use `en` for English translation (default is German)

Example:
```
GET /htp/0?language=en
```

Response:
```json
{
  "day": "Monday",
  "date": "15. May",
  "menues": [
    {
      "title": "Chicken Curry",
      "description": "With jasmine rice and vegetables",
      "type": "Local",
      "dietaryType": "meat",
      "price": {
        "intern": 7.40,
        "extern": 12.40
      },
      "origin": "Meat: Switzerland",
      "allergens": ["Gluten", "Milk"],
      "imagePath": "image/a1b2c3d4"
    },
    // More menu items...
  ]
}
```

### PDF Endpoints

#### Get PDF for a specific restaurant
```
GET /pdf/:restaurant
```

#### List all available PDFs
```
GET /pdfs
```

#### Get scraped PDF links
```
GET /pdf-links
```

### Image Endpoints

#### Get image for a menu item
```
GET /image/:imageId
```

#### Generate a new image
```
POST /generate-image
```

Request body:
```json
{
  "day": "Monday",
  "menu": {
    "title": "Chicken Curry",
    "description": "With jasmine rice",
    "type": "Local",
    "dietaryType": "meat",
    "price": {
      "intern": 7.40,
      "extern": 12.40
    },
    "origin": "Meat: Switzerland",
    "allergens": ["Gluten"]
  }
}
```

### Other Endpoints

#### List processed data files
```
GET /processed
```

#### Get server status
```
GET /status
```

Response:
```json
{
  "version": "1.0.0",
  "features": {
    "imageGeneration": false,
    "menuTranslation": true,
    "autoUpdate": true,
    "pdfScraping": true,
    "updateInterval": "60 minutes"
  },
  "restaurants": ["htp", "ht201"]
}
```

## 📂 Data Storage

The application stores data in the following directories:

- `/pdfs` - Downloaded PDF files
- `/processed` - Processed and translated menu data
- `/images` - Generated food images

## 🔄 Development Workflow

1. Run in development mode with hot reloading:
   ```bash
   npm run dev
   ```

2. Lint your code:
   ```bash
   npm run lint
   ```

3. Run tests:
   ```bash
   npm test
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## 🚢 Deployment

### Docker

The application includes a Dockerfile for easy containerization:

```bash
# Build the Docker image
docker build -t six-mensa-api .

# Run the container
docker run -p 3000:3000 --env-file .env six-mensa-api
```

### Environment Considerations

- For production environments, ensure you have adequate disk space for cached PDFs and images
- Consider setting `ENABLE_IMAGE_GENERATION=false` to reduce API costs
- Adjust `AUTO_UPDATE_INTERVAL_MINUTES` based on your needs

## 📚 Technical Details

### AI Processing

The API uses Google's Gemini models for:
1. Extracting structured data from PDF menus
2. Translating menu text from German to English
3. Generating realistic food images

### Performance Optimization

- PDFs are only re-processed if they've changed
- Generated images are cached to disk
- Processed menu data is stored as JSON files

## 📄 License

[MIT License](LICENSE)

## 🙏 Acknowledgements

- [Google Gemini API](https://ai.google.dev/) for AI functionality
- [Express](https://expressjs.com/) for the web server framework
- [TypeScript](https://www.typescriptlang.org/) for type safety