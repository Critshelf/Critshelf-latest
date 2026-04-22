const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function checkBrass() {
  const query = `
    SELECT ?prop ?propLabel ?val
    WHERE {
      wd:Q108033998 ?p ?val.
      ?prop wikibase:directClaim ?p.
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      FILTER(CONTAINS(LCASE(?propLabel), "boardgamegeek id"))
    }
  `;
  
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json() as any;
    console.log('Brass IDs:', JSON.stringify(data.results.bindings, null, 2));
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

checkBrass();
