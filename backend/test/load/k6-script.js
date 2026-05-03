import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

const users = new SharedArray('users', function () {
  return JSON.parse(open('./users.json')).users;
});

export const options = {
  stages: [
    { duration: '30s', target: 100 },  // ramp up to 100 users
    { duration: '1m', target: 500 },   // ramp to 500 users
    { duration: '2m', target: 1000 },  // ramp to 1000 users
    { duration: '1m', target: 0 },      // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],    // <1% failure rate
  },
};

export default function () {
  // Random user from pool
  const user = users[Math.floor(Math.random() * users.length)];
  
  // Login
  const loginRes = http.post('http://localhost:8080/api/v1/auth/login', 
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(loginRes, { 'login status 200': (r) => r.status === 200 });
  
  if (loginRes.status !== 200) {
    return;
  }
  
  const token = loginRes.json('token');
  
  // Get devices
  const devicesRes = http.get('http://localhost:8080/api/v1/devices', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  check(devicesRes, { 'devices status 200': (r) => r.status === 200 });
  
  if (devicesRes.status !== 200) {
    return;
  }
  
  const devices = devicesRes.json('devices');
  
  // If devices exist, get data for first device
  if (devices && devices.length > 0) {
    const deviceId = devices[0].id;
    
    const dataRes = http.get(
      `http://localhost:8080/api/v1/devices/${deviceId}/data/latest?sensor_type=temperature`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    check(dataRes, { 'data status 200': (r) => r.status === 200 });
  }
  
  sleep(1);
}
