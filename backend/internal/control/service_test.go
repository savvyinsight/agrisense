package control

import (
	"encoding/json"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/savvyinsight/agrisense/internal/device"
	"github.com/stretchr/testify/assert"
)

type fakeCommandRepo struct {
	createFunc         func(cmd *Command) error
	getByIDFunc        func(id int) (*Command, error)
	updateStatusFunc   func(id int, status CommandStatus) error
	updateDeliveryFunc func(id int, sentAt, deliveredAt, executedAt *time.Time) error
}

func (f *fakeCommandRepo) Create(cmd *Command) error {
	if f.createFunc != nil {
		return f.createFunc(cmd)
	}
	return nil
}

func (f *fakeCommandRepo) GetByID(id int) (*Command, error) {
	if f.getByIDFunc != nil {
		return f.getByIDFunc(id)
	}
	return nil, errors.New("not found")
}

func (f *fakeCommandRepo) GetByDeviceID(deviceID int, limit int) ([]Command, error) {
	return nil, nil
}

func (f *fakeCommandRepo) UpdateStatus(id int, status CommandStatus) error {
	if f.updateStatusFunc != nil {
		return f.updateStatusFunc(id, status)
	}
	return nil
}

func (f *fakeCommandRepo) UpdateDelivery(id int, sentAt, deliveredAt, executedAt *time.Time) error {
	if f.updateDeliveryFunc != nil {
		return f.updateDeliveryFunc(id, sentAt, deliveredAt, executedAt)
	}
	return nil
}

func (f *fakeCommandRepo) GetPending(deviceID int) ([]Command, error) {
	return nil, nil
}

type fakeDeviceRepo struct {
	getByIDFunc func(id int) (*device.Device, error)
}

func (f *fakeDeviceRepo) Create(device *device.Device) error {
	return nil
}

func (f *fakeDeviceRepo) GetByID(id int) (*device.Device, error) {
	if f.getByIDFunc != nil {
		return f.getByIDFunc(id)
	}
	return nil, errors.New("not found")
}

func (f *fakeDeviceRepo) GetByDeviceID(deviceID string) (*device.Device, error) {
	return nil, nil
}

func (f *fakeDeviceRepo) GetByUserID(userID int) ([]device.Device, error) {
	return nil, nil
}

func (f *fakeDeviceRepo) Update(device *device.Device) error {
	return nil
}

func (f *fakeDeviceRepo) UpdateStatus(deviceID string, status device.DeviceStatus) error {
	return nil
}

func (f *fakeDeviceRepo) UpdateHeartbeat(deviceID string) error {
	return nil
}

func (f *fakeDeviceRepo) Delete(id int) error {
	return nil
}

func (f *fakeDeviceRepo) List(userID int, limit, offset int) ([]device.Device, int64, error) {
	return nil, 0, nil
}

func TestExecuteCommand_SendsPayloadAndUpdatesDelivery(t *testing.T) {
	deviceRepo := &fakeDeviceRepo{
		getByIDFunc: func(id int) (*device.Device, error) {
			return &device.Device{ID: id, DeviceID: "external-device-id"}, nil
		},
	}

	var mu sync.Mutex
	updatedDelivery := false
	cmdRepo := &fakeCommandRepo{
		createFunc: func(cmd *Command) error {
			cmd.ID = 1
			return nil
		},
		updateDeliveryFunc: func(id int, sentAt, deliveredAt, executedAt *time.Time) error {
			mu.Lock()
			defer mu.Unlock()
			if id != 1 {
				t.Errorf("unexpected command id %d", id)
			}
			if sentAt == nil {
				t.Error("sentAt must not be nil")
			}
			updatedDelivery = true
			return nil
		},
	}

	published := make(chan []byte, 1)
	publishFunc := func(deviceID string, payload []byte) error {
		if deviceID != "external-device-id" {
			return errors.New("wrong device id")
		}
		published <- payload
		return nil
	}

	service := NewService(cmdRepo, deviceRepo, publishFunc)

	cmd, err := service.ExecuteCommand(10, "turn_on", map[string]interface{}{"timeout": 5}, nil)
	assert.NoError(t, err)
	assert.NotNil(t, cmd)
	assert.Equal(t, 1, cmd.ID)

	select {
	case payload := <-published:
		var body map[string]interface{}
		assert.NoError(t, json.Unmarshal(payload, &body))
		assert.Equal(t, "turn_on", body["command"])
		assert.Equal(t, float64(5), body["parameters"].(map[string]interface{})["timeout"])
	case <-time.After(time.Second):
		t.Fatal("expected publish func to be called")
	}

	// Wait briefly to allow the async delivery update to complete.
	time.Sleep(100 * time.Millisecond)

	mu.Lock()
	assert.True(t, updatedDelivery)
	mu.Unlock()
}

func TestHandleCommandResponse_ExecutedUpdatesDelivery(t *testing.T) {
	now := time.Now()
	cmd := &Command{ID: 1, Status: CommandStatusSent, SentAt: &now}

	updated := make(chan struct{}, 1)
	cmdRepo := &fakeCommandRepo{
		getByIDFunc: func(id int) (*Command, error) {
			if id == 1 {
				return cmd, nil
			}
			return nil, errors.New("not found")
		},
		updateDeliveryFunc: func(id int, sentAt, deliveredAt, executedAt *time.Time) error {
			if id != 1 {
				t.Errorf("expected id 1, got %d", id)
			}
			if deliveredAt == nil {
				t.Error("deliveredAt must not be nil")
			}
			updated <- struct{}{}
			return nil
		},
	}

	service := NewService(cmdRepo, &fakeDeviceRepo{}, nil)
	service.cmdRepo = cmdRepo

	service.HandleCommandResponse("external-device-id", []byte(`{"command_id":1,"status":"executed","message":"ok"}`))

	select {
	case <-updated:
		// success
	case <-time.After(time.Second):
		t.Fatal("expected UpdateDelivery to be called")
	}
}

func TestHandleCommandResponse_FailedUpdatesStatus(t *testing.T) {
	cmd := &Command{ID: 2, Status: CommandStatusSent}

	updated := make(chan struct{}, 1)
	cmdRepo := &fakeCommandRepo{
		getByIDFunc: func(id int) (*Command, error) {
			if id == 2 {
				return cmd, nil
			}
			return nil, errors.New("not found")
		},
		updateStatusFunc: func(id int, status CommandStatus) error {
			if id != 2 {
				t.Errorf("expected id 2, got %d", id)
			}
			if status != CommandStatusFailed {
				t.Errorf("expected failed status, got %s", status)
			}
			updated <- struct{}{}
			return nil
		},
	}

	service := NewService(cmdRepo, &fakeDeviceRepo{}, nil)
	service.HandleCommandResponse("external-device-id", []byte(`{"command_id":2,"status":"failed","message":"failed"}`))

	select {
	case <-updated:
		// success
	case <-time.After(time.Second):
		t.Fatal("expected UpdateStatus to be called")
	}
}
