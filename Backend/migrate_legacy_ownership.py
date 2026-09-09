from app.database import SessionLocal
from app.models import User, Target, Scan, Asset


OLD_ACCOUNT_EMAIL = "mailvedhi@gmail.com"


def migrate_legacy_ownership():
    db = SessionLocal()

    try:
        # Find the original user's ID
        user = (
            db.query(User)
            .filter(User.email == OLD_ACCOUNT_EMAIL)
            .first()
        )

        if not user:
            print(f"ERROR: User '{OLD_ACCOUNT_EMAIL}' was not found.")
            return

        print(f"Original account found:")
        print(f"  Email: {user.email}")
        print(f"  User ID: {user.id}")
        print()

        # Only update records where user_id is NULL.
        # Existing user-owned records are NOT touched.

        targets_updated = (
            db.query(Target)
            .filter(Target.user_id.is_(None))
            .update(
                {Target.user_id: user.id},
                synchronize_session=False
            )
        )

        scans_updated = (
            db.query(Scan)
            .filter(Scan.user_id.is_(None))
            .update(
                {Scan.user_id: user.id},
                synchronize_session=False
            )
        )

        assets_updated = (
            db.query(Asset)
            .filter(Asset.user_id.is_(None))
            .update(
                {Asset.user_id: user.id},
                synchronize_session=False
            )
        )

        # Save all changes together
        db.commit()

        print("======================================")
        print("Legacy ownership migration completed")
        print("======================================")
        print(f"Targets assigned : {targets_updated}")
        print(f"Scans assigned   : {scans_updated}")
        print(f"Assets assigned  : {assets_updated}")
        print()
        print(f"All legacy records were assigned to:")
        print(f"{user.email} (User ID: {user.id})")
        print()
        print("Existing records belonging to other users")
        print("were NOT modified.")

    except Exception as e:
        db.rollback()
        print("======================================")
        print("Migration FAILED")
        print("======================================")
        print(f"Error: {e}")
        print()
        print("No changes were committed.")

    finally:
        db.close()


if __name__ == "__main__":
    migrate_legacy_ownership()