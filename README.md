# GenTeach AI

 Welcome to GenTeach, a comprehensive, AI-driven ecosystem designed to revolutionize how we approach educational content. In a digital world saturated with generic and often overly complex information, GenTeach emerges as your personal creative co-pilot, dedicated to crafting learning materials that are as unique as your curiosity.

This full-stack platform provides a seamless, end-to-end experience, transforming simple user prompts into a diverse suite of high-quality, tailor-made educational assets. Whether you're an educator designing a lesson plan, a student seeking a simpler explanation, or a lifelong learner exploring a new topic, GenTeach puts the power of a content studio at your fingertips. From instantly materialized video scripts and engaging interactive quizzes to clear audio summaries and complete short-form videos, our mission is to eliminate the friction of creation and empower you to build the direct, purposeful, and personalized learning content you've always searched for.

---

## Table of Contents

- [About The Project](#about-the-project)
- [Demo & Screenshots](#demo--screenshots)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Roadmap](#roadmap)
- [Contact](#contact)

---

## About The Project

Tired of searching through long, complex videos on YouTube for a simple explanation? GenTeach was built to solve that problem. This platform empowers users to become creators by generating their own bite-sized, easy-to-digest educational content on any topic.

Whether you need a script for a presentation, a quick quiz to test knowledge, an audio summary to listen to on the go, or a simple explanatory video, GenTeach provides the tools to create it in minutes.

---

## 🏗️ System Architecture Overview

GenTeach is architected as a modern, decoupled full-stack application. Each component is designed for a specific purpose, ensuring scalability and maintainability.

```
+------------------+      +---------------------+      +------------------------+
|   React          |      |     Flask Backend   |      |   Google Cloud APIs    |
|   Frontend       |----->| (Generation Logic & |----->| (Gemini, Vertex, TTS)  |
| (User Interface) |      |   API Gateway)      |      | (AI Services)          |
+------------------+      +----------+----------+      +------------------------+
                                     |
                                     |
                                     v
                          +---------------------+
                          |      Firebase       |
                          |     (Firestore)     |
                          |  (Data Persistence) |
                          +---------------------+
```


1.  **Frontend (React):** A dynamic and responsive user interface built in React that handles all client-side interactions, from user authentication to displaying the chat interface and content galleries.
2.  **Backend (Flask):** The central nervous system of the application. It exposes a REST API, manages user sessions, processes requests, interfaces with the Google AI services, and orchestrates the content generation process (using libraries like MoviePy).
3.  **Database (Firebase/Firestore):** A NoSQL database that serves as the single source of truth for user data, generated content metadata, and request logs. Its real-time capabilities are ideal for a dynamic application.
4.  **AI Services (Google Cloud):** External, powerful APIs for generative tasks. Gemini is used for text and script generation, Vertex AI for image creation, and Google's TTS for audio synthesis.

---
## 🎥 Demo & Screenshots

*I will add screenshots and a link to a live demo video here soon.*

---

## ✨ Key Features

- **🤖 AI-Powered Content Generation**
  - Utilizes Google's powerful Gemini model to understand prompts and generate high-quality text for scripts and quizzes. It's the creative engine of the platform.

- **🗣️ Conversational Interface**
  - An interactive chat UI allows users to communicate their needs to the AI in a conversational way, refining their requests on the fly.

- **🎬 Multi-Format Content Creation**
  - **Video Generation:** Leverages MoviePy to programmatically combine AI-generated images, text overlays, and synthesized audio into short, informative videos.
  - **Audio Synthesis:** Integrates Google's Text-to-Speech API to convert any generated script into a clear audio file, perfect for auditory learners.
  - **Image Creation:** Uses Vertex AI to generate relevant images that can be used in videos or as standalone visual aids.

- **🗂️ Content Management Galleries**
  - Dedicated, user-specific galleries provide a clean interface to view, manage, and access all previously generated content, acting as a personal digital library.

- **🔐 User Authentication & Profile Management**
  - A complete and secure user management system featuring registration, login, and profile updates. Passwords are fully encrypted using `bcrypt`.

- **📈 Usage Tracking & Admin Oversight**
  - The system tracks user activity and content requests. The v1.0 implementation includes a manual approval workflow for an administrator to manage the generation queue.

- **🛂 Admin Oversight & Request Management (v1.0)**
   - To ensure quality and manage system resources, GenTeach features a robust administrative workflow.
   - All user requests for content generation first enter a dedicated queue with a 'pending' status.
   - From a secure admin dashboard, an administrator can review the details of each request—the user's prompt and desired output—and then choose to either Approve or Reject it.
   - This manual checkpoint serves as a crucial gate for quality control, prevents abuse, and allows for careful management of API costs. It establishes the foundational pending -> approved -> complete workflow that will be fully automated in future versions.
---

## 🛠️ Tech Stack

This project is built with a modern and robust technology stack:

- **Frontend:**
  - ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  - ![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
  - ![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)

- **Backend:**
  - ![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
  - ![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)

- **Database:**
  - ![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

- **AI & Cloud Services:**
  - ![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white) (Gemini, Vertex AI, Text-to-Speech)

---

## 🧠 Challenges & Key Learnings

Building GenTeach involved several interesting challenges and key learnings:

-   **Managing LLM Statelessness:** A primary challenge was the stateless nature of LLMs like Gemini, which have no memory of past interactions. In the current v1.0, this is managed using simple Python state variables on the backend to track the conversation's context within a single, active session. While functional for short exchanges, this approach is limited and non-scalable, as all context is lost once the session ends. This limitation was a key learning experience, highlighting the need for a persistent, intelligent memory layer. As a result, the v2.0 roadmap includes integrating mem0.ai to build a truly context-aware and personalized agent.
-   **Serverless Environment Dependencies:** Deploying an app with system dependencies like `ImageMagick` and `ffmpeg` to a serverless platform required a deep dive into **Docker**. Containerizing the application was the key to ensuring a consistent and reproducible production environment.
-   **Asynchronous Task Handling:** Content generation, especially for video, can be a time-consuming process. In the current v1.0 architecture, these tasks are handled synchronously, meaning the user must wait on a loading screen for the entire process to complete. Recognizing this user experience bottleneck was crucial. The plan for v2.0 is to re-architect this flow into an asynchronous, event-driven system using n8n. This will allow users to submit a request, receive immediate confirmation, and be notified later once their content is ready, creating a much more robust and user-friendly application.

---


## 🚀 Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have Node.js and Python installed on your system.

### Installation

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/your-username/your-repository-name.git](https://github.com/your-username/your-repository-name.git)
    cd your-repository-name
    ```

2.  **Backend Setup:**
    - Navigate to the backend directory:
      ```sh
      cd backend
      ```
    - Create and activate a virtual environment:
      ```sh
      # For macOS/Linux
      python3 -m venv venv
      source venv/bin/activate

      # For Windows
      python -m venv venv
      .\venv\Scripts\activate
      ```
    - Install the required Python packages:
      ```sh
      pip install -r requirements.txt
      ```
    - Create a `.env` file in the `backend` directory and add your environment variables:
      ```
      FLASK_SECRET_KEY="your_flask_secret_key"
      GOOGLE_APPLICATION_CREDENTIALS="Content_of_your_json_file"
      # Add any other required keys...
      ```
    - Run the Flask server:
      ```sh
      python app.py
      ```
      The backend will be running on `http://127.0.0.1:5000`.

3.  **Frontend Setup:**
    - Open a **new terminal** and navigate to the frontend directory:
      ```sh
      cd gen-teach
      ```
    - Install the required npm packages:
      ```sh
      npm install
      ```
    - Run the React development server:
      ```sh
      npm run dev
      ```
      The frontend will be running on `http://localhost:5173` (or another specified port).

---

## 🗺️ Roadmap

Here are some of the exciting features planned for the future:

- [ ] **Full Automation:** Integrate `n8n` to fully automate the email notification system.
- [ ] **Persistent Memory:** Implement `mem0.ai` to give the AI long-term memory, providing a more personalized and context-aware experience for each user.
- [ ] **Advanced Video Features:** Enhance video generation with more dynamic layouts and animations.

See the [open issues](https://github.com/AnanthuNarashimman/GenTeach---AI/issues) for a full list of proposed features (and known issues).

---

## 📞 Contact

### Ananthu Narashimman

-   **LinkedIn:** [`Ananthu Narashimman`](https://www.linkedin.com/in/ananthunarashimman/)
-   **GitHub:** [`@AnanthuNarashimman`](https://github.com/AnanthuNarashimman)
-   **Email:** `flashprojects95@gmail.com`

Project Link: [GenTeach---AI](https://github.com/AnanthuNarashimman/GenTeach---AI)
