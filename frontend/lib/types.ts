export type Mode = "friendly" | "casual" | "study";
export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  mode?: Mode;
  isStreaming?: boolean;
  isError?: boolean;
}

export interface HealthResponse {
  status: string;
  model: string;
}

export interface ChatRequest {
  message: string;
  mode: Mode;
}
