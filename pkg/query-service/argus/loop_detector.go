package argus

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

type LoopDetector struct {
	MaxRepeats int
}

func NewLoopDetector(maxRepeats int) *LoopDetector {
	return &LoopDetector{
		MaxRepeats: maxRepeats,
	}
}

// Fingerprint generates an Agent DNA hash based on tool sequence
func (ld *LoopDetector) Fingerprint(toolSequence []string) string {
	hasher := sha256.New()
	hasher.Write([]byte(strings.Join(toolSequence, ",")))
	return hex.EncodeToString(hasher.Sum(nil))[:8]
}

// Detect checks if the tool sequence indicates an infinite loop
func (ld *LoopDetector) Detect(toolSequence []string) bool {
	if len(toolSequence) < ld.MaxRepeats {
		return false
	}
	
	// Simple detection: check if the last N tools are identical
	last := toolSequence[len(toolSequence)-1]
	repeats := 1
	for i := len(toolSequence) - 2; i >= 0; i-- {
		if toolSequence[i] == last {
			repeats++
			if repeats >= ld.MaxRepeats {
				return true
			}
		} else {
			break
		}
	}
	
	return false
}
