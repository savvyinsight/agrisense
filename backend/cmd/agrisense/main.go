package main

import (
	"log"
	"os"
	"time"

	"github.com/savvyinsight/agrisense/internal/config"
	"github.com/savvyinsight/agrisense/internal/infra/postgres"
	"github.com/savvyinsight/agrisense/internal/user"
	"github.com/urfave/cli/v2"
)

func main() {
	app := &cli.App{
		Name:  "agrisense",
		Usage: "AgriSense IoT Platform - unified server",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:    "config",
				Aliases: []string{"c"},
				Value:   ".env",
				Usage:   "Path to configuration file",
			},
		},
		Action: runServer,
		Commands: []*cli.Command{
			{
				Name:  "admin",
				Usage: "Platform admin management",
				Subcommands: []*cli.Command{
					{
						Name:  "create",
						Usage: "Create the initial platform admin user",
						Flags: []cli.Flag{
							&cli.StringFlag{Name: "email", Aliases: []string{"e"}, Required: true, Usage: "Admin email address"},
							&cli.StringFlag{Name: "password", Aliases: []string{"p"}, Required: true, Usage: "Admin password"},
							&cli.StringFlag{Name: "username", Aliases: []string{"u"}, Value: "admin", Usage: "Admin username"},
						},
						Action: createAdminCommand,
					},
				},
			},
		},
	}

	if err := app.Run(os.Args); err != nil {
		log.Fatalf("Failed to start AgriSense: %v", err)
	}
}

func createAdminCommand(cliCtx *cli.Context) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	pgDB, err := postgres.NewConnection(postgres.Config{
		Host:     cfg.DBHost,
		Port:     cfg.DBPort,
		User:     cfg.DBUser,
		Password: cfg.DBPassword,
		DBName:   cfg.DBName,
		SSLMode:  cfg.DBSSLMode,
	})
	if err != nil {
		return err
	}
	defer func() {
		_ = pgDB.Close()
	}()

	userRepo := &user.PostgresUserRepository{DB: pgDB}
	platformAdminRepo := &user.PostgresPlatformAdminRepository{DB: pgDB}
	authService := user.NewService(userRepo, nil, nil, nil, platformAdminRepo, cfg.JWTSecret, 24*time.Hour)

	adminReq := user.AdminCreateRequest{
		Username: cliCtx.String("username"),
		Email:    cliCtx.String("email"),
		Password: cliCtx.String("password"),
	}

	admin, err := authService.BootstrapAdmin(adminReq)
	if err != nil {
		return err
	}

	log.Printf("Admin user created: %s (id=%d)", admin.Email, admin.ID)
	return nil
}
