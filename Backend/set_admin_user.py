import os
import sqlite3

from dotenv import load_dotenv


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

load_dotenv()

ADMIN_EMAIL = os.getenv(
    "ADMIN_EMAIL",
    ""
).strip().lower()


# ============================================================
# VALIDATE ADMIN EMAIL
# ============================================================

if not ADMIN_EMAIL:
    raise RuntimeError(
        "ADMIN_EMAIL is not configured in .env"
    )


# ============================================================
# ASK FOR ADMIN NAME
# ============================================================

full_name = input(
    "Enter the admin user's full name: "
).strip()


if len(full_name) < 2:
    raise ValueError(
        "Full name must contain at least 2 characters."
    )


# ============================================================
# CONNECT TO DATABASE
# ============================================================

connection = sqlite3.connect(
    "cyberguard.db"
)

cursor = connection.cursor()


try:

    # --------------------------------------------------------
    # FIND ADMIN ACCOUNT
    # --------------------------------------------------------

    cursor.execute(
        """
        SELECT id, email
        FROM users
        WHERE LOWER(email) = ?
        """,
        (ADMIN_EMAIL,)
    )

    user = cursor.fetchone()


    if user is None:

        print(
            "\nNo user account was found for "
            "the ADMIN_EMAIL in .env."
        )

        print(
            "Create the account first, then run "
            "this script again."
        )

    else:

        user_id, email = user

        # ----------------------------------------------------
        # UPDATE ADMIN ACCOUNT
        # ----------------------------------------------------

        cursor.execute(
            """
            UPDATE users
            SET
                full_name = ?,
                role = 'admin'
            WHERE id = ?
            """,
            (full_name, user_id)
        )

        connection.commit()


        print(
            "\n========================================"
        )

        print(
            "Admin account updated successfully!"
        )

        print(
            "========================================"
        )

        print(
            f"ID       : {user_id}"
        )

        print(
            f"Email    : {email}"
        )

        print(
            f"Name     : {full_name}"
        )

        print(
            "Role     : admin"
        )


finally:

    connection.close()
    