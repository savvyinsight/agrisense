package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	conn   *websocket.Conn
	userID int
	send   chan []byte
}

type Hub struct {
	clients     map[*Client]bool
	userClients map[int]*Client //Track by user ID
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	mu          sync.RWMutex
}

var hubInstance *Hub
var once sync.Once

func GetHub() *Hub {
	once.Do(func() {
		hubInstance = &Hub{
			clients:     make(map[*Client]bool),
			userClients: make(map[int]*Client),
			broadcast:   make(chan []byte),
			register:    make(chan *Client),
			unregister:  make(chan *Client),
		}
		go hubInstance.run()
	})
	return hubInstance
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// Close existing connection for this user
			if existing, ok := h.userClients[client.userID]; ok {
				h.unregisterClient(existing)
			}
			h.clients[client] = true
			h.userClients[client.userID] = client
			h.mu.Unlock()
			log.Printf("WebSocket client registered: user %d, total clients: %d", client.userID, len(h.clients))
		case client := <-h.unregister:
			h.mu.Lock()
			h.unregisterClient(client)
			h.mu.Unlock()
			log.Printf("WebSocket client unregistered: user %d, total clients: %d", client.userID, len(h.clients))
		case message := <-h.broadcast:
			h.broadcastAll(message)
		}
	}
}

// broadcastAll sends a message to all connected clients.
// Uses a read lock for the send phase (concurrent sends are safe) and only
// acquires a write lock to clean up dead clients afterward.
func (h *Hub) broadcastAll(message []byte) {
	h.mu.RLock()
	var dead []*Client
	for client := range h.clients {
		select {
		case client.send <- message:
		default:
			dead = append(dead, client)
		}
	}
	h.mu.RUnlock()

	if len(dead) > 0 {
		h.mu.Lock()
		for _, client := range dead {
			// Re-check: another goroutine may have already cleaned this client
			if _, ok := h.clients[client]; ok {
				close(client.send)
				delete(h.clients, client)
				delete(h.userClients, client.userID)
			}
		}
		h.mu.Unlock()
		log.Printf("Hub cleaned up %d dead client(s)", len(dead))
	}
}

func (h *Hub) unregisterClient(client *Client) {
	if _, ok := h.clients[client]; ok {
		delete(h.clients, client)
		delete(h.userClients, client.userID)
		close(client.send)
	}
}

func (h *Hub) BroadcastToUser(userID int, data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("Failed to marshal broadcast data: %v", err)
		return
	}

	h.mu.RLock()
	var target *Client
	for client := range h.clients {
		if client.userID == userID {
			target = client
			break
		}
	}
	h.mu.RUnlock()

	if target != nil {
		select {
		case target.send <- payload:
		default:
			// Client's buffer is full — clean it up
			h.mu.Lock()
			if _, ok := h.clients[target]; ok {
				close(target.send)
				delete(h.clients, target)
				delete(h.userClients, target.userID)
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) BroadcastAll(data interface{}) {
	payload, err := json.Marshal(data)
	if err != nil {
		log.Printf("Failed to marshal broadcast data: %v", err)
		return
	}

	h.broadcast <- payload
}
