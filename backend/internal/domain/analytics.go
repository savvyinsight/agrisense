package domain

import "time"

type SensorAnalyticsData struct {
	Timestamp time.Time `json:"timestamp"`
	Avg       float64   `json:"avg"`
	Min       float64   `json:"min"`
	Max       float64   `json:"max"`
	Count     int       `json:"count"`
}

type SensorAnalyticsReport struct {
	SensorType string                `json:"sensor_type"`
	Unit       string                `json:"unit"`
	Data       []SensorAnalyticsData `json:"data"`
}

type AnalyticsReport struct {
	DeviceID      int                     `json:"device_id"`
	DeviceUID     string                  `json:"device_uid"`
	Start         time.Time               `json:"start"`
	End           time.Time               `json:"end"`
	ReportType    string                  `json:"report_type"`
	SensorReports []SensorAnalyticsReport `json:"sensor_reports"`
}
