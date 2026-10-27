import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConversionService } from '../dist/conversion-service.js';
import { HOCONGenerator } from '../dist/hocon-generator.js';
import { examples } from '../dist/examples.js';

const service = new ConversionService();
const convert = (xml) => service.convertXmlToHocon(xml);
const hive = (body) => `<hivemq>${body}</hivemq>`;

test('TCP/WebSocket conversion disables unused stock endpoints', () => {
  const result = convert(
    hive(`<listeners>
    <tcp-listener><port>1883</port><bind-address>127.0.0.1</bind-address></tcp-listener>
    <websocket-listener><port>8000</port><path>/ws</path></websocket-listener>
  </listeners>`)
  );
  assert.equal(result.error, undefined);
  assert.equal(result.config.listeners.tcp.default.bind, '127.0.0.1:1883');
  assert.equal(result.config.listeners.ws.default.websocket.mqtt_path, '/ws');
  for (const type of ['ssl', 'wss', 'quic'])
    assert.equal(result.config.listeners[type].default.enable, false);
});

test('zero and false values survive XML parsing and conversion', () => {
  const result = convert(
    hive(`<mqtt>
    <queued-messages><max-queue-size>0</max-queue-size></queued-messages>
    <topic-alias><enabled>false</enabled></topic-alias>
    <quality-of-service><max-qos>0</max-qos></quality-of-service>
    <retained-messages><enabled>false</enabled></retained-messages>
    <wildcard-subscriptions><enabled>false</enabled></wildcard-subscriptions>
    <shared-subscriptions><enabled>false</enabled></shared-subscriptions>
  </mqtt>`)
  );
  assert.equal(result.error, undefined);
  assert.deepEqual(result.config.mqtt, {
    max_mqueue_len: 0,
    max_topic_alias: 0,
    max_qos_allowed: 0,
    wildcard_subscription: false,
    shared_subscription: false,
    retain_available: false,
  });
});

test('malformed XML, unsupported roots, DTDs and excessive nesting fail without output', () => {
  for (const input of [
    '',
    'not XML',
    '<hivemq>',
    '<hivemq><mqtt></hivemq>',
    '<other/>',
    '<hivemq>text</hivemq>',
    '<hivemq/><hivemq/>',
    '<!DOCTYPE hivemq [<!ENTITY x "secret">]><hivemq/>',
    hive('<a>'.repeat(150) + '</a>'.repeat(150)),
  ]) {
    const result = convert(input);
    assert.ok(result.error, input.slice(0, 100));
    assert.equal(result.hocon, '');
  }
});

test('warnings are returned and included in HOCON without leaking across calls', (t) => {
  const warn = t.mock.method(console, 'warn');
  const result = convert(
    hive(
      '<mqtt><keep-alive><allow-unlimited>false</allow-unlimited></keep-alive></mqtt><security><secret>do-not-log</secret></security>'
    )
  );
  assert.ok(result.warnings.length >= 2);
  assert.match(result.hocon, /# WARNING:/);
  assert.doesNotMatch(JSON.stringify(result), /do-not-log/);
  assert.equal(warn.mock.callCount(), 0);
  assert.deepEqual(convert('<hivemq/>').warnings, []);
});

test('TLS listeners remain disabled until PEM paths have been reviewed', () => {
  const result = convert(examples.tls.content);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.disabledListeners, ['ssl:default']);
  assert.equal(
    result.config.listeners.ssl.default.ssl_options.verify,
    'verify_peer'
  );
  assert.equal(
    result.config.listeners.ssl.default.ssl_options.fail_if_no_peer_cert,
    true
  );
  assert.match(result.hocon, /\/path\/to\/cert.pem/);
  assert.ok(result.warnings.some((w) => /PEM/.test(w.message)));
});

test('IPv6 and localhost binds work; invalid ports and addresses fail', () => {
  const listen = (host, port) =>
    hive(
      `<listeners><tcp-listener><port>${port}</port><bind-address>${host}</bind-address></tcp-listener></listeners>`
    );
  assert.equal(
    convert(listen('::1', 1883)).config.listeners.tcp.default.bind,
    '[::1]:1883'
  );
  assert.equal(
    convert(listen('localhost', 1883)).config.listeners.tcp.default.bind,
    '127.0.0.1:1883'
  );
  for (const [host, port] of [
    ['0.0.0.0', '1883bad'],
    ['0.0.0.0', 0],
    ['0.0.0.0', 65536],
    ['external.example', 1883],
  ])
    assert.ok(convert(listen(host, port)).error);
});

