# 3D Digital Human Component for React

This package provides a self-contained, interactive 3D avatar component for React, powered by `@react-three/fiber` and Google's Gemini API for Text-to-Speech (TTS). It's designed to be easily integrated into any React application to provide an engaging, animated character that can speak responses.

## Features

-   **Ready to Use:** Renders a default 3D avatar out of the box.
-   **Customizable:** Supports loading custom `.glb` models and custom backgrounds (colors, images, or 360° HDRI files).
-   **Text-to-Speech:** Converts text into audible speech with corresponding lip-sync animations using the Gemini API.
-   **Direct Audio Playback:** Can play raw audio streams (e.g., from a live voice API) with lip-syncing.
-   **Procedural Animation:** Features natural idle animations like breathing, blinking, and subtle gestures.
-   **Simple API:** Control the avatar's speech and appearance through a straightforward props interface.

## Installation & Setup

Ensure your project has the following peer dependencies installed:

```bash
npm install react react-dom three @react-three/fiber @react-three/drei @google/genai
```

## Basic Usage

Import the `DigitalHuman` component and provide it with a Google AI API key. It will load a default model automatically. You can make the avatar speak by updating the `textToSpeak` prop.

```jsx
import React, 'useState';
import { DigitalHuman } from './components/DigitalHuman';

function MyAvatarApp() {
  const [responseText, setResponseText] = useState('');
  const [background, setBackground] = useState({ type: 'color', value: '#6a8c9a' });

  const handleButtonClick = () => {
    // In a real app, you would get this text from your LLM
    setResponseText(`Hello! This is the Digital Human component. I can speak any text you provide.`);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DigitalHuman
        apiKey={process.env.YOUR_API_KEY}
        background={background}
        textToSpeak={responseText}
      />
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 10 }}>
        <button onClick={handleButtonClick}>
          Make Avatar Speak
        </button>
        <button onClick={() => setBackground({ type: 'hdri', value: 'path/to/your/environment.hdr' })}>
          Change Environment
        </button>
      </div>
    </div>
  );
}
```

## Props API

| Prop               | Type                                                                                  | Required | Description                                                                                                                                              |
| :----------------- | :------------------------------------------------------------------------------------ | :------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`           | `string`                                                                              | **Yes**  | Your Google AI API Key, required for the Text-to-Speech functionality.                                                                                   |
| `modelUrl`         | `string`                                                                              | No       | The URL of a `.glb` 3D model file. If not provided, it defaults to the included `default.glb` model.                                                    |
| `background`       | `{ type: 'color' \| 'image' \| 'hdri', value: string }`                                  | **Yes**  | An object defining the scene background. `value` should be a hex code for 'color', or a URL for 'image' and 'hdri'.                                    |
| `textToSpeak`      | `string`                                                                              | No       | When this prop receives a new string value, the component triggers its internal TTS engine and speaks the text.                                          |
| `audioToPlay`      | `string`                                                                              | No       | A base64-encoded string of raw PCM audio data. Plays the audio and lip-syncs. Useful for streaming audio from an external voice API.                        |
| `className`        | `string`                                                                              | No       | Optional CSS classes to apply to the root container `div` of the component, allowing you to control its size and positioning (e.g., `w-full h-full`).      |
| `onReady`          | `(controls) => void`                                                                  | No       | Callback function that fires when the avatar model is loaded and its controls (animations, morphs, bones) are ready.                                     |
| `isDebuggingBones` | `boolean`                                                                             | No       | Set to `true` to freeze procedural animations, allowing manual bone manipulation via controls exposed by `onReady`. Defaults to `false`.                  |

## Integration Examples

### 1. Text Chat with an External LLM

The `DigitalHuman` component does not include a chat UI. You build the UI and manage the conversation state in your parent application. When your LLM provides a text response, you pass it to the avatar.

```jsx
function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [textForAvatar, setTextForAvatar] = useState('');

  async function handleSendMessage(userInput) {
    // 1. Add user message to chat history
    // 2. Call your backend or LLM service with the userInput
    const llmResponseText = await myLLMService.getTextResponse(userInput);
    // 3. Update chat history with LLM response
    // 4. Pass the text to the DigitalHuman component to speak it
    setTextForAvatar(llmResponseText);
  }

  return (
    <div>
      <div className="my-chat-window">
        {/* Your chat bubbles UI */}
      </div>
      <input onSubmit={handleSendMessage} />

      <DigitalHuman
        apiKey="YOUR_API_KEY"
        background={{ type: 'color', value: '#333' }}
        textToSpeak={textForAvatar}
        className="avatar-container"
      />
    </div>
  );
}
```

### 2. Live Voice Conversation

For real-time voice, your service would handle streaming audio from the user to your voice-enabled LLM. The LLM then streams audio responses back, which you can feed directly into the `audioToPlay` prop.

```jsx
function LiveVoiceApp() {
  const [audioChunk, setAudioChunk] = useState('');
  
  useEffect(() => {
    // Connect to your live voice service
    const voiceService = new MyLiveVoiceService({
      onAudioChunkReceived: (base64AudioChunk) => {
        // As audio chunks arrive from the service, pass them to the avatar
        setAudioChunk(base64AudioChunk);
      }
    });
    
    // Don't forget to handle cleanup
    return () => voiceService.disconnect();
  }, []);

  return (
    <DigitalHuman
      apiKey="YOUR_API_KEY"
      background={{ type: 'hdri', value: 'path/to/your/environment.hdr' }}
      audioToPlay={audioChunk}
    />
  );
}
```
