import sqlite3

DB_NAME = "cyberguard.db"

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()


def get_columns(table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return {row[1] for row in cursor.fetchall()}


print("Starting CyberGuard ownership migration...")


# ============================================================
# TARGETS
# ============================================================

target_columns = get_columns("targets")

if "user_id" not in target_columns:
    print("Adding user_id to targets...")

    cursor.execute(
        """
        ALTER TABLE targets
        ADD COLUMN user_id INTEGER
        """
    )
else:
    print("targets.user_id already exists.")


# ============================================================
# SCANS
# ============================================================

scan_columns = get_columns("scans")

if "user_id" not in scan_columns:
    print("Adding user_id to scans...")

    cursor.execute(
        """
        ALTER TABLE scans
        ADD COLUMN user_id INTEGER
        """
    )
else:
    print("scans.user_id already exists.")


# ============================================================
# ASSETS
# ============================================================

asset_columns = get_columns("assets")

if "user_id" not in asset_columns:
    print("Adding user_id to assets...")

    cursor.execute(
        """
        ALTER TABLE assets
        ADD COLUMN user_id INTEGER
        """
    )
else:
    print("assets.user_id already exists.")


conn.commit()


# ============================================================
# VERIFY
# ============================================================

print("\nMigration completed successfully.")

print("\nTargets columns:")
print(get_columns("targets"))

print("\nScans columns:")
print(get_columns("scans"))

print("\nAssets columns:")
print(get_columns("assets"))


conn.close()