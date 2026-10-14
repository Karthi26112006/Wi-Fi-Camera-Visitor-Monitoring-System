import os
import time
import threading
import subprocess
import shutil
from datetime import datetime
# pyrefly: ignore [missing-import]
import cv2
from flask import Flask, Response, request, jsonify, send_from_directory, stream_with_context
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from database import (
    init_db, add_log, get_all_logs, get_log_by_id, delete_log, 
    add_camera, get_all_cameras, get_active_camera_for_user, set_active_camera, delete_camera,
    create_user, get_user_by_username
)

app = Flask(__name__)
# Enable CORS for the React frontend
CORS(app)

# Ensure snapshot directory exists
SNAPSHOT_DIR = os.path.join(app.root_path, 'static', 'snapshots')
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

# Initialize Database
init_db()

class CameraStreamManager:
    def __init__(self, user_id):
        self.user_id = user_id
        self.lock = threading.Lock()
        self.cap = None
        self.latest_frame = None
        self.is_running = False
        self.status = "Disconnected"  # Connected / Connecting / Disconnected
        self.thread = None
        
        # Load active camera source for this user
        self.source = self._load_source()

    def _load_source(self):
        active_cam = get_active_camera_for_user(self.user_id)
        source = active_cam['source'] if active_cam else 0
        if str(source).isdigit():
            source = int(source)
        return source

    def start(self):
        with self.lock:
            if not self.is_running:
                self.is_running = True
                self.status = "Connecting"
                self.thread = threading.Thread(target=self._run, daemon=True)
                self.thread.start()

    def stop(self):
        with self.lock:
            self.is_running = False
        if self.thread:
            self.thread.join(timeout=2)
        with self.lock:
            if self.cap:
                self.cap.release()
                self.cap = None
            self.status = "Disconnected"

    def update_source(self, new_source):
        # If input is a digit, convert to int for webcam index
        if str(new_source).isdigit():
            new_source = int(new_source)
        
        self.stop()
        with self.lock:
            self.source = new_source
            self.latest_frame = None  # Clear stale frame
        self.start()

    def _run(self):
        retry_delay = 2
        while True:
            with self.lock:
                if not self.is_running:
                    break
                self.status = "Connecting"

            # For HTTP / RTSP URLs, force the FFmpeg backend so that basic-auth
            # credentials embedded in the URL (user:pass@host) are forwarded.
            source = self.source
            is_url = isinstance(source, str) and source.lower().startswith(('http', 'rtsp', 'rtsps'))
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG) if is_url else cv2.VideoCapture(source)
            if not cap.isOpened():
                print(f"[User {self.user_id}] Failed to open video source: {self.source}")
                with self.lock:
                    self.status = "Disconnected"
                    self.latest_frame = None  # Clear stale frame on connection failure
                time.sleep(retry_delay)
                continue

            with self.lock:
                self.cap = cap
                self.status = "Connected"

            while True:
                with self.lock:
                    if not self.is_running:
                        break

                ret, frame = cap.read()
                if not ret:
                    print(f"[User {self.user_id}] Frame capture failed or stream disconnected.")
                    with self.lock:
                        self.status = "Disconnected"
                        self.latest_frame = None  # Clear stale frame on read failure
                    break

                with self.lock:
                    self.latest_frame = frame.copy()

                time.sleep(0.03)  # ~30 FPS

            cap.release()
            with self.lock:
                self.cap = None
                if not self.is_running:
                    break
            time.sleep(retry_delay)

    def get_latest_frame_encoded(self):
        with self.lock:
            frame = self.latest_frame
        if frame is None:
            return None
        ret, jpeg = cv2.imencode('.jpg', frame)
        if not ret:
            return None
        return jpeg.tobytes()

    def get_status(self):
        with self.lock:
            return self.status


class CameraManagerStore:
    def __init__(self):
        self.managers = {}
        self.lock = threading.Lock()

    def get_manager(self, user_id):
        if not user_id or not str(user_id).isdigit():
            return None
        with self.lock:
            key = int(user_id)
            if key not in self.managers:
                manager = CameraStreamManager(key)
                manager.start()
                self.managers[key] = manager
            else:
                self.managers[key].start()
            return self.managers[key]

camera_store = CameraManagerStore()


