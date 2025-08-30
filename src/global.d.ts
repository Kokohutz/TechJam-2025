// Import the interfaces you defined
import { NativeImagePicker } from './native-modules';

// Declare the global variable that Lynx will provide
declare global {
  const NativeModules: {
    ImagePicker: NativeImagePicker;
  };
}