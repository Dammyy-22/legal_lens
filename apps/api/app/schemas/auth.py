import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        # Minimal, explicit strength check. Argon2 makes brute-forcing hashes expensive,
        # but a weak password is still weak — length + character-class variety is a
        # reasonable baseline without being so strict it drives users to predictable
        # workarounds.
        if v.isalpha() or v.isdigit():
            raise ValueError("Password must include a mix of letters, numbers, or symbols")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=10, max_length=128)

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if v.isalpha() or v.isdigit():
            raise ValueError("Password must include a mix of letters, numbers, or symbols")
        return v


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role: str
    is_email_verified: bool

    model_config = {"from_attributes": True}
