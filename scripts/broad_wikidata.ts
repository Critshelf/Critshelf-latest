const USER_AGENT = 'CritShelfImporter/1.0 (coreykern2040@gmail.com)';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function broadBbgSearch() {
  const query = `
    SELECT ?game ?gameLabel ?bggId
    WHERE {
      ?game wdt:P1591 ?bggId.
      ?game rdfs:label ?gameLabel. FILTER(LANG(?gameLabel) = "en")
    }
    LIMIT 10
  `;
  
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json() as any;
    console.log('Sample BGG IDs from Wikidata:', JSON.stringify(data.results.bindings, null, 2));
  } catch (error: any) {
    console.error('Search failed:', error.message);
  }
}

broadBbgSearch();
