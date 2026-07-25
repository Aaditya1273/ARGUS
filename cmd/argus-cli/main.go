package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/spf13/cobra"
)

// ReplayRequest must match the backend struct
type ReplayRequest struct {
	TraceID   string
	NewPrompt string
	Model     string
}

// DiffResult must match the backend struct
type DiffResult struct {
	TraceID          string
	OriginalPrompt   string
	NewPrompt        string
	ResponseDiff     string
	LatencyDeltaMs   int64
	CostDelta        float64
	OriginalResponse string
	NewResponse      string
}

func main() {
	var rootCmd = &cobra.Command{
		Use:   "argus-cli",
		Short: "ARGUS CLI - AI Runtime Governance and Utility System",
		Long:  `A command line tool for ARGUS. Inspect traces, replay prompts, and enforce governance rules.`,
	}

	var editFlag string

	var replayCmd = &cobra.Command{
		Use:   "replay [trace_id]",
		Short: "Replay a trace with a modified prompt",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			traceID := args[0]
			fmt.Printf("Reconstructing trace %s...\n", traceID)

			// 1. Fetch trace context (Mocked API call)
			resp, err := http.Get(fmt.Sprintf("http://localhost:8080/api/v1/argus/replay/%s", traceID))
			if err != nil || resp.StatusCode != 200 {
				log.Fatalf("Failed to fetch trace context. Ensure ARGUS backend is running.")
			}
			defer resp.Body.Close()
			
			// For simplicity in CLI, if the user provided an edit string directly
			newPrompt := "You are a helpful assistant. Please summarize this text."
			if editFlag != "" {
				newPrompt = editFlag
			}

			fmt.Println("\nExecuting Prompt Replay...")
			
			reqBody := ReplayRequest{
				TraceID:   traceID,
				NewPrompt: newPrompt,
			}
			b, _ := json.Marshal(reqBody)

			// 2. Execute replay
			execResp, err := http.Post("http://localhost:8080/api/v1/argus/replay/execute", "application/json", bytes.NewBuffer(b))
			if err != nil || execResp.StatusCode != 200 {
				log.Fatalf("Failed to execute replay.")
			}
			defer execResp.Body.Close()

			var diff DiffResult
			body, _ := io.ReadAll(execResp.Body)
			json.Unmarshal(body, &diff)

			fmt.Println("\n==================================")
			fmt.Println("         REPLAY RESULTS           ")
			fmt.Println("==================================")
			fmt.Printf("Trace ID:       %s\n", diff.TraceID)
			fmt.Printf("Semantic Diff:  %s\n", diff.ResponseDiff)
			fmt.Printf("Latency Impact: %d ms\n", diff.LatencyDeltaMs)
			fmt.Printf("Cost Impact:    $%.4f\n\n", diff.CostDelta)
			fmt.Println("--- Original Output ---")
			fmt.Println(diff.OriginalResponse)
			fmt.Println("\n--- New Simulated Output ---")
			fmt.Println(diff.NewResponse)
			fmt.Println("==================================")
		},
	}

	replayCmd.Flags().StringVarP(&editFlag, "edit", "e", "", "Pass a new prompt string to execute")
	rootCmd.AddCommand(replayCmd)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
