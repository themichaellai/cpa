package main

import (
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExtractClientIP(t *testing.T) {
	tests := []struct {
		name         string
		flyClientIP  string
		forwardedFor string
		want         string
	}{
		{name: "uses Fly-Client-IP", flyClientIP: "203.0.113.7", want: "203.0.113.7"},
		{name: "uses IPv6 Fly-Client-IP", flyClientIP: "2601:645::1", want: "2601:645::1"},
		{name: "ignores X-Forwarded-For", flyClientIP: "203.0.113.7", forwardedFor: "6.6.6.6, 2a09:8280:1::2e:cd3b:0", want: "203.0.113.7"},
		{name: "falls back to direct address without header", want: "192.0.2.1"},
		{name: "falls back to direct address on malformed header", flyClientIP: "not-an-ip", want: "192.0.2.1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/ping", nil)
			req.RemoteAddr = "192.0.2.1:54321"
			if tt.flyClientIP != "" {
				req.Header.Set("Fly-Client-IP", tt.flyClientIP)
			}
			if tt.forwardedFor != "" {
				req.Header.Set("X-Forwarded-For", tt.forwardedFor)
			}
			assert.Equal(t, tt.want, extractClientIP(req))
		})
	}
}
