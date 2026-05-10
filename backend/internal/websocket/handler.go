package websocket

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/savvyinsight/agrisense/internal/user"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Aloow all origins for development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type Handler struct {
	authService *user.Service
	hub         *Hub
}

func NewHander(authService *user.Service) *Handler {
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
		if err := client.conn.Close(); err != nil {
			log.Printf("Failed to close websocket connection: %v", err)
		}
	}()

	// Set readline to prevent hanging
	client.conn.SetReadLimit(512)
	if err := client.conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
		log.Printf("Failed to set read deadline: %v", err)
	}
	client.conn.SetPongHandler(func(string) error {
		if err := client.conn.SetReadDeadline(time.Now().Add(60 * time.Second)); err != nil {
			log.Printf("Failed to refresh read deadline: %v", err)
		}
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
		if err := client.conn.Close(); err != nil {
			log.Printf("Failed to close websocket connection: %v", err)
		}
	}()

	for {
		select {
		case message, ok := <-client.send:
			log.Printf("WritePump sending to user %d: %s", client.userID, string(message))
			if err := client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				log.Printf("Failed to set write deadline: %v", err)
			}
			if !ok {
				if err := client.conn.WriteMessage(websocket.CloseMessage, []byte{}); err != nil {
					log.Printf("Failed to write close message: %v", err)
				}
				return
			}

			if err := client.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("Failed to write message: %v", err)
				return
			}

		case <-ticker.C:
			if err := client.conn.SetWriteDeadline(time.Now().Add(10 * time.Second)); err != nil {
				log.Printf("Failed to set write deadline for ping: %v", err)
			}
			if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Printf("Failed to send ping message: %v", err)
				return
			}
		}
	}
}
