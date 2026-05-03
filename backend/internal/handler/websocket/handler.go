package websocket

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/savvyinsight/agrisenseiot/internal/service/auth"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Aloow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Handler struct {
	authService *auth.Service
	hub         *Hub
}

func NewHander(authService *auth.Service) *Handler {
	return &Handler{
		authService: authService,
		hub:         GetHub(),
	}
}

func (h *Handler) HandleWebSocket(c *gin.Context) {
	log.Println("HandleWebSocket called!")
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token required"})
		return
	}

	// Validate token
	claims, err := h.authService.ValidateToken(token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token"})
		return
	}

	// Upgrade connection
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection %v", err)
		return
	}

	// Create client
	client := &Client{
		conn:   conn,
		userID: claims.UserID,
		send:   make(chan []byte, 256),
	}

	// Register Client
	h.hub.register <- client

	// Start read and write pumps
	go h.writePump(client)
	h.readPump(client)
}

func (h *Handler) readPump(client *Client) {
	defer func() {
		log.Printf("readPump exiting for user %d", client.userID)
		h.hub.unregister <- client
		client.conn.Close()
	}()

	// Set readline to prevent hanging
	client.conn.SetReadLimit(512)
	client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	client.conn.SetPongHandler(func(string) error {
		client.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Block forever reading messages
	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			log.Printf("readPump error for user %d: %v", client.userID, err)
			break
		}

		// Handle client messages (subscribe / unsubscribe if needed)
		log.Printf("Received from user %d: %s", client.userID, message)
	}
}

func (h *Handler) writePump(client *Client) {
	ticker := time.NewTicker(30 * time.Second)

	defer func() {
		log.Printf("writePump exiting for user %d", client.userID)
		ticker.Stop()
		client.conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.send:
			log.Printf("WritePump sending to user %d: %s", client.userID, string(message))
			client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				client.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			err := client.conn.WriteMessage(websocket.TextMessage, message)
			if err != nil {
				return
			}

		case <-ticker.C:
			client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
