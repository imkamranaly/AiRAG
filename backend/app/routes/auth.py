from fastapi import APIRouter, HTTPException

from app.models.schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.services import auth_service

router = APIRouter()


@router.post("/auth/register", response_model=UserResponse, status_code=201)
async def register(body: RegisterRequest) -> UserResponse:
    """Register a new user account."""
    try:
        user = await auth_service.register_user(
            email=body.email,
            password=body.password,
            full_name=body.full_name,
        )
    except ValueError as exc:
        msg = str(exc)
        status = 409 if "already exists" in msg else 400
        raise HTTPException(status_code=status, detail=msg)

    return UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        created_at=user["created_at"],
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    """Authenticate a user and return a JWT access token."""
    user = await auth_service.authenticate_user(body.email, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = auth_service.create_access_token({"sub": str(user["id"]), "email": user["email"]})
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user["full_name"],
            created_at=user["created_at"],
        ),
    )
