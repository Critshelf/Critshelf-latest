const { db, admin } = require('./test-cms.js');

async function backfillMemberIds() {
  const groupsRef = db.collection('groups');
  const snapshot = await groupsRef.get();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.memberIds && data.members) {
      console.log(`Backfilling group: ${doc.id}`);
      const memberIds = data.members.map(m => m.userId || m);
      await doc.ref.update({ memberIds });
      count++;
    }
  }
  
  console.log(`Backfilled ${count} groups.`);
}

backfillMemberIds().catch(console.error);
