async function check() {
  const res = await fetch('https://darse-burhani.onrender.com/api/hikvision/events');
  const data = await res.json();
  console.log('Status:', data.status);
  console.log('Total Received Events on Render:', data.stats?.received);
  console.log('Last Event At:', data.stats?.lastAt);
  if (data.stats?.log && data.stats.log.length > 0) {
    console.log('Latest 3 Events:');
    data.stats.log.slice(0, 3).forEach(e => {
      console.log(` - [${e.time}] ID: "${e.employeeNoString}" | Outcome: ${e.outcome} | Msg: ${e.message}`);
    });
  }
}

check().then(() => process.exit(0)).catch(e => { console.error('Check error:', e.message); process.exit(1); });
