# SIX Mensa API Documentation

## Overview

The SIX Mensa API is designed to extract weekly menus from provided PDF links for two different restaurants: HTP and HT201. It parses the PDF documents to retrieve menu information and then serves this data over a simple HTTP API. This API is built using Node.js and Express and can be deployed to a server with HTTPS enabled.

## Features

- Parses PDF menus from two specified URLs.
- Filters menus based on the weekday.
- Cleans and formats the menu data for easy consumption.
- Supports querying for specific weekdays.

## Prerequisites

Before you can run the API server, you need to have Node.js and npm (Node Package Manager) installed on your machine. Additionally, you need to install the necessary npm packages:

- `express` for creating the server
- `https` for making HTTPS requests
- `pdf-parse` for parsing PDF files

To install the dependencies, run the following command in the root directory of your project:

```sh
npm install
```

## Usage

1. Start the server by running the JavaScript file. For example, if your file is named `server.js`:

   ```sh
   node server.js
   ```

2. The server listens on port 3000 by default but can be configured to listen on any port by setting the `process.env.port` variable.

3. To retrieve the menu for a specific day from the HTP restaurant, make a GET request to:

   ```
   http://<your-server-address>:3000/htp/:weekdayIndex
   ```

   Replace `:weekdayIndex` with a number where 0 corresponds to Monday, 1 to Tuesday, and so on until 6 for Sunday.

4. Similarly, to retrieve the menu for a specific day from the HT201 restaurant, make a GET request to:

   ```
   http://<your-server-address>:3000/ht201/:weekdayIndex
   ```

## API Endpoints

- `GET /htp/:weekdayIndex`: Fetches the menu for a given weekday from the HTP restaurant.
- `GET /ht201/:weekdayIndex`: Fetches the menu for a given weekday from the HT201 restaurant.

## Response Format

The response will be in JSON format, containing the menu for the requested day. For example:

```json
{
  "day": "Montag",
  "Local": "Menu description",
  "Vegi": "Menu description",
  "Globetrotter": "Menu description",
  "Buffet": "Menu description"
}
```

## Known Limitations

- The API currently only parses menus that follow a specific format in the PDF. Changes in the PDF format may require changes to the parsing logic.
- The API assumes that the provided PDF URLs are accessible and that the PDF documents conform to a structure that can be parsed by the `pdf-parse` library.

## Development and Testing

- Ensure that you have sample PDFs that match the expected format for local testing.
- You can use Postman or any other API testing tool to test the API endpoints.

## Deployment

- For production use, it is recommended to configure HTTPS with SSL certificates to ensure secure data transmission. Uncomment the relevant lines and provide the correct paths to your SSL certificate and private key.

## Contributing

If you would like to contribute to the development of this API, please follow the standard GitHub pull request process:

- Fork the repository.
- Create a new branch for your feature or fix.
- Commit your changes with descriptive messages.
- Push your branch and create a pull request against the main branch of the original repository.

## Support

For support, please open an issue in the GitHub repository or contact the repository owner.