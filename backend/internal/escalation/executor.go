package escalation

import (
	"encoding/json"
	"log"
	"time"

	"github.com/savvyinsight/agrisense/internal/alert"
	"github.com/savvyinsight/agrisense/internal/websocket"
)

type NotificationDispatcher interface {
	Dispatch(a *alert.Alert, channelIDs []int)
}

type Executor struct {
	alertRepo   alert.AlertRepository
	ruleRepo    EscalationRuleRepository
	historyRepo EscalationHistoryRepository
	dispatcher  NotificationDispatcher
	stopChan    chan struct{}
}

func NewExecutor(
	alertRepo alert.AlertRepository,
	ruleRepo EscalationRuleRepository,
	historyRepo EscalationHistoryRepository,
	dispatcher NotificationDispatcher,
) *Executor {
	return &Executor{
		alertRepo:   alertRepo,
		ruleRepo:    ruleRepo,
		historyRepo: historyRepo,
		dispatcher:  dispatcher,
		stopChan:    make(chan struct{}),
	}
}

func (e *Executor) Start() {
	log.Println("Starting escalation executor...")
	go e.run()
}

func (e *Executor) Stop() {
	close(e.stopChan)
}

func (e *Executor) run() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			e.evaluate()
		case <-e.stopChan:
			return
		}
	}
}

func (e *Executor) evaluate() {
	alerts, err := e.alertRepo.GetActive(0)
	if err != nil {
		log.Printf("Failed to get active alerts for escalation: %v", err)
		return
	}

	accountAlerts := make(map[int][]alert.Alert)
	for _, a := range alerts {
		if a.AccountID != nil {
			accountAlerts[*a.AccountID] = append(accountAlerts[*a.AccountID], a)
		}
	}

	for accountID, acctAlerts := range accountAlerts {
		rules, err := e.ruleRepo.GetEnabledByAccountID(accountID)
		if err != nil {
			log.Printf("Failed to get escalation rules for account %d: %v", accountID, err)
			continue
		}

		for i := range acctAlerts {
			e.evaluateAlert(&acctAlerts[i], rules)
		}
	}
}

func (e *Executor) evaluateAlert(a *alert.Alert, rules []EscalationRule) {
	for _, rule := range rules {
		if rule.TriggerSeverity != string(a.Severity) {
			continue
		}

		history, err := e.historyRepo.GetByAlertID(a.ID)
		if err != nil {
			log.Printf("Failed to get escalation history for alert %d: %v", a.ID, err)
			continue
		}

		currentLevel := 0
		var lastEscalatedAt time.Time
		for _, h := range history {
			if h.RuleID == rule.ID && h.LevelOrder > currentLevel {
				currentLevel = h.LevelOrder
				lastEscalatedAt = h.EscalatedAt
			}
		}

		var nextLevel *EscalationLevel
		for _, level := range rule.Levels {
			if level.LevelOrder == currentLevel+1 {
				nextLevel = &level
				break
			}
		}
		if nextLevel == nil {
			continue
		}

		if currentLevel > 0 {
			requiredDelay := time.Duration(nextLevel.DelayMinutes) * time.Minute
			if time.Since(lastEscalatedAt) < requiredDelay {
				continue
			}
		} else {
			requiredDelay := time.Duration(nextLevel.DelayMinutes) * time.Minute
			if time.Since(a.TriggeredAt) < requiredDelay {
				continue
			}
		}

		entry := &EscalationHistoryEntry{
			AlertID:            a.ID,
			RuleID:             rule.ID,
			LevelOrder:         nextLevel.LevelOrder,
			ChannelIDs:         nextLevel.ChannelIDs,
			NotificationStatus: json.RawMessage(`{}`),
		}

		if err := e.historyRepo.Create(entry); err != nil {
			log.Printf("Failed to create escalation history for alert %d: %v", a.ID, err)
			continue
		}

		log.Printf("Escalated alert %d to level %d (rule: %s)", a.ID, nextLevel.LevelOrder, rule.Name)

		if e.dispatcher != nil {
			go e.dispatcher.Dispatch(a, nextLevel.ChannelIDs)
		}

		if a.AccountID != nil {
			wsMsg := map[string]interface{}{
				"type": "alert_escalated",
				"payload": map[string]interface{}{
					"alert_id":    a.ID,
					"rule_id":     rule.ID,
					"level_order": nextLevel.LevelOrder,
					"severity":    nextLevel.Severity,
				},
			}
			wsHub := websocket.GetHub()
			wsHub.BroadcastAll(wsMsg)
		}
	}
}
