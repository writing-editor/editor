# Mobile Development Guide

This project is configured with [Capacitor](https://capacitorjs.com/) to build for Android.

## Prerequisites

1.  **Android Studio**: Download and install from [developer.android.com](https://developer.android.com/studio).
2.  **Android SDK**: Installed via Android Studio. Ensure you have the latest SDK tools.

## Running on Android

1.  **Open in Android Studio**:
    ```bash
    cd frontend
    npx cap open android
    ```
    This will launch Android Studio with the project loaded.

2.  **Run on Device/Emulator**:
    - Connect your Android device via USB (enable USB Debugging in Developer Options).
    - Or create an Android Emulator in Android Studio.
    - Click the **Run** button (green play icon) in Android Studio.

## Updating the App

If you make changes to the web code (React/JS/CSS), you need to rebuild and sync:

```bash
cd frontend
npm run build:android
```

Then run the app again from Android Studio.
