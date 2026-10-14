# Wi-Fi Camera Visitor Monitoring System

A production-ready web application for real-time RTSP/Webcam stream monitoring, snapshot capturing, and visitor logging.

## Tech Stack
- **Frontend**: React.js (Vite, Hooks, Tailwind CSS v4, Lucide React icons, Axios)
- **Backend**: Flask (Python 3, OpenCV, Flask-CORS, SQLite database)

---

## Directory Structure
```text
Camera View/
├── server/
│   ├── app.py             # Flask core server
│   ├── database.py        # SQLite Database initialization & helper operations
│   ├── requirements.txt   # Python server requirements
│   └── visitor_logs.db    # SQLite Database file (generated after start)
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── LiveFeed.jsx    # Handles live MJPEG stream display, control bar
│   │   │   ├── RtspModal.jsx   # Dynamic RTSP camera config modal
│   │   │   └── VisitorLogs.jsx # Grid view of visitor snapshot archives
│   │   ├── App.jsx             # Main dashboard layout and polling camera status
│   │   ├── index.css           # Tailwind CSS integration
│   │   └── main.jsx
│   └── vite.config.js          # Vite config with Tailwind CSS plugin
└── README.md
```

---

## Prerequisites
Make sure you have the following installed on your machine:
- [Python 3.8+](https://www.python.org/downloads/)
- [Node.js (v18+)](https://nodejs.org/) with `npm`

---

## Setup & Running the Application

Follow these steps to run both the Backend and Frontend concurrently.

### 1. Backend Setup (Flask Server)

1. Open a terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the Flask server:
   ```bash
   python app.py
   ```
   The backend API will run on `http://localhost:5000`.

### 2. Frontend Setup (React Application)

1. Open a **new** terminal window and navigate to the `client/` directory:
   ```bash
   cd client
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   The React frontend will be accessible at `http://localhost:5173`.

---

## Usage Guide
1. **Camera Stream**: By default, the application tries to open the default local webcam (`0`).
2. **Dynamic Configuration**: Click the **Settings** cog icon in the Live Feed controls to swap the source dynamically (e.g. to a local webcam index `1`, or an RTSP stream like `rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov`).
3. **Capture Snapshot**: Type an optional note or name of the visitor in the input box and click **Snapshot** to save their image to the gallery.
4. **Logs Gallery**: Switch to the **Visitor Logs** tab to view your snapshots, expand them to high-resolution, or delete entries.
