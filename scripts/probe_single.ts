
const WIKIDATA_SPARQL_URL = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

async function probe(bggId) {
  const query = `
    PREFIX wdt: <http://www.wikidata.org/prop/direct/>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?game ?label WHERE {
      ?game wdt:P2339 "${bggId}".
      OPTIONAL { ?game rdfs:label ?label . FILTER(LANG(?label) = "en") }
    }
  `;
  const body = new URLSearchParams();
  body.append('query', query);
  body.append('format', 'json');
  
  const resp = await fetch(WIKIDATA_SPARQL_URL, {
    method: 'POST',
    headers: { 
      'User-Agent': USER_AGENT,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json'
    },
    body: body.toString()
  });
  const data = await resp.json();
  console.log(`ID ${bggId}: Found ${data.results.bindings.length} results.`);
  if (data.results.bindings.length > 0) {
    console.log('Result:', data.results.bindings[0].game.value);
  }
}

probe("161297"); // Lisboa
