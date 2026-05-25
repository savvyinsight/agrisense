package ruleengine

import (
	"fmt"
	"math"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/sensor"
)

type Evaluator struct {
	// Could add sliding window cache here for duration-based rules
}

func NewEvaluator() *Evaluator {
	return &Evaluator{}
}

func (e *Evaluator) Evaluate(rule *alert.AlertRule, data *sensor.SensorData) bool {
	// Simple threshold evaluation (no duration yet)
	switch rule.Condition {
	case alert.ConditionGT:
		if data.Value > *rule.ThresholdValue {
			return true
		}
	case alert.ConditionLT:
		if data.Value < *rule.ThresholdValue {
			return true
		}
	case alert.ConditionEQ:
		if math.Abs(data.Value-*rule.ThresholdValue) < 1e-9 {
			return true
		}
	case alert.ConditionGTE:
		if data.Value >= *rule.ThresholdValue {
			return true
		}
	case alert.ConditionLTE:
		if data.Value <= *rule.ThresholdValue {
			return true
		}
	case alert.ConditionBetween:
		if rule.ThresholdValue != nil && rule.ThresholdMax != nil {
			if data.Value >= *rule.ThresholdValue && data.Value <= *rule.ThresholdMax {
				return true
			}
		}
	}

	return false
}

func (e *Evaluator) CheckRecovery(recoveryCondition alert.AlertCondition, recoveryValue float64, currentValue float64) bool {
	switch recoveryCondition {
	case alert.ConditionGT:
		return currentValue > recoveryValue
	case alert.ConditionLT:
		return currentValue < recoveryValue
	case alert.ConditionEQ:
		return math.Abs(currentValue-recoveryValue) < 1e-9
	case alert.ConditionGTE:
		return currentValue >= recoveryValue
	case alert.ConditionLTE:
		return currentValue <= recoveryValue
	}
	return false
}

func (e *Evaluator) FormatMessage(rule *alert.AlertRule, data *sensor.SensorData) string {
	switch rule.Condition {
	case alert.ConditionGT:
		return fmt.Sprintf("%s exceeded %.1f (current: %.1f)",
			data.SensorType, *rule.ThresholdValue, data.Value)
	case alert.ConditionLT:
		return fmt.Sprintf("%s below %.1f (current: %.1f)",
			data.SensorType, *rule.ThresholdValue, data.Value)
	case alert.ConditionBetween:
		return fmt.Sprintf("%s out of range [%.1f-%.1f] (current: %.1f)",
			data.SensorType, *rule.ThresholdValue, *rule.ThresholdMax, data.Value)
	default:
		return fmt.Sprintf("%s alert triggered (value: %.1f)",
			data.SensorType, data.Value)
	}
}
