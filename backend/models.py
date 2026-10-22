from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Integer, Numeric, String, CheckConstraint, Date, DateTime, ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column

from database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Transaction(Base):
    __tablename__ = "transactions"

    __table_args__ = (
        CheckConstraint(
            "type IN ('income','expense')",
            name='check_constraint_type',
        ),
    )
    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    # Every transaction belongs to exactly one user
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )

    type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )

    category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    date: Mapped[Date] = mapped_column(
        Date, nullable=False
    )
