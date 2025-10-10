# AI Creative Suite

The AI Creative Suite is a comprehensive, browser-based application designed for creative interaction with generative AI models. It features a retro Windows-inspired UI and a collection of powerful, interconnected tools for text, image, and chat-based creation. All user data, including conversations, generated images, and personal settings, is stored locally in your browser's IndexedDB.

## Core Features

- **Retro UI:** A draggable, resizable, and maximizable window with a classic tab-based interface for easy navigation between tools.
- **Local-First Data Storage:** All your creations, buddy lists, conversations, and settings are saved directly in your browser, ensuring privacy and offline access to your data.
- **Centralized API Management:** Efficiently handles all calls to Gemini generative AI models for text, image, and audio generation.
- **Inter-Tool Connectivity:** Seamlessly drag and drop images generated in one tool for use in another, such as using a `Txt2Img` creation as the style reference in the `Composer`.

## Tools

### 1. AIM Client
A fully-featured chat client for conversing with customizable AI "buddies."

- **AI Buddy Management:** Create, define, and manage a list of AI chat partners, each with a unique personality.
- **Persistent Chat Logs:** Conversation history is saved per buddy.
- **Contextual Image Generation:** Use the `/imagine` command to generate an image based on the current conversation context.
- **Proactive Messaging:** AI buddies can be configured to initiate conversations and re-engage after periods of inactivity.
- **Text-to-Speech (TTS):** Enable TTS to have buddy messages read aloud, with a selection of different voices.
- **Data Portability:** Export and import your entire AIM client setup (buddies, conversations, profile) as a single JSON file.

### 2. Text-to-Image Generator (Txt2Img)
A powerful tool for creating images from text prompts.

- **Prompt Assistance:** Includes a "Get Ideas" button for instant inspiration and an "Expand" button to enrich simple prompts with artistic detail.
- **Batch Generation:** Generate multiple images from a single prompt simultaneously.
- **Image Refinement:** Select a generated image and use a new prompt to make iterative changes.
- **Gallery Management:** Each tool features a robust gallery with selection, preview, and a recycle bin for soft-deleting and restoring images.
- **Metadata Embedding:** The text prompt is automatically saved into the metadata of the generated PNG file.

### 3. Image-to-Image (Img2Img)
Modify existing images using text prompts.

- **File Upload:** Upload a PNG to use as a base for modifications.
- **Metadata Reading:** Automatically extracts and populates the prompt from an uploaded PNG if it contains embedded metadata.
- **Dedicated Gallery:** Manages all `Img2Img` creations separately.

### 4. Image Composer
Combine multiple visual elements and a text prompt to create a new, synthesized image.

- **Multi-Modal Input:** Drag and drop images into dedicated "Subject," "Scene," and "Style" zones.
- **Integrated Cropping:** An integrated cropping tool ensures that uploaded or dropped images fit a 1:1 aspect ratio.
- **Text Guidance:** Use an additional text prompt to guide the composition logic.

### 5. Sketchpad
Generate images from your own drawings.

- **Sketch-to-Image:** Draw on a responsive canvas and use a text prompt to turn your sketch into a detailed image.
- **Drawing Tools:** Features controls for brush size and color, an eraser, and a "clear" button.
