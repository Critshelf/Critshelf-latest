const USER_AGENT = 'CritShelfImporter/1.0 (coreykern2040@gmail.com)';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function searchWikidata() {
  const query = `
    SELECT ?game ?gameLabel ?bggId
    WHERE {
      ?game rdfs:label "Brass: Birmingham"@en.
      OPTIONAL { ?game wdt:P1591 ?bggId. }
    }
    LIMIT 5
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
