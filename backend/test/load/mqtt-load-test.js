#!/usr/bin/env node

const mqtt = require('mqtt');
const { performance } = require('perf_hooks');

// Configuration
const MQTT_BROKER = 'mqtt://localhost:1883';
const NUM_DEVICES = 100; // Simulate 100 devices
const MESSAGES_PER_SECOND = 2300; // Target: 2300+ messages/second
const TEST_DURATION = 60; // 60 seconds test
const BATCH_SIZE = 100; // Send in batches

// Generate device IDs
const devices = [];
for (let i = 1; i <= NUM_DEVICES; i++) {
  devices.push(`sensor-${i.toString().padStart(3, '0')}`);
}

// Telemetry data template
function generateTelemetry(deviceId) {
  const sensors = ['temperature', 'humidity', 'soil_moisture', 'light_intensity'];
  const sensor = sensors[Math.floor(Math.random() * sensors.length)];

  let value;
  switch (sensor) {
    case 'temperature':
      value = 15 + Math.random() * 25; // 15-40°C
      break;
    case 'humidity':
      value = 30 + Math.random() * 50; // 30-80%
      break;
    case 'soil_moisture':
      value = 10 + Math.random() * 80; // 10-90%
      break;
    case 'light_intensity':
      value = 1000 + Math.random() * 9000; // 1000-10000 lux
      break;
  }

  return {
    timestamp: new Date().toISOString(),
    readings: [{
      sensor: sensor,
      value: Math.round(value * 100) / 100 // 2 decimal places
    }],
    metadata: {
      device_id: deviceId,
      firmware_version: '1.2.3'
    }
  };
}

// Performance tracking
let totalMessagesSent = 0;
let totalMessagesReceived = 0;
let startTime = 0;
let endTime = 0;
const latencies = [];
const errors = [];

// Create MQTT clients
const clients = [];
let connectedClients = 0;

console.log(`🚀 Starting MQTT Load Test`);
console.log(`📊 Target: ${MESSAGES_PER_SECOND} messages/second`);
console.log(`⏱️  Duration: ${TEST_DURATION} seconds`);
console.log(`📱 Devices: ${NUM_DEVICES}`);
console.log(`🔄 Batch Size: ${BATCH_SIZE}`);
console.log('');

// Connect all clients
function connectClients() {
  return new Promise((resolve) => {
    devices.forEach((deviceId, index) => {
      const client = mqtt.connect(MQTT_BROKER, {
        clientId: `load-test-${deviceId}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      });

      client.on('connect', () => {
        connectedClients++;
        if (connectedClients === NUM_DEVICES) {
          console.log(`✅ All ${NUM_DEVICES} clients connected`);
          resolve();
        }
      });

      client.on('error', (err) => {
        console.error(`❌ Client ${deviceId} error:`, err.message);
        errors.push(err);
      });

      clients.push({ client, deviceId });
    });
  });
}

// Send messages in batches
function sendMessageBatch() {
  const batchStartTime = performance.now();

  for (let i = 0; i < BATCH_SIZE; i++) {
    const clientIndex = Math.floor(Math.random() * clients.length);
    const { client, deviceId } = clients[clientIndex];

    const telemetry = generateTelemetry(deviceId);
    const topic = `device/${deviceId}/telemetry`;
    const payload = JSON.stringify(telemetry);

    try {
      client.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) {
          errors.push(err);
        } else {
          totalMessagesSent++;
        }
      });
    } catch (err) {
      errors.push(err);
    }
  }

  const batchEndTime = performance.now();
  latencies.push(batchEndTime - batchStartTime);
}

// Main test function
async function runLoadTest() {
  console.log('🔌 Connecting clients...');
  await connectClients();

  console.log('📤 Starting message flood...');
  startTime = performance.now();

  // Calculate timing
  const intervalMs = (BATCH_SIZE / MESSAGES_PER_SECOND) * 1000;
  const totalBatches = Math.ceil((MESSAGES_PER_SECOND * TEST_DURATION) / BATCH_SIZE);

  console.log(`⏰ Interval: ${intervalMs.toFixed(2)}ms between batches`);
  console.log(`📦 Total batches: ${totalBatches}`);
  console.log('');

  let batchCount = 0;
  const testInterval = setInterval(() => {
    if (batchCount >= totalBatches) {
      clearInterval(testInterval);
      endTest();
      return;
    }

    sendMessageBatch();
    batchCount++;

    // Progress reporting
    if (batchCount % 10 === 0) {
      const elapsed = (performance.now() - startTime) / 1000;
      const currentRate = (batchCount * BATCH_SIZE) / elapsed;
      process.stdout.write(`\r📊 Progress: ${batchCount}/${totalBatches} batches (${currentRate.toFixed(0)} msg/sec)`);
    }
  }, intervalMs);
}

function endTest() {
  endTime = performance.now();
  const duration = (endTime - startTime) / 1000;

  console.log('\n\n📈 Test Results:');
  console.log('='.repeat(50));
  console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
  console.log(`📤 Messages Sent: ${totalMessagesSent.toLocaleString()}`);
  console.log(`📥 Messages Received: ${totalMessagesReceived.toLocaleString()}`);
  console.log(`❌ Errors: ${errors.length}`);

  const actualRate = totalMessagesSent / duration;
  console.log(`🚀 Actual Throughput: ${actualRate.toFixed(0)} messages/second`);

  if (latencies.length > 0) {
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

    console.log('\n⚡ Latency Stats:');
    console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Min: ${minLatency.toFixed(2)}ms`);
    console.log(`  Max: ${maxLatency.toFixed(2)}ms`);
    console.log(`  P95: ${p95Latency.toFixed(2)}ms`);
  }

  console.log('\n🎯 Target Assessment:');
  const target = MESSAGES_PER_SECOND;
  const success = actualRate >= target;
  console.log(`  Target: ${target} msg/sec`);
  console.log(`  Achieved: ${actualRate.toFixed(0)} msg/sec`);
  console.log(`  Status: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  console.log(`  Gap: ${(actualRate - target).toFixed(0)} msg/sec ${actualRate >= target ? 'above' : 'below'} target`);

  if (!success) {
    console.log('\n🔧 Optimization Needed!');
    console.log('   - Check MQTT broker configuration');
    console.log('   - Review message processing pipeline');
    console.log('   - Optimize database writes');
    console.log('   - Consider batching strategies');
  }

  // Cleanup
  console.log('\n🧹 Cleaning up...');
  clients.forEach(({ client }) => {
    client.end();
  });

  process.exit(success ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Test interrupted by user');
  endTest();
});

// Start the test
runLoadTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});