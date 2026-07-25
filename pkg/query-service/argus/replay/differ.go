package replay

// Differ provides logic to compare original and replay executions
type Differ struct{}

func NewDiffer() *Differ {
	return &Differ{}
}

// GenerateDiff computes the delta between original and new execution
func (d *Differ) GenerateDiff(original *TraceContext, req *ReplayRequest, newRes *ReplayResult) *DiffResult {
	// A real implementation would use a library like 'github.com/sergi/go-diff/diffmatchpatch'
	// For MVP, we'll return a simple string indicating if it changed.
	diffStr := "No Change"
	if original.OriginalResponse != newRes.NewResponse {
		diffStr = "Content Changed"
	}

	return &DiffResult{
		TraceID:          original.TraceID,
		OriginalPrompt:   original.OriginalPrompt,
		NewPrompt:        req.NewPrompt,
		ResponseDiff:     diffStr,
		LatencyDeltaMs:   newRes.LatencyMs - original.LatencyMs,
		CostDelta:        newRes.Cost - original.Cost,
		OriginalResponse: original.OriginalResponse,
		NewResponse:      newRes.NewResponse,
	}
}
