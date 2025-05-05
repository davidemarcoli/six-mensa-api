const axios = require('axios');
const cheerio = require('cheerio')

async function scrapeForPDF(url, elementsToSearch) {

    const result = {}
    const patterns = {}

    elementsToSearch.forEach(element => {
        patterns[element.name] = new RegExp(element.pattern)
    });

    try {
        const response = await axios.get(url, {
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            }
        })
        if (response.status === 200) {
            const $ = cheerio.load(response.data)
            const links = $("a")
            for (const link of links) {
                const href = $(link).attr("href")
                elementsToSearch.forEach(element => {
                    if (href && patterns[element.name].test(href)) {
                        result[element.name] = href
                    }
                })
            }
            return result
        }
    } catch (error) {
        console.error("Error occured while scraping: ", error)
    }
}

exports.scrapeForPDF = scrapeForPDF

// const baseUrl = "https://www.betriebsrestaurants-migros.ch"
// const sixMensaBaseUrl = baseUrl + "/landingpages/six/info-menuplan"

// const filePatterns = [{
//     name: "HT201",
//     pattern: "/media/[a-zA-Z0-9]+/.*menueplan.+ht201.+pdf$"
// }, {
//     name: "HTP",
//     pattern: "/media/[a-zA-Z0-9]+/.*menueplan.+htp.+pdf$"
// }]

// scrapeForPDF(sixMensaBaseUrl, filePatterns).then(result => {
//     if (result) {
//         console.log(`Found matching files: ${JSON.stringify(result)}`)
//     } else {
//         console.log("No matching file found.")
//     }
// }).catch(error => console.error("Error: ", error))