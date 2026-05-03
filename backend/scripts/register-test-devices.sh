#!/bin/bash

# Register test devices for performance testing
echo "Registering test devices..."

# First register a user and get token
echo "Registering test user..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"perf-test","email":"perf-test@example.com","password":"test123"}')

echo "Login response: $REGISTER_RESPONSE"

# Login to get token
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"perf-test@example.com","password":"test123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Got token: ${TOKEN:0:20}..."

# Register 100 test devices
echo "Registering 100 test devices..."
for i in $(seq 1 100); do
  DEVICE_ID=$(printf "sensor-%03d" $i)
  curl -s -X POST http://localhost:8080/api/v1/devices \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"device_id\":\"$DEVICE_ID\",\"name\":\"Performance Test Sensor $i\",\"type\":\"sensor\"}" > /dev/null

  if [ $((i % 10)) -eq 0 ]; then
    echo "Registered $i devices..."
  fi
done

echo "All devices registered successfully!"