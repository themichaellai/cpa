package mutations

import (
	"testing"
	// Embed the IANA database in the test binary so these cases don't depend
	// on the host's zoneinfo files.
	_ "time/tzdata"
)

func TestParseJavaTimeString(t *testing.T) {
	accepted := []struct {
		in        string
		zone      string
		offsetSec int
	}{
		{"2026-10-31T21:18:55-04:00[America/New_York]", "America/New_York", -4 * 3600},
		{"2026-10-31T21:18:55Z[UTC]", "UTC", 0},
		{"2026-10-31T21:18:55-03:00[America/Asuncion]", "America/Asuncion", -3 * 3600},
		// Legacy/alias names that browsers' Intl may still report.
		{"2026-10-31T21:18:55+05:30[Asia/Calcutta]", "Asia/Calcutta", 5*3600 + 30*60},
		{"2026-10-31T21:18:55+05:45[Asia/Katmandu]", "Asia/Katmandu", 5*3600 + 45*60},
		{"2026-10-31T21:18:55-04:00[US/Eastern]", "US/Eastern", -4 * 3600},
		{"2026-10-31T21:18:55+02:00[Europe/Kiev]", "Europe/Kiev", 2 * 3600},
	}
	for _, tc := range accepted {
		t.Run(tc.in, func(t *testing.T) {
			got, loc, err := parseJavaTimeString(tc.in)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if loc == nil || loc.String() != tc.zone {
				t.Errorf("zone = %v, want %s", loc, tc.zone)
			}
			if got.Format("15:04:05") != "21:18:55" {
				t.Errorf("wall clock = %s, want 21:18:55", got.Format("15:04:05"))
			}
			if _, off := got.Zone(); off != tc.offsetSec {
				t.Errorf("offset = %d, want %d", off, tc.offsetSec)
			}
		})
	}

	rejected := []string{
		"2026-10-31T21:18:55-04:00[SYSTEM]",
		// Seconds-less strings are not valid RFC 3339.
		"2026-05-01T10:00-04:00[America/New_York]",
	}
	for _, in := range rejected {
		t.Run(in, func(t *testing.T) {
			if _, _, err := parseJavaTimeString(in); err == nil {
				t.Errorf("expected error for %q", in)
			}
		})
	}
}
