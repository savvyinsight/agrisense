package ruleengine

import (
	"fmt"

	"github.com/savvyinsight/agrisenseiot/internal/domain"
)

type Evaluator struct {
	// Could add sliding window cache here for duration-based rules
}

func NewEvaluator() *Evaluator {
	return &Evaluator{}
}

func (e *Evaluator) Evaluate(rule *domain.AlertRule, data *domain.SensorData) bool {
	// Simple threshold evaluation (no duration yet)
	switch rule.Condition {
	case domain.ConditionGT:
		if data.Value > *rule.ThresholdValue {
			return true
		}
	case domain.ConditionLT:
		if data.Value < *rule.ThresholdValue {
			return true
		}
	case domain.ConditionEQ:
		if data.Value == *rule.ThresholdValue {
			return true
		}
	case domain.ConditionGTE:
		if data.Value >= *rule.ThresholdValue {
			return true
		}
	case domain.ConditionLTE:
		if data.Value <= *rule.ThresholdValue {
			return true
		}
	case domain.ConditionBetween:
		if rule.ThresholdValue != nil && rule.ThresholdMax != nil {
			if data.Value >= *rule.ThresholdValue && data.Value <= *rule.ThresholdMax {
				return true
			}
		}
	}

	return false
}

func (e *Evaluator) FormatMessage(rule *domain.AlertRule, data *domain.SensorData) string {
	switch rule.Condition {
	case domain.ConditionGT:
		return fmt.Sprintf("%s exceeded %.1f (current: %.1f)",
			data.SensorType, *rule.ThresholdValue, data.Value)
	case domain.ConditionLT:
		return fmt.Sprintf("%s below %.1f (current: %.1f)",
			data.SensorType, *rule.ThresholdValue, data.Value)
	case domain.ConditionBetween:
		return fmt.Sprintf("%s out of range [%.1f-%.1f] (current: %.1f)",
			data.SensorType, *rule.ThresholdValue, *rule.ThresholdMax, data.Value)
	default:
		return fmt.Sprintf("%s alert triggered (value: %.1f)",
			data.SensorType, data.Value)
	}
}
