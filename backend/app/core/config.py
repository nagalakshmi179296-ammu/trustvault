from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "TrustVault"
    document_encryption_key: str
    database_url: str = (
        "postgresql+psycopg://trustvault:"
        "change_this_local_password@localhost:5432/trustvault"
    )

    jwt_secret_key: str = "CHANGE_THIS_TO_A_LONG_RANDOM_SECRET"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()