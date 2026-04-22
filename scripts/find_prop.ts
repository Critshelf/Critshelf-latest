const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function findBggProperty() {
  const query = `
    SELECT ?prop ?propLabel
    WHERE {
      ?prop wikibase:directClaim ?wdt.
      ?prop rdfs:label ?propLabel.
      FILTER(CONTAINS(LCASE(?propLabel), "boardgamegeek id"))
      FILTER(LANG(?propLabel) = "en")
    }
    LIMIT 10
  `;
  
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json() as any;
    console.log('BGG Property candidates:', JSON.stringify(data.results.bindings, null, 2));
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

findBggProperty();
