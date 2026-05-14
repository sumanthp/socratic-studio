import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker

DATABASE_URL = "sqlite:///./sessions.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class DBSession(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    display_name = Column(String(100), nullable=True)
    provider = Column(String(20), default="openai")
    active_module_index = Column(Integer, default=0)
    milestone = Column(String(200), default="API Basics & Prompting")
    active_file_name = Column(String(255), default="main.py")
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    files = relationship("DBSessionFile", back_populates="session", cascade="all, delete-orphan")
    messages = relationship("DBChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="DBChatMessage.seq")
    snapshots = relationship("DBSnapshot", back_populates="session", cascade="all, delete-orphan", order_by="DBSnapshot.created_at")


class DBSessionFile(Base):
    __tablename__ = "session_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    content = Column(Text, default="")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (UniqueConstraint("session_id", "name"),)

    session = relationship("DBSession", back_populates="files")


class DBChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    seq = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=func.now())

    session = relationship("DBSession", back_populates="messages")


class DBSnapshot(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    files_json = Column(Text, nullable=False)  # JSON array of {name, content}
    created_at = Column(DateTime, default=func.now())

    session = relationship("DBSession", back_populates="snapshots")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
