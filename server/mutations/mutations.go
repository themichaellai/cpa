package mutations

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/sirupsen/logrus"
	"github.com/themichaellai/cpa/server/db"
)

var validate *validator.Validate

func init() {
	validate = validator.New()
}

type AddDay struct {
	Date string `json:"date"`
	Id   string `json:"id"`
}

type SetDay struct {
	Date         db.ParsedDate
	Id           string
	WakeUpTime   *time.Time
	WakeUpTimeTz *time.Location
	DinnerSize   *db.DinnerSize
	Comment      *string
}

type SetDayV2 struct {
	Date         db.ParsedDate
	Id           string
	WakeUpTime   *time.Time
	WakeUpTimeTz *time.Location
	DinnerSize   *db.DinnerSize
}

type SetComment struct {
	Date    db.ParsedDate
	Id      string
	Comment *string
}

var timeZoneRegexp = regexp.MustCompile(`^([^[]+)\[(.+)\]$`)

func parseJavaTimeString(s string) (t time.Time, timezone *time.Location, _ error) {
	timeStringMatch := timeZoneRegexp.FindStringSubmatch(s)
	if timeStringMatch == nil {
		return time.Time{}, nil, fmt.Errorf("could not parse time")
	}
	t, err := time.Parse(time.RFC3339, timeStringMatch[1])
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("invalid time format: %w", err)
	}
	loc, err := time.LoadLocation(timeStringMatch[2])
	if err != nil {
		return time.Time{}, nil, fmt.Errorf("invalid timezone: %w", err)
	}
	return t, loc, nil
}

func ParseSetDay(log *logrus.Logger, bs []byte) (SetDay, error) {
	type setDayRaw struct {
		Date   string `json:"date"`
		Id     string `json:"id"`
		WakeUp *struct {
			Time *string `json:"time"`
		} `json:"wakeUp"`
		Dinner *struct {
			Size *string `json:"size"`
		} `json:"dinner"`
		Comment *string `json:"comment"`
	}
	var args setDayRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal set wake up args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return SetDay{}, fmt.Errorf("%s: %w", msg, err)
	}
	var wakeUpTime *time.Time
	var wakeUpTimeTz *time.Location
	if args.WakeUp != nil && args.WakeUp.Time != nil {
		t, tz, err := parseJavaTimeString(*args.WakeUp.Time)
		if err != nil {
			return SetDay{}, fmt.Errorf("could not parse wake up: %w", err)
		}
		log.WithFields(logrus.Fields{
			"time": t.Format(time.RFC3339),
			"tz":   tz.String(),
		}).Info("parsed wake up time")
		wakeUpTime = &t
		wakeUpTimeTz = tz
	}
	var dinnerSize *db.DinnerSize
	if args.Dinner != nil && args.Dinner.Size != nil {
		dinnerSizeParsed, dinnerSizeOk := db.ParseToDinnerSize(*args.Dinner.Size)
		if !dinnerSizeOk {
			return SetDay{}, fmt.Errorf("invalid dinner size: %s", *args.Dinner.Size)
		}
		dinnerSize = &dinnerSizeParsed
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return SetDay{}, err
	}
	return SetDay{
		Date:         date,
		Id:           args.Id,
		WakeUpTime:   wakeUpTime,
		WakeUpTimeTz: wakeUpTimeTz,
		DinnerSize:   dinnerSize,
		Comment:      args.Comment,
	}, nil
}

func ParseSetDayV2(log *logrus.Logger, bs []byte) (SetDayV2, error) {
	type setDayV2Raw struct {
		Date   string `json:"date"`
		Id     string `json:"id"`
		WakeUp *struct {
			Time *string `json:"time"`
		} `json:"wakeUp"`
		Dinner *struct {
			Size *string `json:"size"`
		} `json:"dinner"`
	}
	var args setDayV2Raw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal set day v2 args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return SetDayV2{}, fmt.Errorf("%s: %w", msg, err)
	}
	var wakeUpTime *time.Time
	var wakeUpTimeTz *time.Location
	if args.WakeUp != nil && args.WakeUp.Time != nil {
		t, tz, err := parseJavaTimeString(*args.WakeUp.Time)
		if err != nil {
			return SetDayV2{}, fmt.Errorf("could not parse wake up: %w", err)
		}
		log.WithFields(logrus.Fields{
			"time": t.Format(time.RFC3339),
			"tz":   tz.String(),
		}).Info("parsed wake up time")
		wakeUpTime = &t
		wakeUpTimeTz = tz
	}
	var dinnerSize *db.DinnerSize
	if args.Dinner != nil && args.Dinner.Size != nil {
		dinnerSizeParsed, dinnerSizeOk := db.ParseToDinnerSize(*args.Dinner.Size)
		if !dinnerSizeOk {
			return SetDayV2{}, fmt.Errorf("invalid dinner size: %s", *args.Dinner.Size)
		}
		dinnerSize = &dinnerSizeParsed
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return SetDayV2{}, err
	}
	return SetDayV2{
		Date:         date,
		Id:           args.Id,
		WakeUpTime:   wakeUpTime,
		WakeUpTimeTz: wakeUpTimeTz,
		DinnerSize:   dinnerSize,
	}, nil
}

