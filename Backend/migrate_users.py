import sqlite3


DB_PATH = "cyberguard.db"


def migrate():

    connection = sqlite3.connect(DB_PATH)

    cursor = connection.cursor()

    try:

        # ----------------------------------------------------
        # CHECK EXISTING COLUMNS
        # ----------------------------------------------------

        cursor.execute(
            "PRAGMA table_info(users)"
        )

        columns = {
            row[1]
            for row in cursor.fetchall()
        }

        print(
            "Existing users columns:",
            columns
        )


        # ----------------------------------------------------
        # ADD FULL NAME
        # ----------------------------------------------------

        if "full_name" not in columns:

            print(
                "Adding full_name column..."
            )

            # Existing users need a temporary
            # default value because the column
            # will eventually be NOT NULL.

            cursor.execute(
                """
                ALTER TABLE users
                ADD COLUMN full_name
                VARCHAR(100)
                NOT NULL
                DEFAULT 'User'
                """
            )

        else:

            print(
                "full_name already exists."
            )


        # ----------------------------------------------------
        # ADD ROLE
        # ----------------------------------------------------

        if "role" not in columns:

            print(
                "Adding role column..."
            )

            cursor.execute(
                """
                ALTER TABLE users
                ADD COLUMN role
                VARCHAR(20)
                NOT NULL
                DEFAULT 'user'
                """
            )

        else:

            print(
                "role already exists."
            )


        # ----------------------------------------------------
        # SAVE CHANGES
        # ----------------------------------------------------

        connection.commit()

        print(
            "\nDatabase migration completed successfully."
        )


    except Exception as error:

        connection.rollback()

        print(
            "\nMigration failed:"
        )

        print(error)

        raise


    finally:

        connection.close()


if __name__ == "__main__":
    migrate()