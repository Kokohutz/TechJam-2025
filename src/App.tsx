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
            paddingBottom: "20px"
          }}
          list-type="vertical"
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

      <view style={{
        height: "80px",
        padding: "10px",
        backgroundColor: "#111111cc",
        borderTop: "1px solid #222",
        linearOrientation: "horizontal",
        alignItems: "center",
        gap: "10px"
      }}>
        <input
          placeholder="Type a message…"
          value={inputContent}
          bindinput={(e: any) => setInputContent(e.detail.value)}
          style={{
            flex: 1,
            height: "44px",
            padding: "0 12px",
            fontSize: "16px",
            color: "#fff",
            backgroundColor: "#222",
            borderRadius: "12px",
            border: "1px solid #333"
          }}
        />
        <view
          bindtap={onSend}
          style={{
            height: "44px",
            width: "60px",
            borderRadius: "12px",
            backgroundColor: inputContent.trim() ? "#4a8cff" : "#2a2a2a",
            linearOrientation: "horizontal",
            justifyContent: "center",
            alignItems: "center"
          }}
        >
          <text style={{
            color: inputContent.trim() ? "#000" : "#777",
            fontSize: "16px",
            fontWeight: "600"
          }}>
            Send
          </text>
        </view>
      </view>
    </view>
  );
};