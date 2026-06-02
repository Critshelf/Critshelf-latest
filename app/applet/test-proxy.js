fetch('http://localhost:3000/api/bgg/search?query=Catan').then(async r => {
  const text = await r.text();
  console.log("Status:", r.status);
  console.log("Response:", text.slice(0, 100));
}).catch(console.error);
