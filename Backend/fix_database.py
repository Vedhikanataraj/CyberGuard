import sqlite3

DB_PATH = "cyberguard.db"

connection = sqlite3.connect(DB_PATH)

try:
    cursor = connection.cursor()

    cursor.execute("PRAGMA table_info(scans)")
    columns = [row[1] for row in cursor.fetchall()]

    print("Existing scans columns:")
    print(columns)

    if "scan_type" not in columns:
        cursor.execute(
            "ALTER TABLE scans ADD COLUMN scan_type VARCHAR DEFAULT 'full'"
        )
        connection.commit()
        print("SUCCESS: scan_type column added.")
    else:
        print("scan_type already exists.")

finally:
    connection.close()