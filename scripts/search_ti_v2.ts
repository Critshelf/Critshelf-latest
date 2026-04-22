const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function searchWikidata() {
  const query = `
    SELECT ?game ?gameLabel ?bggId ?idProperty
    WHERE {
      ?game rdfs:label ?gameLabel.
      FILTER(CONTAINS(LCASE(?gameLabel), "twilight imperium"))
      FILTER(LANG(?gameLabel) = "en")
      
      OPTIONAL { 
        ?game ?idProperty ?bggId.
        FILTER(?idProperty IN (wdt:P2339, wdt:P1591))
      }
    }
    LIMIT 10
  `;
  
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json() as any;
    console.log('Search results:', JSON.stringify(data.results.bindings, null, 2));
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

searchWikidata();
