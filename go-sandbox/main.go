package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow requests from Next.js frontend
		return true 
	},
}

// Request struct for incoming WS messages
type ExecutionRequest struct {
	Code string `json:"code"`
}

// Response struct for outgoing WS messages
type ExecutionResponse struct {
	Output string `json:"output,omitempty"`
	Error  string `json:"error,omitempty"`
	Status string `json:"status,omitempty"` // "running", "completed", "error"
}

func main() {
	http.HandleFunc("/ws/execute", handleExecution)
	
	port := "8080"
	fmt.Printf("Go Execution Sandbox running on ws://localhost:%s/ws/execute\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}

func handleExecution(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade error:", err)
		return
	}
	defer conn.Close()

	for {
		messageType, p, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		if messageType != websocket.TextMessage {
			continue
		}

		var req ExecutionRequest
		if err := json.Unmarshal(p, &req); err != nil {
			sendError(conn, "Invalid JSON payload")
			continue
		}

		// Tell the client we started
		conn.WriteJSON(ExecutionResponse{Status: "running"})

		// Execute the code
		executePython(conn, req.Code)
		
		// Tell the client we finished
		conn.WriteJSON(ExecutionResponse{Status: "completed"})
	}
}

func executePython(conn *websocket.Conn, code string) {
	// Create a temporary file for the python code
	tmpFile, err := os.CreateTemp("", "sandbox-*.py")
	if err != nil {
		sendError(conn, fmt.Sprintf("Failed to create temp file: %v", err))
		return
	}
	defer os.Remove(tmpFile.Name()) // Clean up after execution

	if _, err := tmpFile.WriteString(code); err != nil {
		sendError(conn, fmt.Sprintf("Failed to write code to temp file: %v", err))
		return
	}
	tmpFile.Close()

	// Set up the Python execution command
	// Note: Assuming python is in PATH. On Windows it might be "python.exe"
	cmd := exec.Command("python", tmpFile.Name())

	// We want to stream both stdout and stderr
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		sendError(conn, fmt.Sprintf("StdoutPipe error: %v", err))
		return
	}

	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		sendError(conn, fmt.Sprintf("StderrPipe error: %v", err))
		return
	}

	if err := cmd.Start(); err != nil {
		sendError(conn, fmt.Sprintf("Failed to start process: %v", err))
		return
	}

	var wg sync.WaitGroup
	wg.Add(2)

	// Stream stdout
	go func() {
		defer wg.Done()
		buf := make([]byte, 1024)
		for {
			n, err := stdoutPipe.Read(buf)
			if n > 0 {
				conn.WriteJSON(ExecutionResponse{Output: string(buf[:n])})
			}
			if err != nil {
				break
			}
		}
	}()

	// Stream stderr
	go func() {
		defer wg.Done()
		buf := make([]byte, 1024)
		for {
			n, err := stderrPipe.Read(buf)
			if n > 0 {
				conn.WriteJSON(ExecutionResponse{Error: string(buf[:n])})
			}
			if err != nil {
				break
			}
		}
	}()

	// Wait for streams to finish
	wg.Wait()

	// Wait for process to exit to prevent zombie processes
	err = cmd.Wait()
	if err != nil {
		// We already streamed stderr, but we can send an exit code notification if needed
		conn.WriteJSON(ExecutionResponse{Error: fmt.Sprintf("\nProcess exited with error: %v", err)})
	}
}

func sendError(conn *websocket.Conn, errMsg string) {
	conn.WriteJSON(ExecutionResponse{Error: errMsg, Status: "error"})
}
