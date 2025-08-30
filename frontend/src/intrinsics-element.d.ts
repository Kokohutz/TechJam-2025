// types/lynx-input.d.ts
import * as Lynx from "@lynx-js/types";

declare module "@lynx-js/types" {
  interface IntrinsicElements extends Lynx.IntrinsicElements {
    input: {
      // Event handlers
      bindinput?: (e: { type: "input"; detail: { value: string } }) => void;
      bindtouchstart?: (e?: any) => void;
      bindtouchend?: (e?: any) => void;
      bindtouchmove?: (e?: any) => void;
      bindtouchcancel?: (e?: any) => void;
      bindtap?: (e?: any) => void;
      bindfocus?: (e?: any) => void;
      bindblur?: (e?: any) => void;
      bindchange?: (e: { type: "change"; detail: { value: string } }) => void;
      bindkeydown?: (e?: any) => void;
      bindkeyup?: (e?: any) => void;
      
      // Input properties
      value?: string;
      placeholder?: string;
      disabled?: boolean;
      readonly?: boolean;
      maxlength?: number;
      minlength?: number;
      type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search';
      
      // Styling and layout
      style?: string | Lynx.CSSProperties;
      className?: string;
      
      // Common HTML attributes
      id?: string;
      name?: string;
      required?: boolean;
      pattern?: string;
      
      // Auto properties for mobile
      autocomplete?: string;
      autocorrect?: boolean;
      autocapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      spellcheck?: boolean;
      
      // Mobile keyboard types
      inputmode?: 'none' | 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
      
      // Accessibility
      'accessibility-label'?: string;
      'accessibility-hint'?: string;
      'accessibility-role'?: string;
      'accessibility-element'?: boolean;
      
      // Form related
      form?: string;
      
      // Selection
      selectionstart?: number;
      selectionend?: number;
      
      // Additional Lynx-specific properties
      'auto-focus'?: boolean;
      'cursor-spacing'?: number;
      'confirm-type'?: 'send' | 'search' | 'next' | 'go' | 'done';
      'confirm-hold'?: boolean;
      'hold-keyboard'?: boolean;
      'adjust-position'?: boolean;
      'auto-blur'?: boolean;
    };
  }
}