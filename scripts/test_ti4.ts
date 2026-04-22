const BGG_ID = "233078";
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';

async function testWikidata() {
  const query = `
    SELECT ?game ?gameLabel ?bggId
    WHERE {
      ?game wdt:P2339 "${BGG_ID}".
      ?game rdfs:label ?gameLabel. FILTER(LANG(?gameLabel) = "en")
    }
    LIMIT 1
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

testWikidata();
