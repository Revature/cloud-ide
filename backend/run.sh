#!/usr/bin/env bash
echo running...
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload