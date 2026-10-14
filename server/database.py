import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'visitor_logs.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create visitor_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visitor_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            note TEXT
        )
    ''')
    
    # Create cameras table (remove is_active column since it's tracked per user)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cameras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source TEXT NOT NULL,
            user_id INTEGER
        )
    ''')
    
    # Create users table with active_camera_id column
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            active_camera_id INTEGER
        )
    ''')
    
    # Seed default webcam if no cameras exist
    cursor.execute("SELECT COUNT(*) FROM cameras")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO cameras (name, source, user_id) VALUES (?, ?, NULL)",
            ("Default Webcam", "0")
        )
        
    conn.commit()
    conn.close()

def add_log(filename, timestamp, note):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO visitor_logs (filename, timestamp, note) VALUES (?, ?, ?)",
        (filename, timestamp, note)
    )
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    return log_id

def get_all_logs():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM visitor_logs ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_log_by_id(log_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM visitor_logs WHERE id = ?", (log_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_log(log_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM visitor_logs WHERE id = ?", (log_id,))
    conn.commit()
    conn.close()

# Cameras Management helpers (scoped to user)
def add_camera(name, source, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO cameras (name, source, user_id) VALUES (?, ?, ?)",
        (name, source, user_id)
    )
    conn.commit()
    camera_id = cursor.lastrowid
    conn.close()
    return camera_id

def get_all_cameras(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get user's active camera ID
    cursor.execute("SELECT active_camera_id FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    active_camera_id = int(user_row[0]) if user_row and user_row[0] is not None else None
    
    # Retrieve user's cameras OR public cameras
    cursor.execute(
        "SELECT * FROM cameras WHERE user_id = ? OR user_id IS NULL ORDER BY id ASC",
        (user_id,)
    )
    rows = cursor.fetchall()
    conn.close()
    
    cameras_list = []
    has_active = False
    
    for row in rows:
        cam = dict(row)
        if active_camera_id is not None:
            cam['is_active'] = 1 if cam['id'] == active_camera_id else 0
        else:
            # If no active camera is set, default webcam (NULL user_id) is active
            cam['is_active'] = 1 if cam['user_id'] is None else 0
            
        if cam['is_active'] == 1:
            has_active = True
        cameras_list.append(cam)
        
    # Fallback: if active camera is set to something deleted, mark default webcam active
    if not has_active and len(cameras_list) > 0:
        for cam in cameras_list:
            if cam['user_id'] is None:
                cam['is_active'] = 1
                
    return cameras_list

def get_camera_by_id(camera_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_active_camera_for_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch active camera ID for the user
    cursor.execute("SELECT active_camera_id FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    active_camera_id = int(user_row[0]) if user_row and user_row[0] is not None else None
    
    row = None
    if active_camera_id is not None:
        cursor.execute("SELECT * FROM cameras WHERE id = ?", (active_camera_id,))
        row = cursor.fetchone()
        
    # Fallback to public camera
    if not row:
        cursor.execute("SELECT * FROM cameras WHERE user_id IS NULL LIMIT 1")
        row = cursor.fetchone()
        
    conn.close()
    return dict(row) if row else None

def set_active_camera(camera_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify camera exists and belongs to the user OR is public (user_id IS NULL)
    cursor.execute("SELECT user_id FROM cameras WHERE id = ?", (camera_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    cam_owner = row[0]
    if cam_owner is not None and cam_owner != user_id:
        conn.close()
        return False
        
    # Update active camera ID in user record
    cursor.execute("UPDATE users SET active_camera_id = ? WHERE id = ?", (int(camera_id), user_id))
    conn.commit()
    conn.close()
    return True

def delete_camera(camera_id, user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify camera belongs to the user
    cursor.execute("SELECT user_id FROM cameras WHERE id = ?", (camera_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    cam_owner = row[0]
    if cam_owner is None or cam_owner != user_id:
        conn.close()
        return False
        
    cursor.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
    
    # If this was the user's active camera, reset it to NULL (which defaults back to webcam)
    cursor.execute("SELECT active_camera_id FROM users WHERE id = ?", (user_id,))
    user_row = cursor.fetchone()
    if user_row and user_row[0] is not None and int(user_row[0]) == int(camera_id):
        cursor.execute("UPDATE users SET active_camera_id = NULL WHERE id = ?", (user_id,))
        
    conn.commit()
    conn.close()
    return True

# User Auth helpers
def create_user(username, password_hash):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()
        conn.close()
        return True
    except sqlite3.IntegrityError:
        return False

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None
