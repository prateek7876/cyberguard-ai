from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

    environment: str = "development"
    secret_key: str = ""
    database_url: str = "postgresql+asyncpg://cyberguard:cyberguard123@db:5432/cyberguard"
    cors_origins: str = "http://localhost:3000"
    gemini_api_key: str = ""
    virustotal_api_key: str = ""
    request_timeout: int = 15
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()
