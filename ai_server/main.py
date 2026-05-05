from fastapi import FastAPI
from routers.inference import router as inference_router

app = FastAPI(title='Argos AI 추론 서버', version='1.0.0')
app.include_router(inference_router)


@app.get('/health')
async def health():
    return {'status': 'ok'}
