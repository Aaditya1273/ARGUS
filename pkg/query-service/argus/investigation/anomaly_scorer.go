package investigation

import (
	"math"
	"time"
)

// SeasonalityType defines the seasonality mode for anomaly detection.
// Maps directly to SigNoz's anomaly detection seasonality options.
type SeasonalityType string

const (
	SeasonalityHourly SeasonalityType = "hourly"
	SeasonalityDaily  SeasonalityType = "daily"
	SeasonalityWeekly SeasonalityType = "weekly"
)

// ZScoreThreshold defines anomaly sensitivity.
// Maps directly to SigNoz's z-score threshold tuning:
//   - Conservative: 4.0 (fewer alerts)
//   - Balanced: 3.0 (default)
//   - Sensitive: 2.5 (more alerts)
//   - Very Sensitive: 2.0 (most alerts)
type ZScoreThreshold float64

const (
	ZScoreConservative    ZScoreThreshold = 4.0
	ZScoreBalanced       ZScoreThreshold = 3.0
	ZScoreSensitive      ZScoreThreshold = 2.5
	ZScoreVerySensitive  ZScoreThreshold = 2.0
)

// DetectionCondition mirrors SigNoz alert condition operators.
type DetectionCondition string

const (
	ConditionAbove      DetectionCondition = "above"
	ConditionBelow      DetectionCondition = "below"
	ConditionAboveBelow DetectionCondition = "above_or_below"
)

// MatchType mirrors SigNoz alert match types.
type MatchType string

const (
	MatchAtLeastOnce MatchType = "at_least_once"
	MatchAllTheTimes MatchType = "all_the_times"
	MatchOnAverage   MatchType = "on_average"
	MatchInTotal     MatchType = "in_total"
	MatchLast        MatchType = "last"
)

// SigNozAnomalyScorer implements the exact seasonal decomposition algorithm
// that SigNoz uses for anomaly detection. Based on the SigNoz documentation:
//
//	prediction = moving_avg(past_period) + avg(current_season) - mean(past_seasons)
//	anomaly_score = |actual - predicted| / stddev(current_season)
//
// If anomaly_score > z_score_threshold, anomaly is detected.
type SigNozAnomalyScorer struct {
	seasonality  SeasonalityType
	threshold    ZScoreThreshold
	condition    DetectionCondition
	matchType    MatchType
}

// NewSigNozAnomalyScorer creates a scorer with SigNoz's default parameters.
func NewSigNozAnomalyScorer() *SigNozAnomalyScorer {
	return &SigNozAnomalyScorer{
		seasonality: SeasonalityHourly,
		threshold:   ZScoreBalanced,
		condition:   ConditionAboveBelow,
		matchType:   MatchAtLeastOnce,
	}
}

// WithSeasonality sets the seasonality mode.
func (s *SigNozAnomalyScorer) WithSeasonality(st SeasonalityType) *SigNozAnomalyScorer {
	s.seasonality = st
	return s
}

// WithThreshold sets the z-score threshold.
func (s *SigNozAnomalyScorer) WithThreshold(t ZScoreThreshold) *SigNozAnomalyScorer {
	s.threshold = t
	return s
}

// WithCondition sets the detection condition.
func (s *SigNozAnomalyScorer) WithCondition(c DetectionCondition) *SigNozAnomalyScorer {
	s.condition = c
	return s
}

// WithMatchType sets how the condition is evaluated.
func (s *SigNozAnomalyScorer) WithMatchType(m MatchType) *SigNozAnomalyScorer {
	s.matchType = m
	return s
}

// AnomalyResult holds the output of anomaly detection.
type AnomalyResult struct {
	IsAnomaly     bool    `json:"is_anomaly"`
	AnomalyScore  float64 `json:"anomaly_score"`
	PredictedValue float64 `json:"predicted_value"`
	ActualValue   float64 `json:"actual_value"`
	ZScoreThreshold float64 `json:"z_score_threshold"`
	Seasonality   string  `json:"seasonality"`
	// How many standard deviations from the predicted value
	StdDevCurrentSeason float64 `json:"stddev_current_season"`
}



