package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type CacheRepository struct {
	client *redis.Client
}

func NewCacheRepository(client *redis.Client) *CacheRepository {
	return &CacheRepository{
		client: client,
	}
}

func (r *CacheRepository) SetJSON(key string, value interface{}, ttl time.Duration) error {
	ctx := context.Background()

	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal JSON: %w", err)
	}

	return r.client.Set(ctx, key, data, ttl).Err()
}

func (r *CacheRepository) GetJSON(key string, dest interface{}) error {
	ctx := context.Background()

	data, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}

	return json.Unmarshal(data, dest)
}

func (r *CacheRepository) Delete(key string) error {
	ctx := context.Background()
	return r.client.Del(ctx, key).Err()
}

func (r *CacheRepository) SetDeviceStatus(deviceID string, status string) error {
	key := fmt.Sprintf("device:status:%s", deviceID)
	return r.SetJSON(key, map[string]interface{}{
		"status":  status,
		"updated": time.Now(),
	}, 5*time.Minute)
}

func (r *CacheRepository) GetDeviceStatus(deviceID string) (string, error) {
	key := fmt.Sprintf("device:status:%s", deviceID)
	var data map[string]interface{}
	err := r.GetJSON(key, &data)
	if err != nil {
		return "", err
	}
	status, ok := data["status"].(string)
	if !ok {
		return "", fmt.Errorf("invalid status format")
	}
	return status, nil
}
