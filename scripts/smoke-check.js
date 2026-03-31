const assert = require('node:assert/strict');

const { createApp } = require('../backend/app');

async function startServer() {
  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => resolve(server));
    server.on('error', reject);
  });
}

async function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function getJson(baseUrl, path) {
  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(`Smoke request failed for ${path}: ${response.status} ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function main() {
  const server = await startServer();

  try {
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const health = await getJson(baseUrl, '/healthz');
    assert.equal(health.status, 'ok');

    const dashboard = await getJson(baseUrl, '/api/dashboard/stats');
    assert.equal(typeof dashboard.summary.total_patients, 'number');

    const patients = await getJson(baseUrl, '/api/patients');
    assert.ok(Array.isArray(patients.patients));

    if (patients.patients.length > 0) {
      const firstPatientId = patients.patients[0].id;

      const detail = await getJson(baseUrl, `/api/patients/${firstPatientId}`);
      assert.equal(detail.patient.id, firstPatientId);

      const validation = await getJson(baseUrl, `/api/validation/${firstPatientId}`);
      assert.equal(validation.patient_id, firstPatientId);

      const bundle = await getJson(baseUrl, `/api/fhir/${firstPatientId}`);
      assert.equal(bundle.resourceType, 'Bundle');
    }

    console.log('Smoke check passed.');
  } finally {
    await stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});