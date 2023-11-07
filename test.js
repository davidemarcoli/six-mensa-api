//     "pdf.js-extract": "^0.2.1"
/*const PDFExtract = require('pdf.js-extract').PDFExtract;
const pdfExtract = new PDFExtract();
const https = require('https');*/

const { PdfDataReader } = require("pdf-data-parser");

/*function httpGet() {
  return new Promise(((resolve, reject) => {
    var options = {
        host: 'www.betriebsrestaurants-migros.ch',
        port: 443,
        //path: '/media/x4vjg4pd/menueplan_six-ht201.pdf',
        path: '/media/k5dnh0sd/landingpage_menueplan_htp.pdf',
        method: 'GET',
    };
    
    const request = https.request(options, (response) => {
      //response.setEncoding('utf8');
      const data = [];

      response.on('data', (chunk) => {
        data.push(chunk);
      });

      response.on('end', () => {
      console.log(data);
        let buffer = Buffer.concat(data);
        resolve(buffer);
      });

      response.on('error', (error) => {
        reject(error);
        //resolve(error);
      });
    });
    request.end();
  }));
}*/

/*function extractMenus(data) {
  console.log("EXTRACT DATAAA")
  console.log(data)

  let menus = {};
  let currentDay = null;

  for (let i = 0; i < data.length; i++) {
      const row = data[i];

      console.log("ROW")
      console.log(row)

      // Check if the row contains a day of the week (e.g., "Montag", "Dienstag", etc.)
      if (row[0].match(/Montag|Dienstag|Mittwoch|Donnerstag|Freitag/) && row[0].length < 10) {
          console.log("IT MATCHESSS")

          currentDay = row[0];
          console.log(data[i])
          menus[currentDay] = {
              date: data[i + 1][0],
              local: {
                  dish: row[1],
                  details: data[i + 1][1],
                  sideDishes: data[i + 2],
                  price: data[i + 3][0],
                  origin: data[i + 4] ? data[i + 4][0] : null
              },
              vegi: {
                  dish: row[2],
                  details: data[i + 1][2],
                  sideDishes: data[i + 2].slice(1),
                  price: data[i + 3][1],
                  origin: data[i + 4] ? data[i + 4][1] : null
              },
              globetrotter: row[3] ? {
                  dish: row[3],
                  details: data[i + 1][3],
                  sideDishes: data[i + 2].slice(2),
                  price: data[i + 3][2],
                  origin: data[i + 4] ? data[i + 4][2] : null
              } : null
          };
      }
  }

  return menus;
}*/

/*function extractMenus(data) {
  let menus = {};
  let currentDay = null;

  for (let i = 0; i < data.length; i++) {
      const row = data[i];

      // Check if the row contains a day of the week (e.g., "Montag", "Dienstag", etc.)
      if (row[0].match(/Montag|Dienstag|Mittwoch|Donnerstag|Freitag/) && row[0].length < 10) {
          currentDay = row[0];
          menus[currentDay] = {
              date: data[i + 1][0],
              local: {
                  dish: row[1],
                  details: data[i + 1][1],
                  sideDishes: []
              },
              vegi: {
                  dish: row[2],
                  details: data[i + 1][2],
                  sideDishes: []
              },
              globetrotter: row[3] ? {
                  dish: row[3],
                  details: data[i + 1][3] || null,
                  sideDishes: []
              } : null
          };

          // Collect side dishes until we hit a price or another day
          let j = i + 2;
          while (!data[j][0].match(/Intern|Montag|Dienstag|Mittwoch|Donnerstag|Freitag/) && j < data.length) {
              menus[currentDay].local.sideDishes.push(data[j][0]);
              menus[currentDay].vegi.sideDishes.push(data[j][1]);
              if (menus[currentDay].globetrotter) {
                  menus[currentDay].globetrotter.sideDishes.push(data[j][2] || null);
              }
              j++;
          }

          // Assuming the next row after side dishes contains the prices
          menus[currentDay].local.price = data[j][0];
          menus[currentDay].vegi.price = data[j][1];
          if (menus[currentDay].globetrotter) {
              menus[currentDay].globetrotter.price = data[j][2];
          }
      }
  }

  return menus;
}*/

function extractMenus(data) {
  let menus = {};
  let currentDay = null;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Check if the row contains a day of the week (e.g., "Montag", "Dienstag", etc.)
    if (row[0].match(/Montag|Dienstag|Mittwoch|Donnerstag|Freitag/) && row[0].length < 10) {
      console.log("Row", row)
      console.log("Data", data[i + 1])
      currentDay = row[0];
      menus[currentDay] = {
        date: data[i + 1][0],
        local: {
          dish: row[1],
          details: data[i + 1][1],
          sideDishes: []
        },
        vegi: {
          dish: row[2],
          details: data[i + 1][2],
          sideDishes: []
        },
        globetrotter: (row[3] && data[i + 1].length == 4) ? {
          dish: row[3],
          details: data[i + 1][3] || null,
          sideDishes: []
        } : null,
        buffet: (row[3]) ? {
          dish: data[i + 1].length == 3 ? row[3] : row[4],
          details: data[i + 1].length == 3 ? data[i + 1][3] : data[i + 1][4] || null
        } : null
      };

      // Collect side dishes until we hit a price or another day
      let j = i + 2;
      while (!data[j][0].match(/Intern|Montag|Dienstag|Mittwoch|Donnerstag|Freitag/) && j < data.length) {
        console.log("push side dish", data[j][1])
        menus[currentDay].local.sideDishes.push(data[j][0]);
        menus[currentDay].vegi.sideDishes.push(data[j][1]);
        if (menus[currentDay].globetrotter) {
          menus[currentDay].globetrotter.sideDishes.push(data[j][2] || null);
        }
        j++;
      }

      // Assuming the next row after side dishes contains the prices
      menus[currentDay].local.price = data[j][0];
      menus[currentDay].vegi.price = data[j][1];
      if (menus[currentDay].globetrotter) {
        menus[currentDay].globetrotter.price = data[j][2];
      }
    }
  }

  return menus;
}

/*httpGet().then(data => {
console.log(data);
pdfExtract.extractBuffer(data, {})
        .then(data => {
            console.log(data);
            //console.log(data.pages[0])
            //console.log(data.pages[0].content)
            console.log(data);
            console.log(data.pages[0].content.filter(item => {
              return item.str != '' && item.str != ' ' && !item.str.includes("Intern") && !item.str.includes("Extern") && !item.str.match(/\d\.\d/g)
            }));
            console.log(data.pages[0].content.filter(item => (item.x == 118.58 && item.y == 168.62000000000006 && item.str != ''))[0].str);
            console.log(data.pages[0].content.filter(item => (item.x == 118.58 && item.y == 236.45000000000005 && item.str != ''))[0].str);
            console.log(data.pages[0].content.filter(item => (item.x == 119.06 && item.y == 307.37000000000006 && item.str != ''))[0].str);
        })
        .catch(err => {
            console.error(err);
        });
      })*/

const express = require('express')
const app = express()
const port = process.env.port || 3000;

app.get('/', (req, res) => {
  let reader = new PdfDataReader({ url: "https://www.betriebsrestaurants-migros.ch/media/k5dnh0sd/landingpage_menueplan_htp.pdf" });
var rows = [];
reader.on('data', (row) => {
  rows.push(row)
});

reader.on('end', () => {
  // do something with the rows
  console.log("ROWWSSSS")
  console.log(rows)
  const menus = extractMenus(rows);
  console.log(menus);
  res.send(menus)
});

reader.on('error', (err) => {
  // log error
})
  //res.send('Hello World!')
})


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})