# ---------------------------------------------------------------------------
# Audio Streaming via FFmpeg
# ---------------------------------------------------------------------------

def _check_ffmpeg():
    """Return True if ffmpeg is available on PATH."""
    return shutil.which('ffmpeg') is not None


def _resolve_audio_source(source):
    """
    Return (kind, audio_url) for a given camera source.

    kinds:
      'proxy_opus'  – stream /audio.opus directly from IP Webcam (best quality, no re-encoding)
      'proxy_wav'   – fallback: stream /audio.wav directly (will be re-encoded to MP3 by FFmpeg)
      'rtsp'        – RTSP stream with embedded audio track
      'mic'         – local webcam index → capture system microphone
    """
    if isinstance(source, int) or (isinstance(source, str) and str(source).isdigit()):
        return ('mic', str(source))

    src = str(source)
    src_lower = src.lower()

    if src_lower.startswith('rtsp'):
        return ('rtsp', src)

    if src_lower.startswith('http'):
        # Strip /video or any existing audio path to get the base URL
        for suffix in ('/video', '/audio.wav', '/audio.opus', '/audio.mp3', '/audio'):
            if src_lower.endswith(suffix):
                base = src[:-len(suffix)]
                break
        else:
            base = src.rstrip('/')

        # Prefer Opus (Ogg container) – all modern browsers support it natively
        opus_url = base + '/audio.opus'
        wav_url  = base + '/audio.wav'
        return ('proxy_opus', opus_url)   # wav_url is the fallback

    return ('rtsp', src)  # treat unknown as RTSP-like


def _build_ffmpeg_audio_cmd(audio_src, kind):
    """
    Build an FFmpeg command that reads audio_src and outputs MP3 to stdout.
    Only used for 'mic' and 'rtsp' kinds — HTTP sources are proxied directly.
    """
    import platform
    system = platform.system()

    # Output: MP3, 44100 Hz, mono, streamed to stdout
    common_out = [
        '-vn',
        '-acodec', 'libmp3lame',
        '-ar', '44100',
        '-ac', '1',
        '-q:a', '5',
        '-f', 'mp3',
        'pipe:1'
    ]

    if kind == 'mic':
        if system == 'Windows':
            return ['ffmpeg', '-y', '-f', 'dshow', '-i', 'audio=Microphone',
                    '-loglevel', 'error'] + common_out
        elif system == 'Linux':
            return ['ffmpeg', '-y', '-f', 'alsa', '-i', 'default',
                    '-loglevel', 'error'] + common_out
        else:
            return ['ffmpeg', '-y', '-f', 'avfoundation', '-i', ':0',
                    '-loglevel', 'error'] + common_out

    else:  # rtsp or http fallback
        return ['ffmpeg', '-y', '-rtsp_transport', 'tcp', '-i', audio_src,
                '-loglevel', 'error'] + common_out


def _proxy_http_audio(url, mime):
    """
    Generator: fetch an HTTP audio stream and yield it chunk by chunk.
    Used for IP Webcam /audio.opus and /audio.wav endpoints.
    """
    import urllib.request, base64, re

    # Extract credentials from URL if present (http://user:pass@host...)
    auth_match = re.match(r'https?://([^:@]+):([^@]+)@', url)
    clean_url  = re.sub(r'(https?://)([^:@]+:[^@]+@)', r'\1', url)

    req = urllib.request.Request(clean_url)
    if auth_match:
        creds = base64.b64encode(f'{auth_match.group(1)}:{auth_match.group(2)}'.encode()).decode()
        req.add_header('Authorization', f'Basic {creds}')

    print(f'[Audio] Proxying HTTP audio: {clean_url}  (auth={bool(auth_match)})')
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        while True:
            chunk = resp.read(8192)
            if not chunk:
                break
            yield chunk
    except GeneratorExit:
        pass
    except Exception as e:
        print(f'[Audio] HTTP proxy error: {e}')
    finally:
        print('[Audio] HTTP proxy stopped.')


