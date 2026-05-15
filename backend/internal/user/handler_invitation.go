package user

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// GetInvitationHandler returns invitation details for a given token
// GET /api/v1/invitations/:token
// This is a public endpoint (no auth) so the invited user can see it before registering
func GetInvitationHandler(invitationRepo InvitationRepository, accountRepo AccountRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.Param("token")
		if token == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Token required"})
			return
		}

		inv, err := invitationRepo.GetInvitationByToken(token)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Invalid or expired invitation"})
			return
		}

		// Get account name
		accountName := ""
		if account, err := accountRepo.GetAccountByID(inv.AccountID); err == nil {
			accountName = account.Name
		}

		c.JSON(http.StatusOK, gin.H{
			"email":        inv.Email,
			"role":         inv.Role,
			"account_name": accountName,
			"expires_at":   inv.ExpiresAt.Format("2006-01-02T15:04:05Z"),
		})
	}
}
