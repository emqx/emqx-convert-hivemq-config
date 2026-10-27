import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../dist/http-handler.js';
const request = (path, options) =>
  handleRequest(new Request(`http://localhost${path}`, options));
const post = (body, type = 'application/json') =>
  request('/convert', {
    method: 'POST',
    headers: { 'Content-Type': type },
    body,
  });
const xml =
  '<hivemq><mqtt><topic-alias><max-per-client>17</max-per-client></topic-alias></mqtt></hivemq>';

test('UI is self-contained and its browser script compiles', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /HiveMQ → EMQX/);
  assert.match(html, /Download .hocon/);
  assert.doesNotMatch(html, /<script src=/);
  assert.ok(
    response.headers
      .get('Content-Security-Policy')
      .includes("frame-ancestors 'none'")
  );
  assert.doesNotThrow(
    () => new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1])
  );
});

test('JSON, XML, text, multipart and legacy form payloads produce the same output', async () => {
  const form = new FormData();
  form.set('file', new File([xml], 'config.xml', { type: 'application/xml' }));
  const responses = await Promise.all([
    post(JSON.stringify({ config: xml })),
    post(JSON.stringify({ xml_content: xml })),
    post(xml, 'application/xml'),
    post(xml, 'text/xml'),
    post(xml, 'text/plain'),
    request('/convert', { method: 'POST', body: form }),
    request('/convert', {
      method: 'POST',
      body: new URLSearchParams({ xml_content: xml }),
    }),
  ]);
  const outputs = [];
  for (const response of responses) {
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(Array.isArray(result.warnings));
    outputs.push(result.hocon);
  }
  assert.ok(outputs.every((output) => output === outputs[0]));
});

test('malformed input is rejected with meaningful statuses', async () => {
  for (const body of [
    '{',
    'null',
    '[]',
    '{}',
    '{"config":42}',
    '{"config":""}',
    '{"config":"<hivemq>"}',
  ])
    assert.equal((await post(body)).status, 400, body);
  assert.equal((await post(xml, 'application/octet-stream')).status, 415);
  assert.equal((await post(xml, 'application/json-invalid')).status, 415);
  assert.equal((await request('/missing')).status, 404);
  assert.equal((await request('/convert')).status, 405);
  const options = await request('/convert', { method: 'OPTIONS' });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get('Access-Control-Allow-Origin'), null);
});

test('declared and actual oversized input is rejected', async () => {
  assert.equal(
    (await post('x'.repeat(1024 * 1024 + 1), 'text/plain')).status,
    413
  );
  assert.equal(
    (
      await request('/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': '9999999',
        },
        body: xml,
      })
    ).status,
    413
  );
});

test('HTTP cannot read external entities or local certificate files', async () => {
  const response = await post(
    '<!DOCTYPE hivemq [<!ENTITY test SYSTEM "file:///etc/passwd">]><hivemq>&test;</hivemq>',
    'application/xml'
  );
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /DTD/);
});
