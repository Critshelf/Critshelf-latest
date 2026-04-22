async function trigger() {
  console.log('Triggering seeding...');
  const seedRes = await fetch('http://localhost:3000/api/admin/seed', { method: 'POST' });
  const seedData = await seedRes.json();
  console.log('Seeding result:', seedData);

  if (seedData.status === 'success') {
    console.log('Triggering enrichment...');
    const enrichRes = await fetch('http://localhost:3000/api/admin/enrich', { method: 'POST' });
    const enrichData = await enrichRes.json();
    console.log('Enrichment result:', enrichData);
  }
}

trigger().catch(console.error);
