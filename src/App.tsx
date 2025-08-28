// src/App.tsx
import { useCallback, useEffect, useState, root } from "@lynx-js/react";
import "./App.css";
// import "./global.d.ts";
// import {Input, Button} from  'antd';
// import { Input, Button } from 'antd';


export const App = (props: { onRender?: () => void }) => {
  const [inputContent, setInputContent] = useState("");

  useEffect(() => {
    console.info("Hello, ReactLynx");
    props.onRender?.();
  }, []);

  const onSend = useCallback(() => {
    const msg = inputContent.trim();
    if (!msg) return;
    console.info("send:", msg);
    setInputContent("");
  }, [inputContent]);

  return (
    <view
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0f0f0f",
      }}
    >
      {/* Empty main area (no scroll list) */}
      <view style={{ flex: 1 }} />

      {/* Bottom composer */}
      <view
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60px",
          padding: "10px",
          backgroundColor: "#111111cc",
          borderTop: "1px solid #222",
        }}
      >
        <view
          style={{
            linearOrientation: "horizontal",
            width: "100%",
            height: "100%",
            gap: "10px",
          }}
        >
          {/* <Input
            placeholder="Type a message…"
            value={inputContent}
            // bindinput={(e: any) => setInputContent(e.detail.value)}
            style={{
              flex: 1,
              height: "100%",
              padding: "0 12px",
              fontSize: "16px",
              color: "#fff",
              backgroundColor: "#222",
              borderRadius: "12px",
            }}
          /> */}
          {/* <Button
            // bindtap={onSend}
            style={{
              height: "100%",
              padding: "0 16px",
              borderRadius: "12px",
              backgroundColor: inputContent.trim() ? "#4a8cff" : "#2a2a2a",
              color: inputContent.trim() ? "#000" : "#777",
              fontSize: "16px",
              fontWeight: 600,
            }}
          >
            Send
          </Button> */}
        </view>
      </view>
    </view>
  );
}

// root.render(<App />);

// if (import.meta.webpackHot) {
//   import.meta.webpackHot.accept();
// }