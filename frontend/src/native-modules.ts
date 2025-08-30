// In a new file, e.g., 'native-modules.ts'

export interface ImagePickerResponse {
    /**
     * Base64 encoded string of the image data.
     */
    base64?: string;
    /**
     * The URI of the image on the device.
     */
    uri?: string;
    /**
     * An error message if the operation failed.
     */
    error?: string;
}

export interface NativeImagePicker {
    /**
     * Opens the device's image gallery to select an image.
     * @returns A promise that resolves with an ImagePickerResponse object.
     */
    pickImage(): Promise<ImagePickerResponse>;
}

// // This is a hypothetical way to access the native module
// declare global {
//     const NativeModules: {
//         ImagePicker: NativeImagePicker;
//     };
// }