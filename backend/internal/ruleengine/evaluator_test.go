package ruleengine

import (
	"testing"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/sensor"
	"github.com/stretchr/testify/assert"
)

func floatPtr(v float64) *float64 {
	return &v
}

func TestEvaluate_EQ_ExactMatch(t *testing.T) {
	e := NewEvaluator()
	rule := &alert.AlertRule{
		Condition:      alert.ConditionEQ,
		ThresholdValue: floatPtr(25.0),
	}
	data := &sensor.SensorData{Value: 25.0}
	assert.True(t, e.Evaluate(rule, data))
}

func TestEvaluate_EQ_EpsilonMatch(t *testing.T) {
	e := NewEvaluator()
	rule := &alert.AlertRule{
		Condition:      alert.ConditionEQ,
		ThresholdValue: floatPtr(25.0),
	}
	// Within epsilon of floating-point rounding
	data := &sensor.SensorData{Value: 25.0000000001}
	assert.True(t, e.Evaluate(rule, data))
}

func TestEvaluate_EQ_NoMatch(t *testing.T) {
	e := NewEvaluator()
	rule := &alert.AlertRule{
		Condition:      alert.ConditionEQ,
		ThresholdValue: floatPtr(25.0),
	}
	data := &sensor.SensorData{Value: 25.1}
	assert.False(t, e.Evaluate(rule, data))
}

func TestEvaluate_GT(t *testing.T) {
	e := NewEvaluator()
	rule := &alert.AlertRule{
		Condition:      alert.ConditionGT,
		ThresholdValue: floatPtr(30.0),
	}
	assert.True(t, e.Evaluate(rule, &sensor.SensorData{Value: 35.0}))
	assert.False(t, e.Evaluate(rule, &sensor.SensorData{Value: 25.0}))
}

func TestEvaluate_LT(t *testing.T) {
	e := NewEvaluator()
	rule := &alert.AlertRule{
		Condition:      alert.ConditionLT,
		ThresholdValue: floatPtr(30.0),
	}
	assert.True(t, e.Evaluate(rule, &sensor.SensorData{Value: 25.0}))
	assert.False(t, e.Evaluate(rule, &sensor.SensorData{Value: 35.0}))
}

func TestEvaluate_Between(t *testing.T) {
	e := NewEvaluator()
	rule := &alert.AlertRule{
		Condition:      alert.ConditionBetween,
		ThresholdValue: floatPtr(10.0),
		ThresholdMax:   floatPtr(30.0),
	}
	assert.True(t, e.Evaluate(rule, &sensor.SensorData{Value: 20.0}))
	assert.True(t, e.Evaluate(rule, &sensor.SensorData{Value: 10.0}))
	assert.True(t, e.Evaluate(rule, &sensor.SensorData{Value: 30.0}))
	assert.False(t, e.Evaluate(rule, &sensor.SensorData{Value: 5.0}))
	assert.False(t, e.Evaluate(rule, &sensor.SensorData{Value: 35.0}))
}
