from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from auth import (
    DUMMY_HASH,
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from database import engine, Base, get_db
from schemas import (
    TokenResponse,
    TransactionCreate,
    TransactionResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)

app = FastAPI(title="SpendWise API")

# The token is sent in the Authorization header (not a cookie), so
# credentials mode is not needed — and it can't be combined with "*" anyway.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"],
)

Base.metadata.create_all(bind=engine)


@app.get("/")
def home():
    return {
        "message": "SpendWise API is running"
    }


# ======================= Auth =======================

def _token_response(user: models.User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


@app.post("/auth/register",
          response_model=TokenResponse,
          status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.User)
        .filter(models.User.email == payload.email)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )

    user = models.User(
        name=payload.name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # two sign-ups with the same email at the same moment
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )
    db.refresh(user)

    return _token_response(user)


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = (
        db.query(models.User)
        .filter(models.User.email == payload.email)
        .first()
    )

    if user is None:
        verify_password(payload.password, DUMMY_HASH)
        password_ok = False
    else:
        password_ok = verify_password(payload.password, user.hashed_password)

    if not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    return _token_response(user)


@app.get("/auth/me", response_model=UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


# ===================== Transactions =====================

def _get_own_transaction(db: Session, id: int, user: models.User):
    transaction = (
        db.query(models.Transaction)
        .filter(
            models.Transaction.id == id,
            models.Transaction.user_id == user.id,
        )
        .first()
    )
    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )
    return transaction


@app.post("/transactions",
          response_model=TransactionResponse,
          status_code=status.HTTP_201_CREATED,
          )
def create_transaction(
    transaction: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    new_transaction = models.Transaction(
        user_id=current_user.id,
        title=transaction.title,
        amount=transaction.amount,
        type=transaction.type,
        category=transaction.category,
        date=transaction.date
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)

    return new_transaction


@app.get("/transactions", response_model=list[TransactionResponse])
def list_transactions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.user_id == current_user.id)
        .order_by(models.Transaction.date.desc())
        .all()
    )
    return transactions


@app.get("/transactions/{id}", response_model=TransactionResponse)
def get_transaction(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return _get_own_transaction(db, id, current_user)


@app.put("/transactions/{id}", response_model=TransactionResponse)
def update_transaction(
    id: int,
    updated_data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    transaction = _get_own_transaction(db, id, current_user)

    transaction.title = updated_data.title
    transaction.amount = updated_data.amount
    transaction.type = updated_data.type
    transaction.category = updated_data.category
    transaction.date = updated_data.date

    db.commit()
    db.refresh(transaction)

    return transaction


@app.delete("/transactions/{id}", response_model=TransactionResponse)
def delete_transaction(
    id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    transaction = _get_own_transaction(db, id, current_user)

    db.delete(transaction)
    db.commit()
    return transaction


# ====================== Summary + analytics ======================

@app.get("/summary")
def get_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    total_income = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0))
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == "income",
        )
        .scalar()
    )
    total_expense = (
        db.query(func.coalesce(func.sum(models.Transaction.amount), 0))
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == "expense",
        )
        .scalar()
    )
    balance = total_income - total_expense

    return {
        "total_income": total_income,
        "total_expenses": total_expense,
        "balance": balance
    }


def _monthly_totals(db: Session, user_id: int):
    """Income and expense totals per (year, month) for one user."""
    return (
        db.query(
            func.extract("year", models.Transaction.date).label("year"),
            func.extract("month", models.Transaction.date).label("month"),
            func.sum(
                case(
                    (
                        models.Transaction.type == "income",
                        models.Transaction.amount
                    ),
                    else_=0
                )
            ).label("income"),
            func.sum(
                case(
                    (
                        models.Transaction.type == "expense",
                        models.Transaction.amount
                    ),
                    else_=0
                )
            ).label("expense"),
        )
        .filter(models.Transaction.user_id == user_id)
        .group_by(
            func.extract("year", models.Transaction.date),
            func.extract("month", models.Transaction.date)
        )
        .order_by(
            func.extract("year", models.Transaction.date),
            func.extract("month", models.Transaction.date)
        )
        .all()
    )


@app.get("/analytics/monthly")
def monthly_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    results = _monthly_totals(db, current_user.id)
    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "income": int(row.income),
            "expense": int(row.expense),
            "balance": row.income - row.expense
        }
        for row in results
    ]


@app.get("/analytics/categories")
def category_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    results = (
        db.query(
            models.Transaction.category.label("category"),
            func.sum(models.Transaction.amount).label("total")
        )
        .filter(
            models.Transaction.user_id == current_user.id,
            models.Transaction.type == "expense",
        )
        .group_by(models.Transaction.category)
        .order_by(func.sum(models.Transaction.amount).desc())
        .all()
    )
    return [
        {
            "category": row.category,
            "total": row.total
        }
        for row in results
    ]


@app.get("/analytics/savings")
def savings_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    results = _monthly_totals(db, current_user.id)
    return [
        {
            "year": int(row.year),
            "month": int(row.month),
            "income": row.income,
            "expenses": row.expense,
            "savings": row.income - row.expense
        }
        for row in results
    ]
