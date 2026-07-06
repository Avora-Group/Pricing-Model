from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/acmi_platform"
    jwt_secret: str = "change-me-to-a-32-char-random-string"
    environment: str = "development"
    frontend_url: str = "http://localhost:3000"
    allowed_origins: str = ""  # comma-separated additional origins
    # Comma-separated emails that are permanent admins: they cannot be demoted
    # from the admin role or deactivated via the admin API.
    protected_admin_emails: str = "abukhair.alpyspayev@avora.aero"

    @property
    def cookie_secure(self) -> bool:
        return self.environment != "development"

    @property
    def protected_admin_email_set(self) -> set[str]:
        """Lowercased set of permanent-admin emails for case-insensitive checks."""
        return {
            e.strip().lower()
            for e in self.protected_admin_emails.split(",")
            if e.strip()
        }

    class Config:
        env_file = ".env"


settings = Settings()
