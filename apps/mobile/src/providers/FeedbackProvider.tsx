import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface FeedbackContextValue {
  message: string | null;
  showMessage: (message: string) => void;
  clearMessage: () => void;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const showMessage = useCallback((next: string) => setMessage(next), []);
  const clearMessage = useCallback(() => setMessage(null), []);
  const value = useMemo(() => ({ message, showMessage, clearMessage }), [message, showMessage, clearMessage]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used inside FeedbackProvider");
  return value;
}
