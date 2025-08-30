// In ImagePickerModule.ts

import type { NativeImagePicker, ImagePickerResponse } from './native-modules';

// This is a mock function that simulates picking an image.
// It returns a promise with a fake image URL after a short delay.
const mockPickImage = (): Promise<ImagePickerResponse> => {
  console.log('Using MOCK ImagePicker. In a real device, this would open the gallery.');
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        // You can use a placeholder image service for testing
        uri: `https://picsum.photos/400/300?random=${Date.now()}`,
        // In a real scenario, you'd get a base64 string. We'll leave it empty for the mock.
        base64: undefined, 
      });
    }, 500); // Simulate user selection time
  });
};

// Check if the real NativeModules and ImagePicker exist.
// If not, use the mock implementation.
const ImagePicker: NativeImagePicker = 
  (typeof NativeModules !== 'undefined' && NativeModules.ImagePicker)
    ? NativeModules.ImagePicker
    : { pickImage: mockPickImage };

export default ImagePicker;