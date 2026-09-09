import email
import os
import time
from dotenv import load_dotenv
from datetime import datetime, timedelta
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Response,
    Request,
)

from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserSession
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from app.security.password import verify_password
from app.security.password import hash_password
from app.security.session import (
    generate_session_token,
    hash_session_token,
)
load_dotenv()
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "").strip().lower()
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/register",
    response_model=UserResponse
)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    # --------------------------------------------------------
    # CLEAN INPUT
    # --------------------------------------------------------

    full_name = request.full_name.strip()
    email = request.email.strip().lower()
    phone = request.phone.strip()

    # --------------------------------------------------------
    # CHECK EXISTING EMAIL
    # --------------------------------------------------------

    existing_email = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=409,
            detail="Email already registered."
        )

    # --------------------------------------------------------
    # CHECK EXISTING PHONE
    # --------------------------------------------------------

    existing_phone = (
        db.query(User)
        .filter(User.phone == phone)
        .first()
    )

    if existing_phone:
        raise HTTPException(
            status_code=409,
            detail="Phone number already registered."
        )

    # --------------------------------------------------------
    # DETERMINE ROLE
    # --------------------------------------------------------
    # Only the configured ADMIN_EMAIL becomes admin.
    # Every other registered account becomes a normal user.

    if ADMIN_EMAIL and email == ADMIN_EMAIL:
        role = "admin"
    else:
        role = "user"

    # --------------------------------------------------------
    # HASH PASSWORD
    # --------------------------------------------------------

    password_hash = hash_password(
        request.password
    )

    # --------------------------------------------------------
    # CREATE USER
    # --------------------------------------------------------

    user = User(
        full_name=full_name,
        email=email,
        phone=phone,
        password_hash=password_hash,
        role=role,
        is_active=1,
    )

    # --------------------------------------------------------
    # SAVE USER
    # --------------------------------------------------------

    db.add(user)
    db.commit()
    db.refresh(user)

    return user

# ============================================================
# LOGIN
# ============================================================

SESSION_COOKIE_NAME = "cyberguard_session"

SESSION_DURATION_DAYS = 7
# ============================================================
# LOGIN RATE LIMITING
# ============================================================

MAX_LOGIN_ATTEMPTS = 5
LOGIN_BLOCK_DURATION = 15 * 60  # 15 minutes

login_attempts = {}

@router.post("/login")
def login(
    request: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):

    email = request.email.strip().lower()

    # --------------------------------------------------------
    # LOGIN RATE LIMIT CHECK
    # --------------------------------------------------------

    current_time = time.time()

    attempt_data = login_attempts.get(email)

    if attempt_data:
        failed_attempts, blocked_until = attempt_data

        if blocked_until > current_time:
            remaining_minutes = int(
                (blocked_until - current_time) / 60
            ) + 1

            raise HTTPException(
                status_code=429,
                detail=f"Too many failed login attempts. Try again in {remaining_minutes} minutes."
            )

        # Block period has expired
        if blocked_until > 0 and blocked_until <= current_time:
            login_attempts.pop(email, None)


    # --------------------------------------------------------
    # FIND USER
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    # --------------------------------------------------------
    # GENERIC ERROR
    # --------------------------------------------------------

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    # --------------------------------------------------------
    # CHECK ACCOUNT
    # --------------------------------------------------------

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is inactive."
        )

    # --------------------------------------------------------
    # VERIFY PASSWORD
    # --------------------------------------------------------

    password_valid = verify_password(
        request.password,
        user.password_hash
    )

    if not password_valid:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    # --------------------------------------------------------
    # CREATE RANDOM SESSION TOKEN
    # --------------------------------------------------------

    session_token = generate_session_token()

    token_hash = hash_session_token(
        session_token
    )

    expires_at = (
        datetime.utcnow()
        + timedelta(
            days=SESSION_DURATION_DAYS
        )
    )

    # --------------------------------------------------------
    # SAVE SESSION
    # --------------------------------------------------------

    user_session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )

    db.add(user_session)
    db.commit()

    # --------------------------------------------------------
    # SET SECURE COOKIE
    # --------------------------------------------------------

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=COOKIE_SECURE,    # True when using HTTPS in production
        samesite="none",
        max_age=60 * 60 * 24 * SESSION_DURATION_DAYS,
        path="/",
    )

    return {
        "message": "Login successful.",
        "user": {
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
        },
    }
# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
):

    session_token = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="Authentication required."
        )

    token_hash = hash_session_token(
        session_token
    )

    user_session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == token_hash
        )
        .first()
    )

    if user_session is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid session."
        )

    # --------------------------------------------------------
    # CHECK EXPIRATION
    # --------------------------------------------------------

    if user_session.expires_at < datetime.utcnow():

        db.delete(user_session)
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="Session expired."
        )

    # --------------------------------------------------------
    # GET USER
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(User.id == user_session.user_id)
        .first()
    )

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="User account is unavailable."
        )

    return user

# ============================================================
# CURRENT USER
# ============================================================

@router.get("/me")
def get_me(
    current_user: User = Depends(
        get_current_user
    )
):

    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.role,
    }

# ============================================================
# LOGOUT
# ============================================================

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):

    session_token = request.cookies.get(
        SESSION_COOKIE_NAME
    )

    if session_token:

        token_hash = hash_session_token(
            session_token
        )

        user_session = (
            db.query(UserSession)
            .filter(
                UserSession.token_hash == token_hash
            )
            .first()
        )

        if user_session:
            db.delete(user_session)
            db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )

    return {
        "message": "Logged out successfully."
    }