test('static cluster nodes are converted without requiring a non-schema enabled flag', () => {
  const result = convert(examples.cluster.content);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.config.cluster.static.seeds, ['emqx@127.0.0.1']);
  assert.ok(result.warnings.some((w) => /node names/.test(w.message)));
});

test('restrictions never leak internal metadata or obsolete limiter fields', () => {
  const result = convert(
    hive(
      '<restrictions><max-connections>100</max-connections><incoming-bandwidth-throttling>1000</incoming-bandwidth-throttling></restrictions>'
    )
  );
  assert.doesNotMatch(result.hocon, /_max_connections|bytes_rate/);
  assert.ok(result.warnings.some((w) => /bandwidth/.test(w.message)));
});

test('HOCON escapes quoted values, keys, backslashes and multiline warning comments', () => {
  const value = '"\\\n${not_a_substitution}';
  const hocon = new HOCONGenerator().generate({
    'a.b': value,
    values: [value],
    _warnings: ['first\nsecond = true'],
  });
  assert.ok(hocon.includes(`"a.b" = ${JSON.stringify(value)}`));
  assert.ok(hocon.includes(`  ${JSON.stringify(value)}\n]`));
  assert.match(hocon, /# WARNING: first\n# WARNING: second = true/);
  assert.throws(() => new HOCONGenerator().generate({ bad: NaN }), /numeric/);
});

test('standalone Kafka config preserves numeric-looking credentials and isolates mapping sources', () => {
  const xml = `<kafka-configuration><kafka-clusters><kafka-cluster><id>cluster01</id><bootstrap-servers>127.0.0.1:9092</bootstrap-servers><authentication><plain><username>0001</username><password>0000123</password></plain></authentication></kafka-cluster></kafka-clusters><kafka-to-mqtt-mappings>${['one', 'two'].map((id) => `<kafka-to-mqtt-mapping><id>${id}</id><cluster-id>cluster01</cluster-id><kafka-topics><kafka-topic>${id}</kafka-topic></kafka-topics></kafka-to-mqtt-mapping>`).join('')}</kafka-to-mqtt-mappings></kafka-configuration>`;
  const result = convert(xml);
  assert.equal(result.error, undefined);
  assert.equal(
    result.config.connectors.kafka_producer.cluster01.authentication.password,
    '0000123'
  );
  assert.match(
    result.config.rule_engine.rules['kafka-to-mqtt-mapping-two'].sql,
    /cluster01-two/
  );
  assert.doesNotMatch(
    result.config.rule_engine.rules['kafka-to-mqtt-mapping-two'].sql,
    /cluster01-one/
  );
  assert.ok(
    convert(xml.replace('<id>cluster01</id>', '<id>__proto__</id>')).error
  );
  assert.equal({}.bootstrap_hosts, undefined);
});

const inputs = readFileSync(
  new URL('./emqx-inputs.txt', import.meta.url),
  'utf8'
)
  .trim()
  .split('\n');
for (const path of inputs) {
  test(`converts maintained example ${path}`, () => {
    const result = convert(
      readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
    );
    assert.equal(result.error, undefined);
    assert.match(result.hocon, /EMQX 6.3.2/);
  });
}
for (const [name, example] of Object.entries(examples)) {
  test(`interactive example ${name} converts`, () =>
    assert.equal(convert(example.content).error, undefined));
}

test('listeners sharing a port on different interfaces are all retained', () => {
  const result = convert(
    hive(
      `<listeners>${['127.0.0.1', '127.0.0.2'].map((address) => `<tcp-listener><port>1883</port><bind-address>${address}</bind-address></tcp-listener>`).join('')}</listeners>`
    )
  );
  assert.equal(result.error, undefined);
  assert.deepEqual(
    Object.values(result.config.listeners.tcp).map((listener) => listener.bind),
    ['127.0.0.1:1883', '127.0.0.2:1883']
  );
});
