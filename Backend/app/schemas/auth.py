from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):

    full_name: str = Field(
        min_length=2,
        max_length=100
    )

    email: EmailStr

    phone: str = Field(
        min_length=7,
        max_length=20
    )

    password: str = Field(
        min_length=12,
        max_length=128
    )


class LoginRequest(BaseModel):

    email: EmailStr

    password: str = Field(
        min_length=1,
        max_length=128
    )


class UserResponse(BaseModel):

    id: int
    email: EmailStr
    phone: str

    class Config:
        from_attributes = True