// Evaluate computes the anomaly score for a single value using seasonal decomposition.
// All input slices (pastPeriodValues, currentSeasonValues, pastSeasonValues) must be
// non-empty. Returns nil if any slice is empty.
//
// This implements SigNoz's exact algorithm:
//
//	prediction = moving_avg(past_period) + avg(current_season) - mean(past_seasons)
//	score = |actual - prediction| / stddev(current_season)
func (s *SigNozAnomalyScorer) Evaluate(actualValue float64, pastPeriodValues, currentSeasonValues, pastSeasonValues []float64) *AnomalyResult {
	// Validate inputs: all slices must be non-empty
	if len(pastPeriodValues) == 0 || len(currentSeasonValues) == 0 || len(pastSeasonValues) == 0 {
		return nil
	}

	// Step 1: Calculate moving average of the past period
	movingAvg := mean(pastPeriodValues)

	// Step 2: Calculate average of the current season
	currentSeasonAvg := mean(currentSeasonValues)

	// Step 3: Calculate mean of past seasons
	pastSeasonsMean := mean(pastSeasonValues)

	// Step 4: Prediction = moving_avg + current_season_avg - past_seasons_mean
	prediction := movingAvg + currentSeasonAvg - pastSeasonsMean

	// Step 5: Standard deviation of current season (population stddev, dividing by n)
	stddev := stdDev(currentSeasonValues)
	if stddev == 0 {
		stddev = 1.0 // avoid division by zero; flat signal means any deviation is notable
	}

	// Step 6: Anomaly score = |actual - prediction| / stddev
	score := math.Abs(actualValue-prediction) / stddev

	// Step 7: Determine if anomaly based on condition
	isAnomaly := false
	switch s.condition {
	case ConditionAbove:
		isAnomaly = (actualValue > prediction) && (score > float64(s.threshold))
	case ConditionBelow:
		isAnomaly = (actualValue < prediction) && (score > float64(s.threshold))
	case ConditionAboveBelow:
		isAnomaly = score > float64(s.threshold)
	}

	return &AnomalyResult{
		IsAnomaly:           isAnomaly,
		AnomalyScore:        round2(score),
		PredictedValue:      round2(prediction),
		ActualValue:         round2(actualValue),
		ZScoreThreshold:     float64(s.threshold),
		Seasonality:         string(s.seasonality),
		StdDevCurrentSeason: round2(stddev),
	}
}

// EvaluateMultiple evaluates multiple data points for anomaly and applies
// the configured match type to determine the final result.
func (s *SigNozAnomalyScorer) EvaluateMultiple(values []float64, pastPeriodValues, currentSeasonValues, pastSeasonValues []float64) *AggregateAnomalyResult {
	results := make([]*AnomalyResult, 0, len(values))
	anomalyCount := 0

	for _, v := range values {
		result := s.Evaluate(v, pastPeriodValues, currentSeasonValues, pastSeasonValues)
		if result == nil {
			continue
		}
		results = append(results, result)
		if result.IsAnomaly {
			anomalyCount++
		}
	}

	// Apply match type logic
	var finalDecision bool
	switch s.matchType {
	case MatchAtLeastOnce:
		finalDecision = anomalyCount > 0
	case MatchAllTheTimes:
		finalDecision = anomalyCount == len(values)
	case MatchOnAverage:
		avgValue := mean(values)
		avgResult := s.Evaluate(avgValue, pastPeriodValues, currentSeasonValues, pastSeasonValues)
		finalDecision = avgResult.IsAnomaly
	case MatchInTotal:
		total := sum(values)
		totalResult := s.Evaluate(total, pastPeriodValues, currentSeasonValues, pastSeasonValues)
		finalDecision = totalResult.IsAnomaly
	case MatchLast:
		if len(values) > 0 {
			lastResult := s.Evaluate(values[len(values)-1], pastPeriodValues, currentSeasonValues, pastSeasonValues)
			finalDecision = lastResult.IsAnomaly
		}
	}

	return &AggregateAnomalyResult{
		Results:       results,
		AnomalyCount:  anomalyCount,
		TotalCount:    len(values),
		IsAnomaly:     finalDecision,
		MatchType:     string(s.matchType),
		MaxScore:      maxScore(results),
	}
}