func ParseSetComment(log *logrus.Logger, bs []byte) (SetComment, error) {
	type setCommentRaw struct {
		Date    string  `json:"date"`
		Id      string  `json:"id"`
		Comment *string `json:"comment"`
	}
	var args setCommentRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal set comment args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return SetComment{}, fmt.Errorf("%s: %w", msg, err)
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return SetComment{}, err
	}
	return SetComment{
		Date:    date,
		Id:      args.Id,
		Comment: args.Comment,
	}, nil
}

type AddPoop struct {
	PoopId string
	DayId  string
	Date   db.ParsedDate
	Time   time.Time
	TimeTz *time.Location
}

func newJsonDecoder(bs []byte) *json.Decoder {
	decoder := json.NewDecoder(bytes.NewReader(bs))
	decoder.DisallowUnknownFields()
	return decoder
}

func ParseAddPoop(log *logrus.Logger, bs []byte) (AddPoop, error) {
	type mutationAddPoopRaw struct {
		PoopId string `json:"poopId" validate:"required"`
		DayId  string `json:"id" validate:"required"`
		Date   string `json:"date" validate:"required"`
		Time   string `json:"time" validate:"required"`
	}
	var args mutationAddPoopRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal add poop args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return AddPoop{}, fmt.Errorf("%s: %w", msg, err)
	}
	if err := validate.Struct(args); err != nil {
		return AddPoop{}, fmt.Errorf("invalid add poop args: %w", err)
	}
	t, tz, err := parseJavaTimeString(args.Time)
	if err != nil {
		return AddPoop{}, fmt.Errorf("could not parse time: %w", err)
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return AddPoop{}, err
	}
	return AddPoop{
		DayId:  args.DayId,
		PoopId: args.PoopId,
		Date:   date,
		Time:   t,
		TimeTz: tz,
	}, nil
}

type SetPoop struct {
	PoopId string
	DayId  string
	Date   db.ParsedDate
	Time   time.Time
	TimeTz *time.Location
	OnRun  bool
}

func ParseSetPoop(log *logrus.Logger, bs []byte) (SetPoop, error) {
	type mutationSetPoopRaw struct {
		PoopId string `json:"poopId" validate:"required"`
		DayId  string `json:"id" validate:"required"`
		Date   string `json:"date" validate:"required"`
		Time   string `json:"time" validate:"required"`
		OnRun  bool   `json:"onRun"`
	}
	var args mutationSetPoopRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal set poop args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return SetPoop{}, fmt.Errorf("%s: %w", msg, err)
	}

	if err := validate.Struct(args); err != nil {
		msg := "invalid set poop args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return SetPoop{}, fmt.Errorf("%s: %w", msg, err)
	}
	t, tz, err := parseJavaTimeString(args.Time)
	if err != nil {
		return SetPoop{}, fmt.Errorf("could not parse time: %w", err)
	}
	date, err := db.ParseDateFromString(args.Date)
	if err != nil {
		return SetPoop{}, err
	}
	return SetPoop{
		DayId:  args.DayId,
		PoopId: args.PoopId,
		Date:   date,
		Time:   t,
		TimeTz: tz,
		OnRun:  args.OnRun,
	}, nil
}

type RemovePoop struct {
	PoopId string
	DayId  string
}

func ParseRemovePoop(log *logrus.Logger, bs []byte) (RemovePoop, error) {
	type removePoopRaw struct {
		PoopId string `json:"poopId" validate:"required"`
		DayId  string `json:"id" validate:"required"`
	}
	var args removePoopRaw
	if err := newJsonDecoder(bs).Decode(&args); err != nil {
		msg := "could not unmarshal remove poop args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return RemovePoop{}, fmt.Errorf("%s: %w", msg, err)
	}
	if err := validate.Struct(args); err != nil {
		msg := "invalid remove poop args"
		log.WithFields(logrus.Fields{
			"args": string(bs),
		}).Error(msg)
		return RemovePoop{}, fmt.Errorf("%s: %w", msg, err)
	}
	return RemovePoop(args), nil
}
