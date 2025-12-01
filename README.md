# ai-dev-tools-zoomcamp

Homework for https://github.com/DataTalksClub/ai-dev-tools-zoomcamp


## Homework 1: Todo App

A simple Django todo application.

### Setup

```bash
# Install uv (if not already installed)
brew install uv

# Create and activate virtual environment
uv venv .venv
source .venv/bin/activate

# Install dependencies
uv pip install django
```

### Run the app

```bash
cd homework1
python manage.py migrate
python manage.py runserver
```

Then visit http://127.0.0.1:8000/todos/

### Run tests

```bash
cd homework1
python manage.py test todos
```
