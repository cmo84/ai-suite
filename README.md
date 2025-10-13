# AI Creative Suite

## Overview

The AI Creative Suite is a browser-based application designed to run inside the Google Gemini Canvas. It provides a collection of tools for text, image, and chat-based creation in a modern, tab-based interface. All user creations, such as conversations and generated images, are downloadable.

### Core Features
- **Txt2Img**: Create images from text prompts with features for prompt assistance and batch generation.
- **Img2Img**: Modify existing images using text prompts.
- **Image Composer**: Combine multiple images (subject, scene, style) and a text prompt to create a new, synthesized image.
- **Sketchpad**: Draw on a canvas and use a text prompt to turn your sketch into a detailed image.
- **AIM Client**: Chat with customizable AI "buddies" who have unique personalities and persistent chat logs.

## How to Run This Project in Your Own Canvas

Follow these steps to set up and run the AI Creative Suite.

1. **Start a New Chat and Enable Canvas**: Begin a new chat session. Before sending any messages, toggle on the "Canvas" option for that specific chat.

2. **Create a Starter Webpage**: With the Canvas enabled, send the following prompt. This will create a basic interactive webpage in the Canvas editor.

   ```
   create an interactive hello world webpage with just a single button that changes its "press me" label to "hello world" when clicked.  no css, and only that very simple js, nothing else, no title, no nothing
   ```

3. **Replace the Code**: Once the simple "hello world" page is created, select all the code in the editor and delete it. Then, copy the *entire contents* of the `index.html` file from this project and paste it into the now-empty Canvas editor.

The application should now load and run in the preview window.


## Tools

### 1. Text-to-Image Generator (Txt2Img)
A powerful tool for creating images from text prompts.

- **Prompt Assistance:** Includes a "Get Ideas" button for instant inspiration and an "Expand" button to enrich simple prompts with artistic detail.
- **Batch Generation:** Generate multiple images from a single prompt simultaneously.
- **Image Refinement:** Select a generated image and use a new prompt to make iterative changes.
- **Gallery Management:** Each tool features a robust gallery with selection, preview, and a recycle bin for soft-deleting and restoring images.
- **Metadata Embedding:** The text prompt is automatically saved into the metadata of the generated PNG file.

### 2. Image-to-Image (Img2Img)
Modify existing images using text prompts.

- **File Upload:** Upload a PNG to use as a base for modifications.
- **Metadata Reading:** Automatically extracts and populates the prompt from an uploaded PNG if it contains embedded metadata.
- **Dedicated Gallery:** Manages all `Img2Img` creations separately.

### 3. Image Composer
Combine multiple visual elements and a text prompt to create a new, synthesized image.

- **Multi-Modal Input:** Drag and drop images into dedicated "Subject," "Scene," and "Style" zones.
- **Integrated Cropping:** An integrated cropping tool ensures that uploaded or dropped images fit a 1:1 aspect ratio.
- **Text Guidance:** Use an additional text prompt to guide the composition logic.

### 4. Sketchpad
Generate images from your own drawings.

- **Sketch-to-Image:** Draw on a responsive canvas and use a text prompt to turn your sketch into a detailed image.
- **Drawing Tools:** Features controls for brush size and color, an eraser, and a "clear" button.

### 5. AIM Client
A fully-featured chat client for conversing with customizable AI "buddies."

- **AI Buddy Management:** Create, define, and manage a list of AI chat partners, each with a unique personality.
- **Persistent Chat Logs:** Conversation history is saved per buddy.
- **Contextual Image Generation:** Use the `/imagine` command to generate an image based on the current conversation context.
- **Proactive Messaging:** AI buddies can be configured to initiate conversations and re-engage after periods of inactivity.
- **Text-to-Speech (TTS):** Enable TTS to have buddy messages read aloud, with a selection of different voices.
- **Data Portability:** Export and import your entire AIM client setup (buddies, conversations, profile) as a single JSON file.