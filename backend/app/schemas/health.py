from pydantic import BaseModel


class LivenessResponse(BaseModel):
    status: str
    service: str


class DatabaseHealthResponse(BaseModel):
    status: str
    database_connected: bool


class RootResponse(BaseModel):
    message: str
    environment: str
