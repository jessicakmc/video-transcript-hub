FROM python:3.12-slim

# The worker shells out to ffmpeg/ffprobe (transcode + chunk) and yt-dlp, so
# the binary has to be in the image — this is why the worker is a Fargate
# container and not a Lambda.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker.py summarizer.py ./

# JOB_ID (worker) or SESSION_ID (summariser), plus SUPABASE_URL /
# SUPABASE_SECRET_KEY / OPENAI_API_KEY, arrive as env from the Lambda
# distributor's RunTask override. The summariser runs off the same image via a
# command override, so one build serves both passes.
CMD ["python", "worker.py"]
