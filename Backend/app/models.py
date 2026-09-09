from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
)

from sqlalchemy.orm import relationship

from datetime import datetime

from app.database import Base


# ============================================================
# USER
# ============================================================

class User(Base):

    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    full_name = Column(
        String(100),
        nullable=False
    )

    email = Column(
        String(320),
        unique=True,
        nullable=False,
        index=True
    )

    phone = Column(
        String(32),
        unique=True,
        nullable=False,
        index=True
    )

    password_hash = Column(
        String(255),
        nullable=False
    )

    role = Column(
        String(20),
        nullable=False,
        default="user"
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    is_active = Column(
        Integer,
        default=1,
        nullable=False
    )

    # --------------------------------------------------------
    # USER RELATIONSHIPS
    # --------------------------------------------------------

    scans = relationship(
        "Scan",
        back_populates="user"
    )

    targets = relationship(
        "Target",
        back_populates="user"
    )

    assets = relationship(
        "Asset",
        back_populates="user"
    )


# ============================================================
# TARGET
# ============================================================

class Target(Base):

    __tablename__ = "targets"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    url = Column(
        String,
        nullable=False
    )

    # --------------------------------------------------------
    # OWNER
    # --------------------------------------------------------

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # --------------------------------------------------------
    # RELATIONSHIPS
    # --------------------------------------------------------

    user = relationship(
        "User",
        back_populates="targets"
    )

    scans = relationship(
        "Scan",
        back_populates="target",
        cascade="all, delete-orphan"
    )


# ============================================================
# SCAN
# ============================================================

class Scan(Base):

    __tablename__ = "scans"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    scan_id = Column(
        String,
        unique=True,
        index=True,
        nullable=False
    )

    report_data = Column(
        Text,
        nullable=True
    )

    scan_type = Column(
        String,
        nullable=False,
        default="full"
    )

    target_id = Column(
        Integer,
        ForeignKey("targets.id"),
        nullable=False
    )

    # --------------------------------------------------------
    # OWNER
    # --------------------------------------------------------

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    started_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    completed_at = Column(
        DateTime,
        nullable=True
    )

    security_score = Column(
        Integer,
        nullable=True
    )

    grade = Column(
        String,
        nullable=True
    )

    risk_level = Column(
        String,
        nullable=True
    )

    status = Column(
        String,
        nullable=False,
        default="queued"
    )

    status_code = Column(
        Integer,
        nullable=True
    )

    final_url = Column(
        String,
        nullable=True
    )

    # --------------------------------------------------------
    # RELATIONSHIPS
    # --------------------------------------------------------

    user = relationship(
        "User",
        back_populates="scans"
    )

    target = relationship(
        "Target",
        back_populates="scans"
    )

    findings = relationship(
        "Finding",
        back_populates="scan",
        cascade="all, delete-orphan"
    )


# ============================================================
# FINDING
# ============================================================

class Finding(Base):

    __tablename__ = "findings"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    scan_id = Column(
        Integer,
        ForeignKey("scans.id"),
        nullable=False
    )

    title = Column(
        String,
        nullable=False
    )

    severity = Column(
        String,
        nullable=False
    )

    category = Column(
        String,
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    recommendation = Column(
        Text,
        nullable=True
    )

    scan = relationship(
        "Scan",
        back_populates="findings"
    )


# ============================================================
# ASSET
# ============================================================

class Asset(Base):

    __tablename__ = "assets"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    ip_address = Column(
        String,
        nullable=False,
        index=True
    )

    hostname = Column(
        String,
        nullable=True
    )

    operating_system = Column(
        String,
        nullable=True
    )

    open_ports = Column(
        Text,
        nullable=True
    )

    services = Column(
        Text,
        nullable=True
    )

    risk_level = Column(
        String,
        nullable=False,
        default="Unknown"
    )

    # --------------------------------------------------------
    # OWNER
    # --------------------------------------------------------

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
        index=True
    )

    last_scanned = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # --------------------------------------------------------
    # RELATIONSHIPS
    # --------------------------------------------------------

    user = relationship(
        "User",
        back_populates="assets"
    )

    vulnerabilities = relationship(
        "Vulnerability",
        back_populates="asset",
        cascade="all, delete-orphan"
    )


# ============================================================
# VULNERABILITY
# ============================================================

class Vulnerability(Base):

    __tablename__ = "vulnerabilities"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    asset_id = Column(
        Integer,
        ForeignKey("assets.id"),
        nullable=False
    )

    cve_id = Column(
        String,
        nullable=False,
        index=True
    )

    title = Column(
        String,
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    severity = Column(
        String,
        nullable=True
    )

    cvss_score = Column(
        String,
        nullable=True
    )

    affected_product = Column(
        String,
        nullable=True
    )

    detected_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    asset = relationship(
        "Asset",
        back_populates="vulnerabilities"
    )


# ============================================================
# USER SESSION
# ============================================================

class UserSession(Base):

    __tablename__ = "user_sessions"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    token_hash = Column(
        String(64),
        unique=True,
        nullable=False,
        index=True
    )

    expires_at = Column(
        DateTime,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user = relationship(
        "User",
        backref="sessions"
    )