def generate_audio_feed(source):
    """
    Main audio generator. Chooses the right strategy based on source type:
    - HTTP IP Webcam  → proxy /audio.opus directly (Ogg/Opus, no re-encoding)
    - RTSP / Webcam   → FFmpeg re-encode to MP3
    """
    kind, audio_url = _resolve_audio_source(source)
    print(f'[Audio] source={source!r} → kind={kind!r} url={audio_url!r}')

    if kind in ('proxy_opus', 'proxy_wav'):
        yield from _proxy_http_audio(audio_url, 'audio/ogg')
        return

    # FFmpeg path for mic / RTSP
    cmd = _build_ffmpeg_audio_cmd(audio_url, kind)
    print(f'[Audio] FFmpeg cmd: {" ".join(cmd)}')
    try:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=-1)
    except FileNotFoundError:
        print('[Audio] ffmpeg not found.')
        return
    except Exception as e:
        print(f'[Audio] Failed to start FFmpeg: {e}')
        return

    try:
        while True:
            chunk = proc.stdout.read(8192)
            if not chunk:
                err = proc.stderr.read().decode(errors='replace')
                if err:
                    print(f'[Audio] FFmpeg stderr: {err[-500:]}')
                break
            yield chunk
    except GeneratorExit:
        pass
    finally:
        try:
            proc.kill()
            proc.wait(timeout=2)
        except Exception:
            pass
        print('[Audio] FFmpeg process stopped.')


@app.route('/api/status', methods=['GET'])
def get_camera_status():
    user_id = request.args.get('user_id') or request.headers.get('X-User-Id')
    manager = camera_store.get_manager(user_id)
    if not manager:
        return jsonify({"status": "Disconnected", "source": "0"})
    return jsonify({"status": manager.get_status(), "source": str(manager.source)})

@app.route('/api/config-rtsp', methods=['POST'])
def config_rtsp():
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    data = request.json or {}
    source = data.get('source')
    if source is None:
        return jsonify({"success": False, "message": "Source is required"}), 400
        
    manager = camera_store.get_manager(user_id)
    if not manager:
        return jsonify({"success": False, "message": "Manager not initialized"}), 400
        
    manager.update_source(source)
    time.sleep(1.0)
    status = manager.get_status()
    
    return jsonify({
        "success": status == "Connected",
        "status": status,
        "source": str(source)
    })

def generate_video_feed(user_id):
    manager = camera_store.get_manager(user_id)
    if not manager:
        return
    try:
        while True:
            frame_bytes = manager.get_latest_frame_encoded()
            if frame_bytes is None:
                time.sleep(0.5)
                continue
            
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.04)  # ~25fps
    except (GeneratorExit, Exception) as e:
        print(f"[User {user_id}] Video feed generator connection closed. Stopping camera manager.")
        manager.stop()

