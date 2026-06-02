//go:build ignore

package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultAPIURL  = "http://localhost:8080"
	defaultEmail   = "perf-test@example.com"
	defaultUser    = "perf-test"
	defaultPass    = "test123"
	defaultDevices = 100
)

type loginResponse struct {
	Token string `json:"token"`
}

func main() {
	apiURL := flag.String("url", defaultAPIURL, "API base URL")
	email := flag.String("email", defaultEmail, "User email")
	username := flag.String("username", defaultUser, "Username")
	password := flag.String("password", defaultPass, "Password")
	numDevices := flag.Int("devices", defaultDevices, "Number of devices to create")
	flag.Parse()

	client := &http.Client{Timeout: 10 * time.Second}

	// Step 1: Register user (ignore if already exists)
	fmt.Printf("[1/3] Registering user %s ... ", *email)
	err := registerUser(client, *apiURL, *username, *email, *password)
	if err != nil {
		fmt.Printf("skipped (%v)\n", err)
	} else {
		fmt.Println("ok")
	}

	// Step 2: Login to get token
	fmt.Printf("[2/3] Logging in ... ")
	token, err := loginUser(client, *apiURL, *email, *password)
	if err != nil {
		fmt.Fprintf(os.Stderr, "FAIL: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("ok (token: %s...)\n", token[:20])

	// Step 3: Register devices
	fmt.Printf("[3/3] Registering %d devices ...\n", *numDevices)
	created, skipped, failed := 0, 0, 0
	for i := 1; i <= *numDevices; i++ {
		deviceID := fmt.Sprintf("sensor-%03d", i)
		name := fmt.Sprintf("Performance Test Sensor %d", i)

		err := createDevice(client, *apiURL, token, deviceID, name)
		switch {
		case err == nil:
			created++
		case isDuplicate(err):
			skipped++
		default:
			failed++
			if failed <= 3 {
				fmt.Fprintf(os.Stderr, "  WARN: %s: %v\n", deviceID, err)
			}
		}

		if i%20 == 0 {
			fmt.Printf("  ... %d/%d done\n", i, *numDevices)
		}
	}

	fmt.Printf("\nDone: %d created, %d skipped (exist), %d failed\n", created, skipped, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

func registerUser(client *http.Client, apiURL, username, email, password string) error {
	body := map[string]string{
		"username": username,
		"email":    email,
		"password": password,
	}
	resp, err := postJSON(client, apiURL+"/api/v1/auth/register", body)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusConflict {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
}

func loginUser(client *http.Client, apiURL, email, password string) (string, error) {
	body := map[string]string{
		"email":    email,
		"password": password,
	}
	resp, err := postJSON(client, apiURL+"/api/v1/auth/login", body)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
	}
	var lr loginResponse
	if err := json.NewDecoder(resp.Body).Decode(&lr); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}
	if lr.Token == "" {
		return "", fmt.Errorf("empty token in response")
	}
	return lr.Token, nil
}

func createDevice(client *http.Client, apiURL, token, deviceID, name string) error {
	body := map[string]string{
		"device_id": deviceID,
		"name":      name,
		"type":      "sensor",
	}
	reqBody, _ := json.Marshal(body)
	req, err := http.NewRequest("POST", apiURL+"/api/v1/devices", bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusCreated {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("status %d: %s", resp.StatusCode, string(b))
}

func isDuplicate(err error) bool {
	msg := err.Error()
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "already exists") || strings.Contains(msg, "unique")
}

func postJSON(client *http.Client, url string, body interface{}) (*http.Response, error) {
	b, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return client.Post(url, "application/json", bytes.NewReader(b))
}