// AggregateAnomalyResult holds the aggregate result from evaluating multiple points.
type AggregateAnomalyResult struct {
	Results      []*AnomalyResult `json:"results"`
	AnomalyCount int              `json:"anomaly_count"`
	TotalCount   int              `json:"total_count"`
	IsAnomaly    bool             `json:"is_anomaly"`
	MatchType    string           `json:"match_type"`
	MaxScore     float64          `json:"max_score"`
}

// GetSeasonWindow returns the time window sizes for the configured seasonality.
// Maps directly to SigNoz's window breakdown:
//
//	Hourly: PastPeriod=5min, CurrentSeason=1h, PastSeasons=3x1h
//	Daily: PastPeriod=5min, CurrentSeason=24h, PastSeasons=3x24h
//	Weekly: PastPeriod=5min, CurrentSeason=7d, PastSeasons=3x7d
func (s *SigNozAnomalyScorer) GetSeasonWindow() SeasonWindow {
	switch s.seasonality {
	case SeasonalityHourly:
		return SeasonWindow{
			PastPeriodDuration:    5 * time.Minute,
			CurrentSeasonDuration: 1 * time.Hour,
			PastSeasonDuration:    1 * time.Hour,
			PastSeasonCount:       3,
			Description:           "hourly",
		}
	case SeasonalityDaily:
		return SeasonWindow{
			PastPeriodDuration:    5 * time.Minute,
			CurrentSeasonDuration: 24 * time.Hour,
			PastSeasonDuration:    24 * time.Hour,
			PastSeasonCount:       3,
			Description:           "daily",
		}
	case SeasonalityWeekly:
		return SeasonWindow{
			PastPeriodDuration:    5 * time.Minute,
			CurrentSeasonDuration: 7 * 24 * time.Hour,
			PastSeasonDuration:    7 * 24 * time.Hour,
			PastSeasonCount:       3,
			Description:           "weekly",
		}
	default:
		return SeasonWindow{
			PastPeriodDuration:    5 * time.Minute,
			CurrentSeasonDuration: 1 * time.Hour,
			PastSeasonDuration:    1 * time.Hour,
			PastSeasonCount:       3,
			Description:           "hourly",
		}
	}
}

// SeasonWindow defines the time windows for seasonal decomposition.
type SeasonWindow struct {
	PastPeriodDuration    time.Duration `json:"past_period_duration"`
	CurrentSeasonDuration time.Duration `json:"current_season_duration"`
	PastSeasonDuration    time.Duration `json:"past_season_duration"`
	PastSeasonCount       int           `json:"past_season_count"`
	Description           string        `json:"description"`
}

// ZScoreToSeverity maps a z-score threshold to a human-readable sensitivity label.
func ZScoreToSeverity(threshold float64) string {
	switch {
	case threshold >= 4.0:
		return "conservative"
	case threshold >= 3.0:
		return "balanced"
	case threshold >= 2.5:
		return "sensitive"
	default:
		return "very_sensitive"
	}
}

// RecommendThreshold recommends a z-score threshold based on the observed data variance.
func RecommendThreshold(stddev, mean float64) ZScoreThreshold {
	if mean == 0 {
		return ZScoreBalanced
	}
	// If the standard deviation is large relative to the mean, use a higher threshold
	// to avoid false positives
	cv := stddev / math.Abs(mean) // coefficient of variation
	switch {
	case cv > 1.0:
		return ZScoreConservative // high variance - be conservative
	case cv > 0.5:
		return ZScoreBalanced
	case cv > 0.25:
		return ZScoreSensitive
	default:
		return ZScoreVerySensitive // low variance - can be more sensitive
	}
}

// --- Statistical helpers ---

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	s := 0.0
	for _, v := range values {
		s += v
	}
	return s / float64(len(values))
}

func stdDev(values []float64) float64 {
	if len(values) < 2 {
		return 0
	}
	m := mean(values)
	variance := 0.0
	for _, v := range values {
		diff := v - m
		variance += diff * diff
	}
	variance /= float64(len(values))
	return math.Sqrt(variance)
}

func sum(values []float64) float64 {
	s := 0.0
	for _, v := range values {
		s += v
	}
	return s
}

func maxScore(results []*AnomalyResult) float64 {
	max := 0.0
	for _, r := range results {
		if r.AnomalyScore > max {
			max = r.AnomalyScore
		}
	}
	return max
}

// round2 rounds a float64 to 2 decimal places.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}
