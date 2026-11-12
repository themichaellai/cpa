package main

import (
	"net"
	"net/http"

	"github.com/labstack/echo/v4"
)

var extractDirectIP = echo.ExtractIPDirect()

// extractClientIP returns the visitor's IP for Echo's RealIP and request logs.
// Fly's proxy sets Fly-Client-IP to the visitor's address. X-Forwarded-For
// isn't usable there: its rightmost entry is the app's own ingress address.
// Without the header (local dev) or with a malformed one, it falls back to the
// direct connection's address.
func extractClientIP(req *http.Request) string {
	if ip := net.ParseIP(req.Header.Get("Fly-Client-IP")); ip != nil {
		return ip.String()
	}
	return extractDirectIP(req)
}
