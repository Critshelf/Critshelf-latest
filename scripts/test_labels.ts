const BGG_ID = "266192";
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function testLabels() {
  const query = `
    SELECT ?label (LANG(?label) AS ?lang)
    WHERE {
      wd:Q29168925 rdfs:label ?label.
    }
  `;
  
  const url = `${WIKIDATA_SPARQL_URL}?query=${encodeURIComponent(query)}&format=json`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json() as any;
    console.log('Response data:', JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error('Test failed:', error.message);
  }
}

testLabels();
