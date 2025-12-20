# The Holiday Tree 🎄
A virtual holiday tree application where users can create their own personalized tree and invite friends and family to hang ornaments with heartfelt messages.
## Features ✨
*   **Create Your Own Tree**: Sign in to generate a unique holiday tree.
*   **Decorate with Ornaments**: Drag and drop various ornaments onto the tree.
*   **Leave Messages**: Add personal messages attached to each ornament.
*   **Share with Friends**: Share your unique tree link (e.g., `/tree/{id}`) so others can visit and decorate.
*   **Responsive Design**: Works seamlessly on both desktop and mobile devices.
*   **Real-time Updates**: See ornaments appear in real-time as friends add them.
## Tech Stack 🛠️
*   **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
*   **Frontend**: [Vue.js 3](https://vuejs.org/) (CDN)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) (CDN)
*   **Database & Auth**: [Firebase](https://firebase.google.com/) (Firestore & Authentication)
## Prerequisites
*   Python 3.8+
*   A Firebase project (if you want to use your own backend)
## Installation & Setup
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/Tree-2.git
    cd Tree-2
    ```
2.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
## Running the Application
1.  **Start the server:**
    ```bash
    python main.py
    ```
    Or directly with uvicorn:
    ```bash
    uvicorn main:app --reload
    ```
2.  **Open in your browser:**
    Navigate to `http://localhost:8000` to view the application.
## Configuration
### Firebase Setup
The application currently uses a specific Firebase configuration located in `static/app.js`. To use your own Firebase project:
1.  Create a project in the [Firebase Console](https://console.firebase.google.com/).
2.  Enable **Authentication** (Google Sign-In).
3.  Enable **Firestore Database**.
4.  Copy your web app configuration object.
5.  Update the `firebaseConfig` object in `static/app.js`:
    ```javascript
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.firebasestorage.app",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };
    ```
## Project Structure
*   `main.py`: Main FastAPI application entry point.
*   `static/`: Contains frontend assets.
    *   `index.html`: Main HTML file serving the Vue app.
    *   `app.js`: Connects Vue.js logic with Firebase services.
*   `assets/`: Directory for images and other static media.
*   `Procfile`: Deployment configuration (e.g., for Heroku/Render).
*   `requirements.txt`: Python dependencies.

