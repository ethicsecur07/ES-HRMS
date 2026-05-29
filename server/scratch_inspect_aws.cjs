async function run() {
  console.log('Fetching external applicants...');
  try {
    const res = await fetch('https://qcyokzjqdb.execute-api.ap-south-1.amazonaws.com/prod/api/applicants');
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();
    console.log('AWS applicants data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
}

run();