@app.route('/api/video_feed')
def video_feed():
    user_id = request.args.get('user_id')
    return Response(generate_video_feed(user_id),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/api/audio_check', methods=['GET'])
def audio_check():
    """Return whether FFmpeg is available for audio streaming."""
    available = _check_ffmpeg()
    return jsonify({
        "available": available,
        "message": "FFmpeg found. Audio streaming ready." if available
                   else "FFmpeg not found. Install FFmpeg and add it to PATH to enable audio."
    })

@app.route('/api/audio_feed')
def audio_feed():
    """Stream live audio from the active camera source."""
    user_id = request.args.get('user_id')
    direct_url = request.args.get('url')  # optional: camera URL from frontend

    if direct_url:
        source = direct_url
    else:
        manager = camera_store.get_manager(user_id)
        if not manager:
            return jsonify({"error": "Unauthorized or no active camera"}), 401
        source = manager.source

    kind, audio_src = _resolve_audio_source(source)
    print(f"[Audio] user={user_id!r} source={source!r} -> kind={kind!r} url={audio_src!r}")

    # FFmpeg only needed for mic/RTSP — not for HTTP proxy
    if kind in ('rtsp', 'mic') and not _check_ffmpeg():
        return jsonify({"error": "FFmpeg not installed — required for RTSP/webcam audio"}), 503

    # Ogg/Opus for proxy, MP3 for FFmpeg
    mime = 'audio/ogg' if kind in ('proxy_opus', 'proxy_wav') else 'audio/mpeg'

    return Response(
        stream_with_context(generate_audio_feed(source)),
        mimetype=mime,
        headers={
            'Cache-Control': 'no-cache, no-store',
            'X-Accel-Buffering': 'no',
        }
    )


@app.route('/api/capture', methods=['POST'])
def capture():
    user_id = request.headers.get('X-User-Id')
    manager = camera_store.get_manager(user_id)
    if not manager:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
    
    data = request.json or {}
    note = data.get('note', '')
    
    with manager.lock:
        frame = manager.latest_frame
    
    if frame is None:
        return jsonify({"success": False, "message": "No active camera stream to capture from"}), 400

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"visitor_{timestamp_str}.jpg"
    filepath = os.path.join(SNAPSHOT_DIR, filename)

    cv2.imwrite(filepath, frame)

    timestamp_formatted = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_id = add_log(filename, timestamp_formatted, note)

    return jsonify({
        "success": True,
        "message": "Snapshot captured successfully",
        "log": {
            "id": log_id,
            "filename": filename,
            "timestamp": timestamp_formatted,
            "note": note
        }
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    logs = get_all_logs()
    for log in logs:
        log['imageUrl'] = f"http://localhost:5000/api/snapshots/{log['filename']}"
    return jsonify(logs)

@app.route('/api/snapshots/<filename>')
def serve_snapshot(filename):
    return send_from_directory(SNAPSHOT_DIR, filename)

@app.route('/api/logs/<int:log_id>', methods=['DELETE'])
def delete_log_entry(log_id):
    log = get_log_by_id(log_id)
    if not log:
        return jsonify({"success": False, "message": "Log entry not found"}), 404

    filepath = os.path.join(SNAPSHOT_DIR, log['filename'])
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            print(f"Error removing file {filepath}: {e}")

    delete_log(log_id)
    return jsonify({"success": True, "message": "Log entry deleted successfully"})

@app.route('/api/cameras', methods=['GET'])
def list_cameras():
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        return jsonify([])
    return jsonify(get_all_cameras(int(user_id)))

@app.route('/api/cameras', methods=['POST'])
def create_camera():
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    data = request.json or {}
    name = data.get('name')
    source = data.get('source')
    if not name or not source:
        return jsonify({"success": False, "message": "Name and source are required"}), 400
    
    camera_id = add_camera(name, source, int(user_id))
    return jsonify({"success": True, "message": "Camera added successfully", "id": camera_id})

@app.route('/api/cameras/active', methods=['POST'])
def activate_camera():
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    data = request.json or {}
    camera_id = data.get('id')
    if not camera_id:
        return jsonify({"success": False, "message": "Camera ID is required"}), 400
    
    success = set_active_camera(camera_id, int(user_id))
    if success:
        active_cam = get_active_camera_for_user(int(user_id))
        if active_cam:
            manager = camera_store.get_manager(user_id)
            manager.update_source(active_cam['source'])
            return jsonify({
                "success": True, 
                "status": manager.get_status(), 
                "active_camera": active_cam
            })
    
    return jsonify({"success": False, "message": "Failed to set active camera or unauthorized"}), 400

@app.route('/api/cameras/<int:camera_id>', methods=['DELETE'])
def remove_camera(camera_id):
    user_id = request.headers.get('X-User-Id')
    if not user_id:
        return jsonify({"success": False, "message": "Unauthorized"}), 401
        
    active_before = get_active_camera_for_user(int(user_id))
    
    success = delete_camera(camera_id, int(user_id))
    if not success:
        return jsonify({"success": False, "message": "Unauthorized or not found"}), 403
    
    active_after = get_active_camera_for_user(int(user_id))
    manager = camera_store.get_manager(user_id)
    if active_before and active_after and active_before['id'] != active_after['id']:
        manager.update_source(active_after['source'])
    elif not active_after:
        manager.update_source(0)
        
    return jsonify({"success": True, "message": "Camera deleted successfully"})

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400
        
    password_hash = generate_password_hash(password)
    success = create_user(username, password_hash)
    
    if success:
        return jsonify({"success": True, "message": "User registered successfully!"})
    else:
        return jsonify({"success": False, "message": "Username already exists."}), 400

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password are required"}), 400
        
    user = get_user_by_username(username)
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({"success": False, "message": "Invalid username or password."}), 401
        
    return jsonify({
        "success": True, 
        "message": "Login successful!",
        "user": {
            "id": user['id'],
            "username": user['username']
        }
    })

if __name__ == '__main__':
    # threaded=True is required so that simultaneous streaming responses
    # (video feed, audio feed, API calls) don't block each other.
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
