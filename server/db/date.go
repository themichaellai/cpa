package db

import (
	"fmt"
	"regexp"
)

type ParsedDate string

var dateRegexp = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

func ParseDateFromString(s string) (ParsedDate, error) {
	if !dateRegexp.MatchString(s) {
		return "", fmt.Errorf("invalid date format: \"%s\"", s)
	}
	return ParsedDate(s), nil
}
