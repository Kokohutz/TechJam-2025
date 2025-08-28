// src/App.tsx
import { useCallback, useEffect, useState, useRef, root } from "@lynx-js/react";
import type { NodesRef } from "@lynx-js/types";
import "./App.css";


interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: number;
}

function useKeyboardHeight() {
  const [h, setH] = useState(0);

  useEffect(() => {
    const api: any =
      (globalThis as any).tt ||
      (globalThis as any).wx ||
      (globalThis as any).lynx;

    let cleanups: Array<() => void> = [];

    // A) Preferred: height change callback (WeChat/TikTok)
    if (api?.onKeyboardHeightChange) {
      const handler = (e: any) => {
        const height = Math.max(0, e?.height ?? 0);
        console.log("[KB] onKeyboardHeightChange:", height, e);
        setH(height);
      };
      api.onKeyboardHeightChange(handler);
      cleanups.push(() => api?.offKeyboardHeightChange?.(handler));
    }

    // B) Fallback: show/hide events with last height (some runtimes)
    if (api?.onKeyboardShow) {
      const show = (e: any) => {
        const height = Math.max(0, e?.height ?? 0);
        console.log("[KB] onKeyboardShow:", height, e);
        setH(height || 320); // guess if not provided
      };
      api.onKeyboardShow(show);
      cleanups.push(() => api?.offKeyboardShow?.(show));
    }
    if (api?.onKeyboardHide) {
      const hide = () => {
        console.log("[KB] onKeyboardHide");
        setH(0);
      };
      api.onKeyboardHide(hide);
      cleanups.push(() => api?.offKeyboardHide?.(hide));
    }

    // C) Web fallback (H5)
    if (typeof window !== "undefined" && (window as any).visualViewport) {
      const vv = (window as any).visualViewport;
      const handler = () => {
        const delta = Math.max(0, window.innerHeight - vv.height);
        console.log("[KB] visualViewport delta:", delta);
        setH(Math.round(delta));
      };
      vv.addEventListener("resize", handler);
      vv.addEventListener("scroll", handler);
      handler();
      cleanups.push(() => {
        vv.removeEventListener("resize", handler);
        vv.removeEventListener("scroll", handler);
      });
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return h;
}

function getSafeBottomInset() {
  try {
    const api: any = (globalThis as any).tt || (globalThis as any).wx || (globalThis as any).lynx;
    return api?.getSystemInfoSync?.()?.safeAreaInsets?.bottom ?? 0;
  } catch {
    return 0;
  }
}

function useViewportDelta() {
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).visualViewport) return;
    const vv = (window as any).visualViewport;
    const handler = () => {
      const d = Math.max(0, window.innerHeight - vv.height);
      setDelta(Math.round(d));
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    handler();
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, []);

  return delta; // 0 if not supported
}


export function ChatBar({
  inputContent,
  setInputContent,
  onSend,
}: {
  inputContent: string;
  setInputContent: (v: string) => void;
  onSend: () => void;
}) {
  const kb = useKeyboardHeight();
  const safeBottom = getSafeBottomInset();

  // When keyboard is up, lift the bar by keyboard height; otherwise rest on safe area.
  const viewportDelta = useViewportDelta();
  const [focusLift, setFocusLift] = useState(0);
  const bottomPx = kb > 0 ? kb : safeBottom || focusLift;
  return(

  <view
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: bottomPx,
        padding: "8px",
        backgroundColor: "#111",
        borderTop: "1px solid #222",
        linearOrientation: "horizontal", // row layout
        alignItems: "center",
        gap: "10px",
      }}
      >
      <input
        placeholder="Type a message…"
        value={inputContent}
        bindinput={(e: any) => setInputContent(e.detail.value)}
        style={{
          flex: 1,
          width: "80%",
          height: "40px",
          padding: "0 10px",
          fontSize: "16px",
          color: "#fff",
          backgroundColor: "#222",
          border: "1px solid #333",
          borderRadius: "6px",
        }}
      />
      <view style={{ width: "20px" }} />

      <view
        bindtap={onSend}
        style={{
          height: "40px",
          width: "60px",
          borderRadius: "10px",
          backgroundColor: inputContent.trim() ? "#4a8cff" : "#2a2a2a",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <text style={{ color: "#fff", fontSize: "14px" }}>Send</text>
      </view>
    </view>
    )
}


const MessageBubble = ({ message }: { message: Message }) => {
  const isUser = message.type === 'user';
  
  return (
    <view style={{
      width: "100%",
      padding: "8px 16px",
      linearOrientation: "horizontal",
      justifyContent: isUser ? "flex-end" : "flex-start"
    }}>
      <view style={{
        maxWidth: "80%",
        padding: "12px 16px",
        borderRadius: "18px",
        backgroundColor: isUser ? "#4a8cff" : "#2a2a2a",
        marginLeft: isUser ? "auto" : "0",
        marginRight: isUser ? "0" : "auto"
      }}>
        <text style={{
          color: "#fff",
          fontSize: "16px",
          lineHeight: "20px"
        }}>
          {message.content}
        </text>
      </view>
    </view>
    
  );
};

export const App = (props: { onRender?: () => void }) => {
  const [inputContent, setInputContent] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! How can I help you today?",
      type: "assistant",
      timestamp: Date.now()
    }
  ]);
  const listRef = useRef<NodesRef>(null);

  useEffect(() => {
    console.info("Hello, ReactLynx");
    props.onRender?.();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      listRef.current?.invoke({
        method: "scrollToIndex",
        params: {
          index: messages.length - 1,
          animated: true
        }
      }).exec();
    }, 100);
  }, [messages.length]);

  const onSend = useCallback(() => {
    const msg = inputContent.trim();
    if (!msg) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: msg,
      type: "user",
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputContent("");
    
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Thanks for your message! This is a demo response.",
        type: "assistant",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  }, [inputContent]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <view style={{
      width: "100%",
      height: "100%",
      backgroundColor: "#0f0f0f",
      linearOrientation: "vertical"
    }}>
      <view style={{
        flex: 1,
        width: "100%",
        overflow: "hidden"
      }}>
        <list
          ref={listRef}
          style={{
            width: "100%",
            height: "100%",
            paddingTop: "20px",
            paddingBottom: "200px"
          }}
          list-type="single"
          scroll-orientation="vertical"
        >
          {messages.map((message, index) => (
            <list-item
              key={message.id}
              item-key={message.id}
              estimated-main-axis-size-px={60}
            >
              <MessageBubble message={message} />
            </list-item>
          ))}
        </list>        
      </view>
      <ChatBar
          inputContent={inputContent}
          setInputContent={setInputContent}
          onSend={onSend}
        />
    </view>
  );
};

