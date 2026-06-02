fetch('https://boardgamegeek.com/xmlapi2/search?query=Catan&type=boardgame,boardgameexpansion&exact=1', { headers: { 'User-Agent': 'Critshelf/1.0', 'Accept': 'text/xml'} }).then(async r => {
  console.log("Status:", r.status);
  console.log("Response:", await r.text());
}).catch(console.error);
